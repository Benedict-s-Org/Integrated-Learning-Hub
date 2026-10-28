-- Learning Hub auth bridge for Luanti
-- Polls Supabase Edge Function auth-sync and registers a custom auth handler.

local http = core.request_http_api and core.request_http_api()
local MOD_NAME = "lh_auth"

local settings = {
  sync_url = core.settings:get("lh_auth.sync_url") or "",
  record_login_url = core.settings:get("lh_auth.record_login_url") or "",
  service_secret = core.settings:get("lh_auth.service_secret") or "",
  poll_interval = tonumber(core.settings:get("lh_auth.poll_interval") or "2") or 2,
}

local auth_cache = {}

local function log(msg)
  core.log("action", "[" .. MOD_NAME .. "] " .. msg)
end

local function apply_accounts(accounts)
  local next_cache = {}
  for _, account in ipairs(accounts or {}) do
    local name = account.luantiUsername
    local password = account.password
    if type(name) == "string" and type(password) == "string" and name ~= "" and password ~= "" then
      local privileges = account.privileges or { interact = true, shout = true, home = true }
      next_cache[name] = {
        password = core.get_password_hash(name, password),
        privileges = privileges,
        last_login = -1,
      }
    end
  end
  auth_cache = next_cache
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
    apply_accounts(payload.accounts)
  end)
end

local auth_handler = {
  get_auth = function(name)
    return auth_cache[name]
  end,
  create_auth = function(name, password)
    -- Accounts are created by Learning Hub only.
    auth_cache[name] = {
      password = core.get_password_hash(name, password),
      privileges = { interact = true, shout = true, home = true },
      last_login = os.time(),
    }
  end,
  delete_auth = function(name)
    auth_cache[name] = nil
    return true
  end,
  set_password = function(name, password)
    local auth = auth_cache[name]
    if not auth then
      return false
    end
    auth.password = core.get_password_hash(name, password)
    return true
  end,
  set_privileges = function(name, privileges)
    local auth = auth_cache[name]
    if not auth then
      return false
    end
    auth.privileges = privileges
    return true
  end,
  reload = function()
    sync_now()
    return true
  end,
  record_login = function(name)
    local auth = auth_cache[name]
    if auth then
      auth.last_login = os.time()
    end
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
    for name, _ in pairs(auth_cache) do
      names[#names + 1] = name
    end
    local i = 0
    return function()
      i = i + 1
      local name = names[i]
      if name then
        return name, auth_cache[name]
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
  log("registered Learning Hub auth handler")
end
