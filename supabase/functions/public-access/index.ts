
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop(); // verify, submit-reward, create-link

    const { token, adminUserId, targetUserIds, amount, reason } = await req.json();

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
        type: 'class_dashboard'
      }).select("token").single();

      if (error) throw error;

      return new Response(JSON.stringify({ token: newLink.token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Verify Token
    if (path === "verify") {
      if (!token) throw new Error("Missing token");

      const { data: link, error } = await supabase.from("shared_links").select("id").eq("token", token).eq("is_active", true).single();

      if (error || !link) {
        return new Response(JSON.stringify({ valid: false }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ valid: true, permissions: ['view', 'request_reward'] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. List Users (Guest)
    if (path === "list-users") {
      if (!token) throw new Error("Missing token");

      // Verify Token
      const { data: link } = await supabase.from("shared_links").select("created_by").eq("token", token).eq("is_active", true).single();
      if (!link) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }

      // Fetch Users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, role, created_at, display_name, class")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Fetch Profiles (Seat Numbers)
      const { data: profiles } = await supabase.from("user_profiles").select("id, seat_number, avatar_url");
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Fetch Coins (Room Data)
      const { data: roomData } = await supabase.from("user_room_data").select("user_id, coins");
      const roomMap = new Map((roomData || []).map((r: any) => [r.user_id, r.coins]));

      // Merge
      const mergedUsers = users.map((u: any) => {
        const profile: any = profileMap.get(u.id) || {};
        return {
          ...u,
          seat_number: profile.seat_number || null,
          avatar_url: profile.avatar_url || null,
          coins: roomMap.get(u.id) || 0
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

      return new Response(JSON.stringify({ success: true, count: submissions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
