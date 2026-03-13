import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
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
  role: 'admin' | 'class_staff' | 'user';
  adminUserId: string;
  display_name?: string;
  class?: string;
}

interface BulkCreateUsersRequest {
  users: Array<{
    email: string;
    password: string;
    role: 'admin' | 'class_staff' | 'user';
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
  role?: 'admin' | 'class_staff' | 'user';
  class?: string | null;
  className?: string | null; // Support for className aliasing
  classNumber?: number | null;
  spellingLevel?: number;
  ecas?: string[];
  managed_classes?: string[];
  password?: string;
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

interface BulkUpdateUsersRequest {
  adminUserId: string;
  updates: Array<{
    id: string;
    display_name?: string;
    class?: string;
    classNumber?: string | number;
    ecas?: string[];
    role?: 'admin' | 'class_staff' | 'user';
  }>;
}

// @ts-ignore: Deno is a global in Edge Functions
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // @ts-ignore: Deno is a global in Edge Functions
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore: Deno is a global in Edge Functions
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

    // Private helper to check and sync roles
    const getAuthenticatedRole = async (userId: string) => {
      if (!userId || typeof userId !== 'string') {
        console.log("getAuthenticatedRole: Missing or invalid userId:", userId);
        return null;
      }

      console.log("getAuthenticatedRole: Checking role for userId:", userId);

      // 1. Check if role in public.users
      const { data: publicUser, error: publicError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (publicError) {
        console.error("getAuthenticatedRole: public.users fetch error:", publicError);
      }

      if (publicUser) {
        console.log("getAuthenticatedRole: Found role in public.users:", publicUser.role);
        return publicUser.role as 'admin' | 'class_staff' | 'user';
      }

      console.log("getAuthenticatedRole: User not found in public.users, checking auth.users metadata...");

      // 2. If not found, check auth.users metadata
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError || !authUser.user) {
        console.error("getAuthenticatedRole: Auth user check failed:", authError);
        return null;
      }

      const metadata = authUser.user.user_metadata || {};
      const role = (metadata.role || authUser.user.app_metadata?.role || 'user') as 'admin' | 'class_staff' | 'user';
      console.log("getAuthenticatedRole: Found role in auth metadata:", role);

      if (role === 'admin' || role === 'class_staff') {
        console.log(`Syncing ${role} role to public.users for:`, userId);

        // Sync to public.users (upsert if needed)
        const { error: syncError } = await supabase
          .from("users")
          .upsert({
            id: userId,
            role: role,
            username: authUser.user.email,
            display_name: authUser.user.user_metadata?.display_name || authUser.user.email?.split('@')[0]
          });

        if (syncError) console.error("Failed to sync role:", syncError);
      }

      return role;
    };

    const ensureAdminRole = (userId: string) => getAuthenticatedRole(userId).then(role => role === 'admin');
    const ensureStaffRole = (userId: string) => getAuthenticatedRole(userId).then(role => role === 'admin' || role === 'class_staff');

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
          managed_by_id: adminUserId,
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
        // Update public.users with display_name and managed_by_id
        await supabase.from('users').update({
          display_name: display_name,
          managed_by_id: adminUserId,
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
          // 1. Create User in Auth System (Sync to Supabase Auth)
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: {
              role: user.role || 'user',
              display_name: user.display_name,
              class: user.class,
              managed_by_id: adminUserId,
            }
          });

          if (authError) {
            errors.push({
              line: i + 1,
              email: user.email,
              error: authError.message || "Failed to create auth user",
            });
            continue;
          }

          if (authUser.user) {
            // 2. Link to public.users table and set managed_by_id
            await supabase.from('users').update({
              display_name: user.display_name,
              class: user.class,
              managed_by_id: adminUserId,
            }).eq('id', authUser.user.id);

            results.push({
              line: i + 1,
              email: user.email,
              success: true,
            });
          }
        } catch (err) {
          errors.push({
            line: i + 1,
            email: user.email,
            error: "Unexpected error occurred during creation",
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

      const callerRole = await getAuthenticatedRole(adminUserId);
      if (!callerRole || (callerRole !== 'admin' && callerRole !== 'class_staff')) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Base query for users
      let query = supabase
        .from("users")
        .select("id, username, role, created_at, display_name, class, managed_by_id, class_number, spelling_level, ecas");

      // Scoping for class_staff
      if (callerRole === 'class_staff') {
        const { data: assignments } = await supabase
          .from("class_staff_assignments")
          .select("class_id")
          .eq("staff_user_id", adminUserId)
          .eq("is_active", true);

        const assignedClasses = assignments?.map((a: any) => a.class_id) || [];
        // Only return users in assigned classes
        query = query.in("class", assignedClasses);
      }

      const { data: users, error: usersError } = await query.order("created_at", { ascending: false });

      if (usersError) {
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userIds = (users || []).map((u: any) => u.id);

      // 2. Parallel Fetch: Avatar Configs and Room Data
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
      
      const [avatarRes, roomRes] = await Promise.all([
        supabase.from("user_avatar_config").select("user_id, equipped_items, custom_offsets").in("user_id", userIds),
        supabase.from("user_room_data").select("user_id, coins, virtual_coins, toilet_coins, daily_counts, morning_status, last_morning_update").in("user_id", userIds)
      ]);

      const avatarMap = new Map<string, any>((avatarRes.data || []).map((a: any) => [a.user_id, a]));
      const roomMap = new Map<string, any>((roomRes.data || []).map((r: any) => [r.user_id, r]));

      // 3. Debug logging to find Maximus in auth.users (Optional - keep for now as requested)
      let MaximusToKeepId: string | null = null;
      const debugLogs: string[] = [];
      try {
        const authResponse = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const authUsers = authResponse.data?.users || [];
        authUsers.forEach((au: any) => {
          if (au.email === "s20221112@superleekam.edu.hk") MaximusToKeepId = au.id;
        });
      } catch (e: any) { debugLogs.push(`Catch Error: ${e.message}`); }

      // 4. Merge data
      const mergedUsers = (users || []).map((u: any) => {
        const avatar = avatarMap.get(u.id);
        const room = roomMap.get(u.id) || {};
        const isTargetMaximus = u.id === MaximusToKeepId;

        return {
          ...u,
          is_official_maximus: isTargetMaximus,
          avatar_url: avatar ? "CUSTOM" : null,
          equipped_item_ids: avatar?.equipped_items || [],
          custom_offsets: avatar?.custom_offsets || null,
          coins: room.coins || 0,
          virtual_coins: room.virtual_coins || 0,
          toilet_coins: room.toilet_coins ?? 100,
          daily_counts: room.daily_counts || {},
          morning_status: (room.last_morning_update === today) ? (room.morning_status || 'todo') : 'todo',
          last_morning_update: room.last_morning_update || null
        };
      });

      return new Response(
        JSON.stringify({ users: mergedUsers, debug: debugLogs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    if (path.endsWith("/bulk-delete-users")) {
      const { adminUserId, userIdsToDelete } = await req.json();

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

      const results = [];
      const errors = [];

      // 1. Get the first admin ID (super admin) for safety
      const { data: firstAdmin } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const superAdminId = firstAdmin?.id;

      for (const userId of userIdsToDelete) {
        try {
          // Safety: Cannot delete the super admin
          if (userId === superAdminId) {
            errors.push({ id: userId, error: "Cannot delete the super admin" });
            continue;
          }

          // 2. Delete from public.users first
          const { error: dbError } = await supabase
            .from("users")
            .delete()
            .eq("id", userId);

          if (dbError) throw dbError;

          // 3. Delete from Auth system
          const { error: authError } = await supabase.auth.admin.deleteUser(userId);

          if (authError) {
            console.error(`Auth deletion failed for ${userId}:`, authError);
            // We still proceed as the public record is gone
          }

          results.push({ id: userId, success: true });
        } catch (err: any) {
          console.error(`Failed to delete user ${userId}:`, err);
          errors.push({ id: userId, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: errors.length === 0,
          message: `Processed ${userIdsToDelete.length} users. ${results.length} success, ${errors.length} failed.`,
          results,
          errors
        }),
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

    if (path.endsWith("/get-staff-assignments")) {
      const { userId } = await req.json();
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("class_staff_assignments")
        .select("class_id")
        .eq("staff_user_id", userId)
        .eq("is_active", true);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ assignments: data.map((a: any) => a.class_id) }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/update-user")) {
      const body = await req.json();
      console.log("Update user request body:", JSON.stringify(body));
      const { adminUserId, userId, username, display_name, role, class: classInput, className: classNameInput, classNumber, spellingLevel, ecas, managed_classes, password }: UpdateUserRequest = body;

      const { data: targetUser } = await supabase
        .from("users")
        .select("role, class")
        .eq("id", userId)
        .maybeSingle();

      // Ensure staff role is synced before proceeding
      const callerRole = await getAuthenticatedRole(adminUserId);
      if (!callerRole || (callerRole !== 'admin' && callerRole !== 'class_staff')) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Staff role missing or invalid" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Scoping check for class_staff
      if (callerRole === 'class_staff') {
        // 1. Get staff assignments
        const { data: assignments } = await supabase
          .from("class_staff_assignments")
          .select("class_id")
          .eq("staff_user_id", adminUserId)
          .eq("is_active", true);

        const assignedClasses = assignments?.map((a: any) => a.class_id) || [];

        // 2. Already fetched targetUser above
        if (!targetUser || !assignedClasses.includes(targetUser.class)) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: You can only update users in your assigned classes" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const finalClass = classInput || classNameInput;

      try {
        const classNumberValue = classNumber === 0 ? 0 : (classNumber || null);

        const updatePayload: any = {};
        if (username !== undefined) updatePayload.username = username;
        if (display_name !== undefined) updatePayload.display_name = display_name;
        if (role !== undefined) updatePayload.role = role;
        if (finalClass !== undefined) updatePayload.class = finalClass || null;
        if (spellingLevel !== undefined) updatePayload.spelling_level = spellingLevel || null;
        if (classNumber !== undefined) updatePayload.class_number = classNumberValue;
        if (ecas !== undefined) updatePayload.ecas = ecas || [];

        console.log("DEBUG update-user: userId=", userId, "updatePayload=", JSON.stringify(updatePayload));

        // If payload is empty, nothing to do
        if (Object.keys(updatePayload).length === 0) {
          console.log("DEBUG update-user: payload is EMPTY, nothing to update");
          return new Response(
            JSON.stringify({ success: true, user: null, message: "No changes to apply" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Try update — Supabase PostgREST silently ignores unknown columns
        const { data: updatedUser, error } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", userId)
          .select()
          .single();

        console.log("DEBUG update-user: result=", JSON.stringify({ data: updatedUser, error }));

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
        if (classNumber !== undefined) authUpdates.class_number = classNumber;
        if (spellingLevel !== undefined) authUpdates.spelling_level = spellingLevel;

        const authPayload: any = {};
        if (Object.keys(authUpdates).length > 0) {
          authPayload.user_metadata = {
            ...(await supabase.auth.admin.getUserById(userId)).data.user?.user_metadata,
            ...authUpdates
          };
        }
        if (password) {
          authPayload.password = password;
        }

        if (Object.keys(authPayload).length > 0) {
          const { error: authError } = await supabase.auth.admin.updateUserById(userId, authPayload);
          if (authError) {
             console.error("Failed to update auth.users:", authError);
          }
        }

        // Handle class_staff_assignments if managed_classes or role changed
        const currentRole = role || targetUser?.role || 'user';
        if (currentRole === 'class_staff' && managed_classes !== undefined) {
          console.log("Updating class_staff_assignments for:", userId, managed_classes);

          // Delete existing active assignments
          const { error: delError } = await supabase
            .from("class_staff_assignments")
            .delete()
            .eq("staff_user_id", userId);

          if (delError) console.error("Error deleting old assignments:", delError);

          // Insert new ones
          if (managed_classes.length > 0) {
            const inserts = managed_classes.map(cid => ({
              staff_user_id: userId,
              class_id: cid,
              is_active: true
            }));
            const { error: insError } = await supabase
              .from("class_staff_assignments")
              .insert(inserts);
            if (insError) console.error("Error inserting new assignments:", insError);
          }
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
          // 1. Update DB directly (bypasses restrictive RPC and handles managed_by_id)
          const { error: dbError } = await supabase
            .from("users")
            .update({
              class: update.class || null,
              class_number: update.classNumber
            })
            .eq("id", update.userId);

          if (dbError) {
            throw dbError;
          }

          // 2. Sync Auth Metadata ONLY if explicitly requested
          if (syncAuthMetadata) {
            const { error: authError } = await supabase.auth.admin.updateUserById(update.userId, {
              user_metadata: {
                class_number: update.classNumber,
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

    if (path.endsWith("/bulk-update-users")) {
      const { adminUserId, updates }: BulkUpdateUsersRequest = await req.json();

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

      console.log(`Processing bulk user edit for ${updates.length} users`);

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          // 1. Update DB directly (bypasses restrictive RPC and handles all fields)
          const classNumVal = update.classNumber !== undefined && update.classNumber !== "" ? Number(update.classNumber) : null;
          const { error: dbError } = await supabase
            .from("users")
            .update({
              ...(update.display_name !== undefined ? { display_name: update.display_name } : {}),
              ...(update.class !== undefined ? { class: update.class } : {}),
              ...(update.classNumber !== undefined ? { class_number: classNumVal } : {}),
              ...(update.ecas !== undefined ? { ecas: update.ecas } : {}),
              ...(update.role !== undefined ? { role: update.role } : {}),
              managed_by_id: adminUserId
            })
            .eq("id", update.id);

          if (dbError) throw dbError;

          // 2. Sync Auth Metadata
          const { data: userData } = await supabase.auth.admin.getUserById(update.id);
          const { error: authError } = await supabase.auth.admin.updateUserById(update.id, {
            user_metadata: {
              ...(userData.user?.user_metadata || {}),
              ...(update.display_name ? { display_name: update.display_name } : {}),
              ...(update.class !== undefined ? { class: update.class } : {}),
              ...(update.classNumber !== undefined && update.classNumber !== "" ? { class_number: Number(update.classNumber) } : { class_number: null }),
              ...(update.ecas !== undefined ? { ecas: update.ecas } : {}),
              ...(update.role !== undefined ? { role: update.role } : {}),
              managed_by_id: adminUserId
            }
          });

          if (authError) {
            console.error(`Auth sync failed for ${update.id}:`, authError);
          }

          results.push({ id: update.id, success: true });
        } catch (err: any) {
          console.error(`Failed to update user ${update.id}:`, err);
          errors.push({ id: update.id, error: err.message });
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

    // ── List Auth Emails ──────────────────────────────────────────────────
    if (path.endsWith("/list-auth-emails")) {
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

      try {
        const authResponse = await supabase.auth.admin.listUsers({
          perPage: 1000,
        });

        const authUsers = authResponse.data?.users || [];
        const emailMap: Record<string, string> = {};

        authUsers.forEach((au: any) => {
          if (au.id && au.email) {
            emailMap[au.id] = au.email;
          }
        });

        return new Response(
          JSON.stringify({
            emailMap,
            debug: {
              authError: authResponse.error,
              usersFound: authUsers.length,
              hasData: !!authResponse.data
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err: any) {
        console.error("Error fetching auth emails:", err);
        return new Response(
          JSON.stringify({ error: err.message || "Failed to fetch auth emails" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }


    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in auth function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
