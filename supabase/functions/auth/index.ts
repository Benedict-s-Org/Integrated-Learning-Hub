import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LoginRequest {
  username: string;
  password: string;
}

interface CreateUserRequest {
  username: string;
  password: string;
  role: 'admin' | 'user';
  adminUserId: string;
  display_name?: string;
}

interface BulkCreateUsersRequest {
  users: Array<{
    username: string;
    password: string;
    role: 'admin' | 'user';
    display_name?: string;
  }>;
  adminUserId: string;
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

interface UpdatePermissionsRequest {
  adminUserId: string;
  userId: string;
  can_access_proofreading?: boolean;
  can_access_spelling?: boolean;
}

interface UpdateUserRequest {
  adminUserId: string;
  userId: string;
  username?: string;
  display_name?: string;
  role?: 'admin' | 'user';
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Missing required environment variables",
          details: "SUPABASE_SERVICE_ROLE_KEY must be configured in edge function secrets"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/login")) {
      const { username, password }: LoginRequest = await req.json();

      const { data: user, error } = await supabase
        .from("users")
        .select("id, username, role, force_password_change, accent_preference, can_access_proofreading, can_access_spelling, display_name")
        .eq("username", username)
        .maybeSingle();

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid username or password" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: passwordCheck } = await supabase.rpc("verify_password", {
        user_id: user.id,
        password_input: password,
      });

      if (!passwordCheck) {
        return new Response(
          JSON.stringify({ error: "Invalid username or password" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            force_password_change: user.force_password_change,
            accent_preference: user.accent_preference || 'en-US',
            can_access_proofreading: user.can_access_proofreading || false,
            can_access_spelling: user.can_access_spelling || false,
            display_name: user.display_name || user.username,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/create-user")) {
      const { username, password, role, adminUserId, display_name }: CreateUserRequest = await req.json();

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: newUser, error } = await supabase.rpc("create_user_with_password", {
        username_input: username,
        password_input: password,
        role_input: role,
        display_name_input: display_name || null,
        can_access_proofreading_input: false,
        can_access_spelling_input: false,
        can_access_learning_hub_input: false,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message || "Failed to create user" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, user: newUser }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    if (path.endsWith("/bulk-create-users")) {
      const { users, adminUserId }: BulkCreateUsersRequest = await req.json();

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!users || users.length === 0) {
        return new Response(
          JSON.stringify({ error: "No users provided" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (users.length > 30) {
        return new Response(
          JSON.stringify({ error: "Maximum 30 users can be created at once" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          const { data: newUser, error } = await supabase.rpc("create_user_with_password", {
            username_input: user.username,
            password_input: user.password,
            role_input: user.role,
            display_name_input: user.display_name || null,
            can_access_proofreading_input: false,
            can_access_spelling_input: false,
            can_access_learning_hub_input: false,
          });

          if (error) {
            errors.push({
              line: i + 1,
              username: user.username,
              error: error.message || "Failed to create user",
            });
          } else {
            results.push({
              line: i + 1,
              username: user.username,
              success: true,
            });
          }
        } catch (err) {
          errors.push({
            line: i + 1,
            username: user.username,
            error: "Unexpected error occurred",
          });
        }
      }

      if (errors.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Created ${results.length} user(s), ${errors.length} failed`,
            results,
            errors,
          }),
          {
            status: 207,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully created ${results.length} user(s)`,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/change-password")) {
      const { userId, currentPassword, newPassword, verificationCode }: ChangePasswordRequest = await req.json();

      if (verificationCode) {
        const { data: isValid } = await supabase.rpc("verify_system_code", {
          code_input: verificationCode,
        });

        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid verification code" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else if (currentPassword) {
        const { data: isValid } = await supabase.rpc("verify_password", {
          user_id: userId,
          password_input: currentPassword,
        });

        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Current password is incorrect" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Either current password or verification code is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase.rpc("change_user_password", {
        user_id: userId,
        new_password: newPassword,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to change password" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/verify-code")) {
      const { code, adminUserId }: VerifyCodeRequest = await req.json();

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: isValid } = await supabase.rpc("verify_system_code", {
        code_input: code,
      });

      return new Response(
        JSON.stringify({ valid: isValid }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/list-users")) {
      const { adminUserId } = await req.json();

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: users, error } = await supabase
        .from("users")
        .select("id, username, role, created_at, can_access_proofreading, can_access_spelling, display_name")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch users" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ users }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/delete-user")) {
      const { adminUserId, userIdToDelete } = await req.json();

      const { data: canDelete } = await supabase.rpc("can_delete_user", {
        caller_user_id: adminUserId,
        target_user_id: userIdToDelete,
      });

      if (!canDelete) {
        return new Response(
          JSON.stringify({ error: "Unauthorized. Only the super admin can delete users, and the super admin cannot be deleted." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userIdToDelete);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to delete user" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/check-super-admin")) {
      const { adminUserId } = await req.json();

      console.log("Checking super admin status for user:", adminUserId);

      const { data: isSuperAdmin, error } = await supabase.rpc("is_first_admin", {
        check_user_id: adminUserId,
      });

      if (error) {
        console.error("Error checking super admin status:", error);
        return new Response(
          JSON.stringify({ isSuperAdmin: false, error: error.message }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Super admin check result:", isSuperAdmin);

      return new Response(
        JSON.stringify({ isSuperAdmin: isSuperAdmin === true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/update-user")) {
      const { adminUserId, userId, username, display_name, role }: UpdateUserRequest = await req.json();

      try {
        const { data: updatedUser, error } = await supabase.rpc("update_user_info", {
          caller_user_id: adminUserId,
          target_user_id: userId,
          new_username: username || null,
          new_display_name: display_name || null,
          new_role: role || null,
        });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message || "Failed to update user" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, user: updatedUser }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Failed to update user" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (path.endsWith("/admin-reset-password")) {
      const { adminUserId, userId, newPassword }: AdminResetPasswordRequest = await req.json();

      try {
        const { data: success, error } = await supabase.rpc("admin_change_user_password", {
          caller_user_id: adminUserId,
          target_user_id: userId,
          new_password: newPassword,
        });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message || "Failed to reset password" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Failed to reset password" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (path.endsWith("/update-permissions")) {
      const { adminUserId, userId, can_access_proofreading, can_access_spelling }: UpdatePermissionsRequest = await req.json();

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updates: any = {};
      if (can_access_proofreading !== undefined) updates.can_access_proofreading = can_access_proofreading;
      if (can_access_spelling !== undefined) updates.can_access_spelling = can_access_spelling;

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update permissions" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in auth function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});