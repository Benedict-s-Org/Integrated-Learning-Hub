
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore: Deno is a global in Edge Functions
Deno.serve(async (req: Request) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop(); // verify, submit-reward, create-link

    const { token, adminUserId, targetUserIds, amount, reason, targetClass } = await req.json();

    // 1. Create Link (Admin Only)
    if (path === "create-link") {
      if (!adminUserId) throw new Error("Missing adminUserId");

      // Verify Admin
      const { data: adminUser } = await supabase.from("users").select("role").eq("id", adminUserId).single();
      if (!adminUser || adminUser.role !== 'admin') {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
      }

      // Check existing link
      const { data: existing } = await supabase.from("shared_links").select("token").eq("created_by", adminUserId).eq("is_active", true).single();

      if (existing) {
        return new Response(JSON.stringify({ token: existing.token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create new
      const { data: newLink, error } = await supabase.from("shared_links").insert({
        created_by: adminUserId,
        type: 'class_dashboard',
        target_class: targetClass
      }).select("token").single();

      if (error) throw error;

      return new Response(JSON.stringify({ token: newLink.token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Verify Token
    if (path === "verify") {
      if (!token) throw new Error("Missing token");

      const { data: link, error } = await supabase.from("shared_links").select("id, target_class").eq("token", token).eq("is_active", true).single();

      if (error || !link) {
        return new Response(JSON.stringify({ valid: false }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        valid: true,
        permissions: ['view', 'request_reward'],
        targetClass: link.target_class
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. List Users (Guest)
    if (path === "list-users") {
      if (!token) throw new Error("Missing token");

      // Verify Token and get target_class
      const { data: link } = await supabase.from("shared_links").select("created_by, target_class").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      // Fetch Users with necessary fields
      let query = supabase
        .from("users")
        .select("id, username, role, created_at, display_name, class, class_number")
        .order("created_at", { ascending: false });

      if (link.target_class) {
        query = query.eq("class", link.target_class);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) throw usersError;

      // Extract User IDs for room data
      const userIds = users?.map((u: any) => u.id) || [];

      // Fetch Room Data (Coins and Morning Duties) for these specific users
      const { data: roomData } = await supabase
        .from("user_room_data")
        .select("user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update")
        .in("user_id", userIds);

      const roomMap = new Map((roomData || []).map((r: any) => [r.user_id, r]));

      // Merge
      const mergedUsers = users.map((u: any) => {
        const room: any = roomMap.get(u.id) || {};
        return {
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          role: u.role || 'user',
          class: u.class || null,
          class_number: u.class_number,
          created_at: u.created_at,
          avatar_url: null, // avatar_url column missing – avatars handled via user_avatar_config in frontend
          coins: room.coins || 0,
          virtual_coins: room.virtual_coins || 0,
          daily_counts: room.daily_counts || {},
          morning_status: room.morning_status || 'todo',
          last_morning_update: room.last_morning_update || null
        };
      });

      return new Response(JSON.stringify({ users: mergedUsers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Submit Reward (Guest)
    if (path === "submit-reward") {
      if (!token || !targetUserIds || !amount) throw new Error("Missing required fields");

      // Verify Token first
      const { data: link } = await supabase.from("shared_links").select("token").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      const submissions = targetUserIds.map((userId: string) => ({
        target_user_id: userId,
        amount: amount,
        reason: reason || 'Class Reward',
        submitted_by_token: token,
        status: 'pending'
      }));

      const { error } = await supabase.from("pending_rewards").insert(submissions);

      if (error) throw error;

      // --- IMMEDIATE STATUS UPDATE LOGIC ---
      // If the reason matches a morning duty, update the status immediately even if coins are pending.
      let newMorningStatus: string | null = null;
      if (reason === '完成班務（交齊功課）') {
        newMorningStatus = 'completed';
      } else if (reason === '完成班務（欠功課）') {
        newMorningStatus = 'review';
      } else if (reason === '完成班務（寫手冊）') {
        newMorningStatus = 'completed';
      } else if (reason && (reason.includes('缺席') || reason.toLowerCase().includes('absent'))) {
        newMorningStatus = 'absent';
      }

      if (newMorningStatus) {
        const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });

        await supabase
          .from("user_room_data")
          .update({
            morning_status: newMorningStatus,
            last_morning_update: todayDateStr,
            updated_at: new Date().toISOString()
          })
          .in("user_id", targetUserIds);
      }
      // --------------------------------------

      return new Response(JSON.stringify({ success: true, count: submissions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
