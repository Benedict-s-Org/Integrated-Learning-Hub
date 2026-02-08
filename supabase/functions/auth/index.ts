import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info",
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
  class?: string;
}

interface BulkCreateUsersRequest {
  users: Array<{
    username: string;
    password: string;
    role: 'admin' | 'user';
    display_name?: string;
    class?: string;
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
  class?: string;
  className?: string; // Support for className aliasing
  classNumber?: number;
}

interface AdminResetPasswordRequest {
  adminUserId: string;
  userId: string;
  newPassword: string;
}

interface BulkUpdateClassNumbersRequest {
  adminUserId: string;
  syncAuthMetadata?: boolean;
  updates: Array<{
    userId: string;
    classNumber: number;
    class?: string;
  }>;
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

    // Helper to ensure admin role is synced
    const ensureAdminRole = async (adminUserId: string) => {
      // 1. Check if admin in public.users
      const { data: publicAdmin } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (publicAdmin) return true;

      // 2. If not, check auth.users (via admin API)
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(adminUserId);

      if (authError || !authUser.user) {
        console.error("Auth user check failed:", authError);
        return false;
      }

      const metadata = authUser.user.user_metadata || {};
      const appMetadata = authUser.user.app_metadata || {};

      // Check if they have admin role in metadata
      if (metadata.role === 'admin' || appMetadata.role === 'admin' || appMetadata.claims_admin === true) {
        console.log("Syncing admin role to public.users for:", adminUserId);

        // 3. Sync to public.users
        const { error: updateError } = await supabase
          .from("users")
          .update({ role: 'admin' })
          .eq("id", adminUserId);

        if (updateError) {
          console.error("Failed to sync admin role:", updateError);
          // Try insert if not exists (fallback)
          const { error: insertError } = await supabase
            .from("users")
            .upsert({
              id: adminUserId,
              role: 'admin',
              username: authUser.user.email,
              display_name: metadata.display_name || authUser.user.email?.split('@')[0]
            })
            .select();

          if (insertError) {
            console.error("Failed to insert admin user:", insertError);
            return false;
          }
        }
        return true;
      }

      return false;
    };

    if (path.endsWith("/login")) {
      console.log("Processing login request...");
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
      const { email, password, role, adminUserId, display_name, gender }: CreateUserRequest & { email: string, gender?: string } = await req.json();

      // Check Authorization
      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create User in Auth System
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: role || 'user',
          display_name: display_name,
          gender: gender,
        }
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (newUser.user) {
        // Optionally update public.users if the trigger missed any fields (like gender)
        await supabase.from('users').update({
          display_name: display_name,
          // gender: gender // Uncomment if gender column exists in public.users
        }).eq('id', newUser.user.id);
      }

      return new Response(
        JSON.stringify({ success: true, user: newUser.user }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/bulk-create-users")) {
      const { users, adminUserId }: BulkCreateUsersRequest = await req.json();

      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
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
            class_input: user.class || null,
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
      console.log("Processing list-users request...");
      const { adminUserId } = await req.json();

      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 1. Fetch users from public.users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, role, created_at, display_name, class")
        .order("created_at", { ascending: false });

      if (usersError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch users" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 2. Fetch profiles for seat_number and avatar
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, seat_number, avatar_url");

      if (profilesError) {
        console.warn("list-users: profiles fetch failed:", profilesError);
      }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // 3. Merge data
      const mergedUsers = (users || []).map((u: any) => {
        const profile = profileMap.get(u.id);
        return {
          ...u,
          seat_number: profile?.seat_number || null,
          avatar_url: profile?.avatar_url || null
        };
      });

      return new Response(
        JSON.stringify({ users: mergedUsers }),
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
      const body = await req.json();
      console.log("Update user request body:", JSON.stringify(body));
      const { adminUserId, userId, username, display_name, role, class: classInput, className: classNameInput, classNumber }: UpdateUserRequest = body;

      // Ensure admin role is synced before proceeding
      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Admin role missing or invalid" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const finalClass = classInput || classNameInput;

      try {
        const { data: updatedUser, error } = await supabase.rpc("update_user_info", {
          caller_user_id: adminUserId,
          target_user_id: userId,
          new_username: username || null,
          new_display_name: display_name || null,
          new_role: role || null,
          new_class: finalClass || null,
          new_seat_number: classNumber === 0 ? 0 : (classNumber || null),
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

        // Sync with auth.users metadata for immediate session reflection
        const authUpdates: any = {};
        if (role) authUpdates.role = role;
        if (display_name) authUpdates.display_name = display_name;
        if (finalClass) authUpdates.class = finalClass;
        if (classNumber !== undefined) authUpdates.seat_number = classNumber;

        if (Object.keys(authUpdates).length > 0) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(await supabase.auth.admin.getUserById(userId)).data.user?.user_metadata,
              ...authUpdates
            }
          });
        }

        return new Response(
          JSON.stringify({ success: true, user: updatedUser }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err: any) {
        console.error("Update User Error:", err);
        return new Response(
          JSON.stringify({ error: err.message || "Failed to update user" }),
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

      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
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

    if (path.endsWith("/bulk-update-class-numbers")) {
      const { adminUserId, updates, syncAuthMetadata = false }: BulkUpdateClassNumbersRequest = await req.json();

      const isAdmin = await ensureAdminRole(adminUserId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!updates || !Array.isArray(updates)) {
        return new Response(
          JSON.stringify({ error: "Invalid updates format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Processing bulk update for ${updates.length} users (SyncAuth: ${syncAuthMetadata})`);

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          // 1. Update DB via RPC 
          const { error: dbError } = await supabase.rpc("update_user_info", {
            caller_user_id: adminUserId,
            target_user_id: update.userId,
            new_username: null,
            new_display_name: null,
            new_role: null,
            new_class: update.class || null,
            new_seat_number: update.classNumber,
          });

          if (dbError) {
            throw dbError;
          }

          // 2. Sync Auth Metadata ONLY if explicitly requested
          if (syncAuthMetadata) {
            const { error: authError } = await supabase.auth.admin.updateUserById(update.userId, {
              user_metadata: {
                seat_number: update.classNumber,
                ...(update.class ? { class: update.class } : {})
              }
            });

            if (authError) {
              console.error(`Auth sync failed for ${update.userId}:`, authError);
            }
          }

          results.push({ userId: update.userId, success: true });

        } catch (err: any) {
          console.error(`Failed to update user ${update.userId}:`, err);
          errors.push({ userId: update.userId, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: errors.length === 0,
          message: `Processed ${updates.length} users. ${results.length} success, ${errors.length} failed.`,
          results,
          errors
        }),
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