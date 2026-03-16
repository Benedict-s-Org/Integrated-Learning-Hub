import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-action, x-database-id, x-day-number",
};

const VERSION = "1.0.0 (Split)";

interface CreateUserRequest {
  email: string;
  password: string;
  role: 'admin' | 'class_staff' | 'user';
  adminUserId: string;
  display_name?: string;
  class?: string;
  gender?: string;
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
  className?: string | null;
  classNumber?: number | null;
  spellingLevel?: number;
  ecas?: string[];
  managed_classes?: string[];
  password?: string;
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

    console.log(`[user-management] [${VERSION}] Action: ${action}`);

    // Private helper to check and sync roles
    const getAuthenticatedRole = async (userId: string) => {
      if (!userId || typeof userId !== 'string') return null;

      const { data: publicUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (publicUser) return publicUser.role as 'admin' | 'class_staff' | 'user';

      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (!authUser.user) return null;

      const metadata = authUser.user.user_metadata || {};
      const role = (metadata.role || authUser.user.app_metadata?.role || 'user') as 'admin' | 'class_staff' | 'user';

      if (role === 'admin' || role === 'class_staff') {
        await supabase.from("users").upsert({
          id: userId,
          role: role,
          username: authUser.user.email,
          display_name: authUser.user.user_metadata?.display_name || authUser.user.email?.split('@')[0]
        });
      }

      return role;
    };

    const ensureAdminRole = (userId: string) => getAuthenticatedRole(userId).then(role => role === 'admin');
    const ensureStaffRole = (userId: string) => getAuthenticatedRole(userId).then(role => role === 'admin' || role === 'class_staff');

    if (action === "create-user") {
      const { email, password, role, adminUserId, display_name, gender }: CreateUserRequest = await req.json();
      if (!(await ensureAdminRole(adminUserId))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: role || 'user', display_name, gender, managed_by_id: adminUserId }
      });

      if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders });
      if (newUser.user) {
        await supabase.from('users').update({ display_name, managed_by_id: adminUserId }).eq('id', newUser.user.id);
      }
      return new Response(JSON.stringify({ success: true, user: newUser.user }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "bulk-create-users") {
      const { users, adminUserId }: BulkCreateUsersRequest = await req.json();
      if (!(await ensureAdminRole(adminUserId))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
      if (!users || users.length === 0) return new Response(JSON.stringify({ error: "No users provided" }), { status: 400, headers: corsHeaders });

      const results = [];
      const errors = [];
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { role: user.role || 'user', display_name: user.display_name, class: user.class, managed_by_id: adminUserId }
          });
          if (authError) {
            errors.push({ line: i + 1, email: user.email, error: authError.message });
            continue;
          }
          if (authUser.user) {
            await supabase.from('users').update({ display_name: user.display_name, class: user.class, managed_by_id: adminUserId }).eq('id', authUser.user.id);
            results.push({ line: i + 1, email: user.email, success: true });
          }
        } catch (err: any) { errors.push({ line: i + 1, email: user.email, error: err.message }); }
      }
      return new Response(JSON.stringify({ success: errors.length === 0, results, errors }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-users") {
      const { adminUserId } = await req.json();
      const callerRole = await getAuthenticatedRole(adminUserId);
      if (!callerRole || (callerRole !== 'admin' && callerRole !== 'class_staff')) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      let query = supabase.from("users").select("id, username, role, created_at, display_name, class, managed_by_id, class_number, spelling_level, ecas");
      if (callerRole === 'class_staff') {
        const { data: assignments } = await supabase.from("class_staff_assignments").select("class_id").eq("staff_user_id", adminUserId).eq("is_active", true);
        query = query.in("class", assignments?.map((a: any) => a.class_id) || []);
      }
      const { data: users, error: usersError } = await query.order("created_at", { ascending: false });
      if (usersError) return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500, headers: corsHeaders });

      const userIds = users.map((u: any) => u.id);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
      const [avatarRes, roomRes] = await Promise.all([
        supabase.from("user_avatar_config").select("user_id, equipped_items, custom_offsets").in("user_id", userIds),
        supabase.from("user_room_data").select("user_id, coins, virtual_coins, toilet_coins, daily_counts, morning_status, last_morning_update").in("user_id", userIds)
      ]);

      const avatarMap = new Map((avatarRes.data || []).map((a: any) => [a.user_id, a]));
      const roomMap = new Map((roomRes.data || []).map((r: any) => [r.user_id, r]));

      const mergedUsers = users.map((u: any) => {
        const avatar = avatarMap.get(u.id);
        const room = roomMap.get(u.id) || {};
        return {
          ...u,
          avatar_url: avatar ? "CUSTOM" : null,
          equipped_item_ids: avatar?.equipped_items || [],
          custom_offsets: avatar?.custom_offsets || null,
          coins: room.coins || 0,
          virtual_coins: room.virtual_coins || 0,
          toilet_coins: room.toilet_coins ?? 100,
          daily_counts: room.daily_counts || {},
          morning_status: (room.last_morning_update === today) ? (room.morning_status || 'todo') : 'todo'
        };
      });

      return new Response(JSON.stringify({ users: mergedUsers }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync-all-users") {
      const { adminUserId } = await req.json();
      const callerRole = await getAuthenticatedRole(adminUserId);
      if (callerRole !== 'admin') return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      console.log(`[user-management] Bulk syncing all users from Auth...`);
      
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: corsHeaders });

      const results = [];
      const errors = [];

      for (const authUser of authUsers.users) {
        try {
          const metadata = authUser.user_metadata || {};
          const role = metadata.role || authUser.app_metadata?.role || 'user';
          
          const { error: upsertError } = await supabase.from("users").upsert({
            id: authUser.id,
            username: authUser.email,
            role: role,
            display_name: metadata.display_name || authUser.email?.split('@')[0],
            class: metadata.class || null,
            managed_by_id: metadata.managed_by_id || null,
            class_number: metadata.class_number || metadata.classNumber || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

          if (upsertError) {
            errors.push({ email: authUser.email, error: upsertError.message });
          } else {
            results.push({ email: authUser.email, success: true });
          }
        } catch (err: any) {
          errors.push({ email: authUser.email, error: err.message });
        }
      }

      return new Response(JSON.stringify({ 
        success: errors.length === 0, 
        total: authUsers.users.length,
        synced: results.length,
        errors 
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync-current-user") {
      const { userId } = await req.json();
      if (!userId) return new Response(JSON.stringify({ error: "User ID required" }), { status: 400, headers: corsHeaders });
      
      console.log(`[user-management] Deep syncing current user: ${userId}`);
      
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError || !user) return new Response(JSON.stringify({ error: authError?.message || "User not found in Auth" }), { status: 404, headers: corsHeaders });

      const metadata = user.user_metadata || {};
      const role = metadata.role || user.app_metadata?.role || 'user';
      
      // 1. Sync public.users
      const { error: upsertError } = await supabase.from("users").upsert({
        id: user.id,
        username: user.email,
        role: role,
        display_name: metadata.display_name || user.email?.split('@')[0],
        class: metadata.class || null,
        managed_by_id: metadata.managed_by_id || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: corsHeaders });

      // 2. Ensure peripheral data is initialized (Safe-Healing)
      await Promise.all([
        // user_room_data
        supabase.from("user_room_data").upsert({
          user_id: user.id,
          placements: [],
          wall_placements: [],
          inventory: ["hk_stool", "hk_table", "hk_bed", "basement_stairs"],
          custom_catalog: [],
          custom_models: {},
          custom_walls: [],
          custom_floors: [],
          coins: 0
        }, { onConflict: 'user_id' }),
        
        // user_avatar_config
        supabase.from("user_avatar_config").upsert({
          user_id: user.id,
          equipped_items: { outfit: "default", skin: "default" },
          custom_offsets: {}
        }, { onConflict: 'user_id' })
      ]);

      return new Response(JSON.stringify({ success: true, deep_sync: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-user") {
      const { adminUserId, userId, username, display_name, role, class: classInput, className: classNameInput, classNumber, spellingLevel, ecas, managed_classes, password }: UpdateUserRequest = await req.json();
      const callerRole = await getAuthenticatedRole(adminUserId);
      if (!callerRole || (callerRole !== 'admin' && callerRole !== 'class_staff')) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      const finalClass = classInput || classNameInput;
      const updatePayload: any = {};
      if (username !== undefined) updatePayload.username = username;
      if (display_name !== undefined) updatePayload.display_name = display_name;
      if (role !== undefined) updatePayload.role = role;
      if (finalClass !== undefined) updatePayload.class = finalClass || null;
      if (spellingLevel !== undefined) updatePayload.spelling_level = spellingLevel || null;
      if (classNumber !== undefined) updatePayload.class_number = classNumber === 0 ? 0 : (classNumber || null);
      if (ecas !== undefined) updatePayload.ecas = ecas || [];

      const { data: updatedUser, error } = await supabase.from("users").update(updatePayload).eq("id", userId).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 403, headers: corsHeaders });

      const authPayload: any = {};
      if (Object.keys(updatePayload).length > 0) {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        authPayload.user_metadata = { ...userData.user?.user_metadata, ...updatePayload };
      }
      if (password) authPayload.password = password;
      if (Object.keys(authPayload).length > 0) await supabase.auth.admin.updateUserById(userId, authPayload);

      return new Response(JSON.stringify({ success: true, user: updatedUser }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete-user") {
      const { adminUserId, userIdToDelete } = await req.json();
      const { data: canDelete } = await supabase.rpc("can_delete_user", { caller_user_id: adminUserId, target_user_id: userIdToDelete });
      if (!canDelete) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      await supabase.from("users").delete().eq("id", userIdToDelete);
      await supabase.auth.admin.deleteUser(userIdToDelete);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    if (action === "get-staff-assignments") {
      const { userId } = await req.json();
      const { data, error } = await supabase.from("class_staff_assignments").select("class_id").eq("staff_user_id", userId).eq("is_active", true);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      return new Response(JSON.stringify({ assignments: data.map((a: any) => a.class_id) }), { status: 200, headers: corsHeaders });
    }

    if (action === "list-auth-emails") {
      const { adminUserId } = await req.json();
      if (!(await ensureAdminRole(adminUserId))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      const { data: authResponse, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

      const emailMap: Record<string, string> = {};
      authResponse.users.forEach((au: any) => { if (au.id && au.email) emailMap[au.id] = au.email; });
      return new Response(JSON.stringify({ emailMap }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Action ${action} not found` }), { status: 404, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
