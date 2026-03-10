
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
        .select("id, username, role, created_at, display_name, class, class_number, ecas")
        .order("created_at", { ascending: false });

      if (link.target_class) {
        query = query.or(`class.eq.${link.target_class},ecas.cs.{${link.target_class}}`);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) throw usersError;

      // Extract User IDs for room data
      const userIds = users?.map((u: any) => u.id) || [];

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
      const todayStart = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Parallel Fetch: Avatar Configs, Room Data, and Consequence Counts
      const [avatarRes, roomRes, countRes] = await Promise.all([
        supabase.from("user_avatar_config").select("user_id, equipped_items, custom_offsets").in("user_id", userIds),
        supabase.from("user_room_data").select("user_id, coins, virtual_coins, toilet_coins, daily_counts, morning_status, last_morning_update").in("user_id", userIds),
        supabase.from("student_records").select("student_id").eq("type", "negative").gte("created_at", todayISO)
      ]);

      const avatarMap = new Map((avatarRes.data || []).map((a: any) => [a.user_id, a]));
      const roomMap = new Map((roomRes.data || []).map((r: any) => [r.user_id, r]));

      const counts: Record<string, number> = {};
      (countRes.data || []).forEach((r: any) => {
        if (r.student_id) counts[r.student_id] = (counts[r.student_id] || 0) + 1;
      });

      // Merge
      const mergedUsers = users.map((u: any) => {
        const room: any = roomMap.get(u.id) || {};
        const avatar = avatarMap.get(u.id);
        return {
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          role: u.role || 'user',
          class: u.class || null,
          class_number: u.class_number,
          created_at: u.created_at,
          avatar_url: avatar ? "CUSTOM" : null,
          equipped_item_ids: (avatar as any)?.equipped_items || [],
          custom_offsets: (avatar as any)?.custom_offsets || null,
          ecas: u.ecas || [],
          coins: room.coins || 0,
          virtual_coins: room.virtual_coins || 0,
          toilet_coins: room.toilet_coins ?? 100,
          daily_counts: room.daily_counts || {},
          morning_status: (room.last_morning_update === today) ? (room.morning_status || 'todo') : 'todo',
          last_morning_update: room.last_morning_update || null,
          consequence_count: counts[u.id] || 0
        };
      });

      return new Response(JSON.stringify({ users: mergedUsers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Submit Reward (Guest)
    if (path === "submit-reward") {
      const { token, targetUserIds, amount, reason, isInstant } = await req.json();
      if (!token || !targetUserIds || !amount) throw new Error("Missing required fields");

      // Verify Token first
      const { data: link } = await supabase.from("shared_links").select("token").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      if (isInstant) {
        console.log(`Instant reward processing for ${targetUserIds.length} users`);
        // Use RPC with Service Role for instant application
        for (const userId of targetUserIds) {
          const { error: rpcError } = await supabase.rpc('increment_room_coins', {
            target_user_id: userId,
            amount: amount,
            log_reason: reason || 'Homework Record (Instant)',
            p_skip_daily_count: false
          });
          if (rpcError) {
            console.error(`RPC Error for ${userId}:`, rpcError);
            throw new Error(`RPC Error for ${userId}: ${rpcError.message}`);
          }
        }
      } else {
        // Standard Pending Reward logic
        const isAnsweringQuestion = reason === '回答問題';
        const pendingSubmissions = targetUserIds.map((userId: string) => ({
          target_user_id: userId,
          amount: amount,
          reason: reason || 'Class Reward',
          submitted_by_token: token,
          status: 'pending',
          metadata: isAnsweringQuestion ? { daily_count_updated: true } : {}
        }));

        const { error } = await supabase.from("pending_rewards").insert(pendingSubmissions);
        if (error) throw error;
      }

      // --- IMMEDIATE STATUS / COUNT UPDATE LOGIC ---
      // 1. Morning Status
      let newMorningStatus: string | null = null;
      if (reason === '完成班務（交齊功課）') {
        newMorningStatus = 'completed';
      } else if (reason === '完成班務（欠功課）' || (reason && reason.startsWith('功課:'))) {
        newMorningStatus = 'review';
      } else if (reason === '完成班務（寫手冊）') {
        newMorningStatus = 'completed';
      } else if (reason && (reason.includes('缺席') || reason.toLowerCase().includes('absent'))) {
        newMorningStatus = 'absent';
      }

      const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
      const isAnsweringQuestion = reason === '回答問題';

      for (const userId of targetUserIds) {
        let updateData: any = {
          last_morning_update: todayDateStr,
          updated_at: new Date().toISOString()
        };

        if (newMorningStatus) {
          updateData.morning_status = newMorningStatus;
        }

        // 2. Daily Counts Optimization (Instant feedback for "Answering Questions")
        if (isAnsweringQuestion) {
          const { data: currentData } = await supabase
            .from("user_room_data")
            .select("daily_counts")
            .eq("user_id", userId)
            .single();

          const currentCounts = currentData?.daily_counts || {};
          let dailyRealCount = 0;
          let dailyRealAmount = 0;

          if (currentCounts.date === todayDateStr) {
            dailyRealCount = currentCounts.real_earned_count || currentCounts.count || 0;
            dailyRealAmount = currentCounts.real_earned_amount || currentCounts.real_earned || 0;
          }

          if (dailyRealCount < 3) {
            updateData.daily_counts = {
              date: todayDateStr,
              real_earned_count: dailyRealCount + 1,
              real_earned_amount: dailyRealAmount + amount
            };
          }
        }

        await supabase
          .from("user_room_data")
          .update(updateData)
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, count: targetUserIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Revert Homework (Guest)
    if (path === "revert-homework") {
      const { token, p_student_id } = await req.json();
      if (!token || !p_student_id) throw new Error("Missing required fields");

      // Verify Token first
      const { data: link } = await supabase.from("shared_links").select("token").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      // Call the RPC using service role
      const { error: rpcError } = await supabase.rpc('revert_homework_record', {
        p_student_id: p_student_id
      });

      if (rpcError) {
        console.error('RPC Error in Edge Function:', rpcError);
        throw rpcError;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Get Broadcast Data (Guest)
    if (path === "get-broadcast-data") {
      const { token, className, date } = await req.json();
      if (!token || !className || !date) throw new Error("Missing required fields");

      // Verify Token
      const { data: link } = await supabase.from("shared_links").select("id, target_class").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      // 1. Fetch Homework
      const { data: hwData } = await supabase
        .from('daily_homework')
        .select('assignments')
        .eq('date', date)
        .eq('class_name', className)
        .maybeSingle();

      // 2. Fetch Broadcast Settings
      const { data: configData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'broadcast_v2_settings')
        .maybeSingle();

      // 3. Fetch Student Records for current class and today
      const { data: recordData } = await supabase
        .from('student_records')
        .select('type, message, student_id, student:student_id(display_name, class)')
        .gte('created_at', date + 'T00:00:00'); // Approximating today start

      return new Response(JSON.stringify({
        hwData,
        configData,
        recordData
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 7. Deduct Toilet Coins (Guest)
    if (path === "deduct-toilet-coins") {
      const { token, p_student_id } = await req.json();
      if (!token || !p_student_id) throw new Error("Missing required fields");

      // Verify Token first
      const { data: link } = await supabase.from("shared_links").select("id").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      // Time Logic (Asia/Hong_Kong)
      const now = new Date();
      const hkTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", hour12: false, hour: '2-digit', minute: '2-digit' });
      const [hour, minute] = hkTimeStr.split(':').map(Number);
      const currentTimeVal = hour * 100 + minute;
      const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: 'Asia/Hong_Kong', weekday: 'long' });

      let isLessonTime = false;
      if (!['Saturday', 'Sunday'].includes(dayOfWeek)) {
        // Morning Valid Times (All Weekdays)
        if (currentTimeVal >= 810 && currentTimeVal <= 945) isLessonTime = true;
        else if (currentTimeVal >= 1005 && currentTimeVal <= 1105) isLessonTime = true;
        else if (currentTimeVal >= 1115 && currentTimeVal <= 1245) isLessonTime = true;
        // Afternoon Valid Times
        else if (dayOfWeek === 'Monday' && currentTimeVal >= 1345 && currentTimeVal <= 1445) isLessonTime = true;
        else if (['Tuesday', 'Wednesday', 'Thursday'].includes(dayOfWeek) && currentTimeVal >= 1345 && currentTimeVal <= 1450) isLessonTime = true;
      }

      if (isLessonTime) {
        // Deduct Coins
        const { error: rpcError } = await supabase.rpc('deduct_toilet_coins', {
          p_user_id: p_student_id,
          p_amount: 20
        });
        if (rpcError) {
          console.error('RPC Error:', rpcError);
          throw new Error(rpcError.message || 'Failed to deduct coins');
        }
      } else {
        // Free logic - Just log a neutral record
        const { error } = await supabase.from('student_records').insert({
          student_id: p_student_id,
          message: 'Toilet/Break (Recess/After School)',
          type: 'neutral',
          is_internal: true,
          is_read: false
        });
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true, isLessonTime }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
