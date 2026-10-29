-- Learning Hub auth bridge for Luanti
-- Polls Supabase Edge Function auth-sync and registers a custom auth handler.
-- Only Hub-minted accounts may authenticate. Client self-registration is refused.

local http = core.request_http_api and core.request_http_api()
local MOD_NAME = "lh_auth"

local settings = {
  sync_url = core.settings:get("lh_auth.sync_url") or "",
  record_login_url = core.settings:get("lh_auth.record_login_url") or "",
  service_secret = core.settings:get("lh_auth.service_secret") or "",
  poll_interval = tonumber(core.settings:get("lh_auth.poll_interval") or "1") or 1,
}

-- pending: unused Hub join secrets from the latest auth-sync poll
local pending = {}
-- established: players who logged in successfully; kept across polls until remint/expiry
local established = {}

local function log(msg)
  core.log("action", "[" .. MOD_NAME .. "] " .. msg)
end

local function is_expired(entry)
  if not entry or not entry.expires_at then
    return false
  end
  -- expires_at is ISO8601 UTC; compare via core.get_us_time is awkward, use os.time approximation
  local y, mo, d, h, mi, s = string.match(
    entry.expires_at,
    "^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)"
  )
  if not y then
    return false
  end
  local exp = os.time({
    year = tonumber(y),
    month = tonumber(mo),
    day = tonumber(d),
    hour = tonumber(h),
    min = tonumber(mi),
    sec = tonumber(s),
    isdst = false,
  })
  return os.time() >= exp
end

local function apply_pending(accounts)
  local next_pending = {}
  for _, account in ipairs(accounts or {}) do
    local name = account.luantiUsername
    local password = account.password
    if type(name) == "string" and type(password) == "string" and name ~= "" and password ~= "" then
      local privileges = account.privileges or { interact = true, shout = true, home = true }
      next_pending[name] = {
        password = core.get_password_hash(name, password),
        privileges = privileges,
        last_login = (established[name] and established[name].last_login) or -1,
        expires_at = account.expiresAt,
        from_hub = true,
      }
      -- Remint replaces the password for established players too
      if established[name] then
        established[name].password = next_pending[name].password
        established[name].privileges = privileges
        established[name].expires_at = account.expiresAt
      end
    end
  end
  pending = next_pending
end

local function get_entry(name)
  local entry = pending[name] or established[name]
  if not entry then
    return nil
  end
  if is_expired(entry) then
    pending[name] = nil
    established[name] = nil
    return nil
  end
  return {
    password = entry.password,
    privileges = entry.privileges,
    last_login = entry.last_login or -1,
  }
end

local function sync_now()
  if not http then
    return
  end
  if settings.sync_url == "" or settings.service_secret == "" then
    log("sync skipped: set lh_auth.sync_url and lh_auth.service_secret in minetest.conf")
    return
  end

  http.fetch({
    url = settings.sync_url,
    timeout = 8,
    method = "GET",
    extra_headers = {
      "X-Luanti-Service-Secret: " .. settings.service_secret,
      "Content-Type: application/json",
    },
  }, function(result)
    if not result.completed or not result.succeeded then
      log("auth-sync failed (HTTP)")
      return
    end
    local ok, payload = pcall(core.parse_json, result.data)
    if not ok or type(payload) ~= "table" then
      log("auth-sync JSON parse failed")
      return
    end
    apply_pending(payload.accounts)
  end)
end

local auth_handler = {
  get_auth = function(name)
    return get_entry(name)
  end,

  -- Hub is the only account source. Refuse engine-driven registration.
  create_auth = function(name, password)
    log("refused create_auth for '" .. tostring(name) .. "' (Learning Hub only)")
    return
  end,

  delete_auth = function(name)
    pending[name] = nil
    established[name] = nil
    return true
  end,

  set_password = function(name, password)
    -- Password rotation happens via Hub mint + auth-sync, not client set_password.
    if not pending[name] and not established[name] then
      log("refused set_password for unknown '" .. tostring(name) .. "'")
      return false
    end
    log("refused set_password for '" .. tostring(name) .. "' (use Hub remint)")
    return false
  end,

  set_privileges = function(name, privileges)
    local entry = pending[name] or established[name]
    if not entry then
      return false
    end
    entry.privileges = privileges
    return true
  end,

  reload = function()
    sync_now()
    return true
  end,

  record_login = function(name)
    local entry = pending[name] or established[name]
    if not entry then
      return
    end
    entry.last_login = os.time()
    -- Promote to established so later polls that drop used secrets do not erase auth
    established[name] = entry
    pending[name] = nil

    if http and settings.record_login_url ~= "" and settings.service_secret ~= "" then
      http.fetch({
        url = settings.record_login_url,
        timeout = 8,
        method = "POST",
        data = core.write_json({ luantiUsername = name }),
        extra_headers = {
          "X-Luanti-Service-Secret: " .. settings.service_secret,
          "Content-Type: application/json",
        },
      }, function() end)
    end
  end,

  iterate = function()
    local names = {}
    local seen = {}
    for name, _ in pairs(pending) do
      if not seen[name] then
        seen[name] = true
        names[#names + 1] = name
      end
    end
    for name, _ in pairs(established) do
      if not seen[name] then
        seen[name] = true
        names[#names + 1] = name
      end
    end
    local i = 0
    return function()
      i = i + 1
      local name = names[i]
      if name then
        return name, get_entry(name)
      end
    end
  end,
}

if not http then
  log("HTTP API unavailable. Add lh_auth to secure.http_mods")
else
  core.register_authentication_handler(auth_handler)
  sync_now()
  local elapsed = 0
  core.register_globalstep(function(dtime)
    elapsed = elapsed + dtime
    if elapsed >= settings.poll_interval then
      elapsed = 0
      sync_now()
    end
  end)
  log("registered Learning Hub auth handler (Hub-only accounts)")
end
