import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, X-Luanti-Service-Secret",
};

const JOIN_TTL_MS = 10 * 60 * 1000;
const USERNAME_MAX = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeLuantiUsername(raw: string): string {
  const base = (raw || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const trimmed = (base || "player").slice(0, USERNAME_MAX);
  if (/^[a-z]/.test(trimmed)) return trimmed;
  return (`p_${trimmed}`).slice(0, USERNAME_MAX);
}

function randomPassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function privilegesForRole(role: string | null | undefined): Record<string, boolean> {
  if (role === "admin") {
    return {
      interact: true,
      shout: true,
      home: true,
      fly: true,
      fast: true,
      noclip: true,
      give: true,
      teleport: true,
      bring: true,
      ban: true,
      kick: true,
      privilege: true,
      server: true,
    };
  }
  if (role === "class_staff") {
    return {
      interact: true,
      shout: true,
      home: true,
      fly: true,
      fast: true,
      teleport: true,
      kick: true,
    };
  }
  return {
    interact: true,
    shout: true,
    home: true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceSecret = Deno.env.get("LUANTI_SERVICE_SECRET") || "";
  const serverHost = Deno.env.get("LUANTI_SERVER_HOST") || "127.0.0.1";
  const serverPort = Number(Deno.env.get("LUANTI_SERVER_PORT") || "30000");

  const admin = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() || "";

  try {
    if (action === "mint-join" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) return json({ error: "Missing Authorization" }, 401);

      const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
      if (authError || !authData?.user) {
        return json({ error: "Invalid session" }, 401);
      }

      const hubUserId = authData.user.id;
      const { data: profile, error: profileError } = await admin
        .from("users")
        .select("id, username, role, can_access_learning_hub, display_name")
        .eq("id", hubUserId)
        .maybeSingle();

      if (profileError || !profile) {
        return json({ error: "User profile not found" }, 404);
      }

      const canEnter =
        profile.role === "admin" ||
        profile.role === "class_staff" ||
        profile.can_access_learning_hub === true;
      if (!canEnter) {
        return json({ error: "Learning Community access denied" }, 403);
      }

      const preferred = sanitizeLuantiUsername(
        profile.username || profile.display_name || authData.user.email?.split("@")[0] || "player",
      );

      let account: { id: string; luanti_username: string; status: string } | null = null;
      const { data: existing } = await admin
        .from("luanti_accounts")
        .select("id, luanti_username, status")
        .eq("user_id", hubUserId)
        .maybeSingle();

      if (existing) {
        if (existing.status === "suspended") {
          return json({ error: "Luanti account is suspended" }, 403);
        }
        account = existing;
      } else {
        let candidate = preferred;
        for (let i = 0; i < 8; i++) {
          const { data: created, error: createError } = await admin
            .from("luanti_accounts")
            .insert({
              user_id: hubUserId,
              luanti_username: candidate,
              status: "active",
            })
            .select("id, luanti_username, status")
            .maybeSingle();

          if (!createError && created) {
            account = created;
            break;
          }
          candidate = sanitizeLuantiUsername(`${preferred}${i + 1}`);
        }
        if (!account) {
          return json({ error: "Could not allocate Luanti username" }, 500);
        }
      }

      // Invalidate prior unused secrets
      await admin
        .from("luanti_join_secrets")
        .update({ used_at: new Date().toISOString() })
        .eq("luanti_account_id", account.id)
        .is("used_at", null);

      const password = randomPassword(20);
      const expiresAt = new Date(Date.now() + JOIN_TTL_MS).toISOString();
      const { error: secretError } = await admin.from("luanti_join_secrets").insert({
        luanti_account_id: account.id,
        password_plaintext: password,
        expires_at: expiresAt,
      });
      if (secretError) {
        console.error("[luanti-auth] secret insert failed", secretError);
        return json({ error: "Failed to mint join credentials" }, 500);
      }

      await admin.from("admin_audit_log").insert({
        actor_user_id: hubUserId,
        action: "luanti.mint_join",
        target_user_id: hubUserId,
        metadata: {
          luanti_username: account.luanti_username,
          expires_at: expiresAt,
        },
      });

      return json({
        luantiUsername: account.luanti_username,
        password,
        serverHost,
        serverPort,
        expiresAt,
      });
    }

    if (action === "auth-sync" && req.method === "GET") {
      const provided = req.headers.get("X-Luanti-Service-Secret") || "";
      if (!serviceSecret || provided !== serviceSecret) {
        return json({ error: "Unauthorized" }, 401);
      }

      const nowIso = new Date().toISOString();
      const { data: secrets, error } = await admin
        .from("luanti_join_secrets")
        .select("password_plaintext, expires_at, luanti_account_id")
        .is("used_at", null)
        .gt("expires_at", nowIso);

      if (error) {
        console.error("[luanti-auth] auth-sync query failed", error);
        return json({ error: "Sync failed" }, 500);
      }

      if (!secrets?.length) {
        return json({ accounts: [], serverTime: nowIso });
      }

      const accountIds = [...new Set(secrets.map((s) => s.luanti_account_id))];
      const { data: accts, error: acctError } = await admin
        .from("luanti_accounts")
        .select("id, luanti_username, status, user_id")
        .in("id", accountIds)
        .eq("status", "active");

      if (acctError) {
        console.error("[luanti-auth] auth-sync accounts failed", acctError);
        return json({ error: "Sync failed" }, 500);
      }

      const userIds = [...new Set((accts || []).map((a) => a.user_id))];
      const { data: users } = await admin
        .from("users")
        .select("id, role")
        .in("id", userIds);

      const roleByUser = new Map((users || []).map((u) => [u.id, u.role as string]));
      const acctById = new Map((accts || []).map((a) => [a.id, a]));

      const accounts = secrets
        .map((row) => {
          const acct = acctById.get(row.luanti_account_id);
          if (!acct) return null;
          return {
            luantiUsername: acct.luanti_username as string,
            password: row.password_plaintext as string,
            privileges: privilegesForRole(roleByUser.get(acct.user_id)),
            expiresAt: row.expires_at as string,
          };
        })
        .filter(Boolean);

      return json({ accounts, serverTime: nowIso });
    }

    if (action === "record-login" && req.method === "POST") {
      const provided = req.headers.get("X-Luanti-Service-Secret") || "";
      if (!serviceSecret || provided !== serviceSecret) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await req.json().catch(() => ({}));
      const luantiUsername = String(body.luantiUsername || "").toLowerCase();
      if (!luantiUsername) return json({ error: "luantiUsername required" }, 400);

      const { data: account } = await admin
        .from("luanti_accounts")
        .select("id, user_id, luanti_username")
        .eq("luanti_username", luantiUsername)
        .maybeSingle();

      if (!account) return json({ error: "Unknown account" }, 404);

      const nowIso = new Date().toISOString();
      await admin
        .from("luanti_accounts")
        .update({ last_login_at: nowIso, updated_at: nowIso })
        .eq("id", account.id);

      await admin
        .from("luanti_join_secrets")
        .update({ used_at: nowIso })
        .eq("luanti_account_id", account.id)
        .is("used_at", null)
        .gt("expires_at", nowIso);

      await admin.from("admin_audit_log").insert({
        actor_user_id: account.user_id,
        action: "luanti.login",
        target_user_id: account.user_id,
        metadata: { luanti_username: account.luanti_username },
      });

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 404);
  } catch (err) {
    console.error("[luanti-auth] fatal", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
