import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info",
};

const VERSION = "1.0.0 (Identity Only)";

interface LoginRequest {
  username: string;
  password: string;
}

interface ChangePasswordRequest {
  userId: string;
  currentPassword?: string;
  newPassword: string;
  verificationCode?: string;
}

interface VerifyCodeRequest {
  code: string;
  adminUserId: string;
}

interface AdminResetPasswordRequest {
  adminUserId: string;
  userId: string;
  newPassword: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const action = path.split("/").pop();

    console.log(`[auth-identity] [${VERSION}] Action: ${action}`);

    if (action === "login") {
      const { username, password }: LoginRequest = await req.json();
      const { data: user, error } = await supabase.from("users").select("id, username, role, force_password_change, display_name").eq("username", username).maybeSingle();
      if (error || !user) return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers: corsHeaders });

      const { data: passwordCheck } = await supabase.rpc("verify_password", { user_id: user.id, password_input: password });
      if (!passwordCheck) return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers: corsHeaders });

      return new Response(JSON.stringify({ user }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check-super-admin") {
      const { adminUserId } = await req.json();
      const { data: isSuperAdmin } = await supabase.rpc("is_first_admin", { check_user_id: adminUserId });
      return new Response(JSON.stringify({ isSuperAdmin: isSuperAdmin === true }), { status: 200, headers: corsHeaders });
    }

    if (action === "admin-reset-password") {
      const { adminUserId, userId, newPassword }: AdminResetPasswordRequest = await req.json();
      const { error } = await supabase.rpc("admin_change_user_password", { caller_user_id: adminUserId, target_user_id: userId, new_password: newPassword });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 403, headers: corsHeaders });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    if (action === "change-password") {
      const { userId, currentPassword, newPassword, verificationCode }: ChangePasswordRequest = await req.json();
      let isValid = false;
      if (verificationCode) {
        const { data } = await supabase.rpc("verify_system_code", { code_input: verificationCode });
        isValid = !!data;
      } else if (currentPassword) {
        const { data } = await supabase.rpc("verify_password", { user_id: userId, password_input: currentPassword });
        isValid = !!data;
      }
      if (!isValid) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 403, headers: corsHeaders });

      const { error } = await supabase.rpc("change_user_password", { user_id: userId, new_password: newPassword });
      if (error) return new Response(JSON.stringify({ error: "Failed to change password" }), { status: 500, headers: corsHeaders });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    if (action === "verify-code") {
      const { code } = await req.json();
      const { data: isValid } = await supabase.rpc("verify_system_code", { code_input: code });
      return new Response(JSON.stringify({ valid: isValid }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Action ${action} not found in Identity service` }), { status: 404, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
