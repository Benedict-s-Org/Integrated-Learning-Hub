import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, apikey, x-client-info",
};

type ErrorCode =
  | "outside_hours"
  | "invalid_link"
  | "class_unavailable"
  | "access_denied"
  | "action_rejected";

interface SharedLink {
  id: string;
  token: string;
  type: string;
  target_class: string;
  is_active: boolean;
  allowed_cidrs: string[] | null;
  created_by: string | null;
  created_at: string;
  rotated_at: string | null;
  description: string | null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hkParts(now: Date) {
  const weekday = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Hong_Kong",
    weekday: "long",
  });
  const date = now.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const time = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hourStr, minuteStr] = time.split(":");
  return {
    weekday,
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
    date,
  };
}

function isWithinClassDashHours(now = new Date()): boolean {
  const { weekday, hour, minute } = hkParts(now);
  if (weekday === "Saturday" || weekday === "Sunday") return false;
  const val = hour * 100 + minute;
  return val >= 730 && val <= 1530;
}

function getClassDashWindowEndISO(now = new Date()): string | null {
  if (!isWithinClassDashHours(now)) return null;
  const { date } = hkParts(now);
  return new Date(`${date}T15:30:00+08:00`).toISOString();
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function ipAllowed(clientIp: string | null, cidrs: string[] | null | undefined): boolean {
  if (!cidrs || cidrs.length === 0) return true;
  if (!clientIp) return false;
  const client = ipv4ToInt(clientIp.trim());
  if (client === null) return false;

  for (const raw of cidrs) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry.includes("/")) {
      const [base, bitsStr] = entry.split("/");
      const baseInt = ipv4ToInt(base);
      const bits = parseInt(bitsStr, 10);
      if (baseInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) continue;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      if ((client & mask) === (baseInt & mask)) return true;
    } else if (ipv4ToInt(entry) === client) {
      return true;
    }
  }
  return false;
}

function clientIpFromReq(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
}

async function loadActiveLink(
  sb: SupabaseClient,
  token: string,
): Promise<{ link?: SharedLink; error?: ErrorCode }> {
  const { data, error } = await sb
    .from("shared_links")
    .select("*")
    .eq("token", token)
    .eq("type", "class_dashboard")
    .maybeSingle();

  if (error || !data || !data.is_active) return { error: "invalid_link" };
  return { link: data as SharedLink };
}

async function assertClassActive(
  sb: SupabaseClient,
  className: string,
): Promise<ErrorCode | null> {
  const { data } = await sb
    .from("classes")
    .select("name, is_archived")
    .eq("name", className)
    .maybeSingle();

  if (data?.is_archived) return "class_unavailable";
  // Class row may be missing historically; still allow if students exist
  return null;
}

async function validateTokenAccess(
  sb: SupabaseClient,
  token: string,
  req: Request,
): Promise<{ link?: SharedLink; valid_until?: string; error?: ErrorCode }> {
  if (!isWithinClassDashHours()) return { error: "outside_hours" };

  const { link, error } = await loadActiveLink(sb, token);
  if (error || !link) return { error: error || "invalid_link" };

  const classErr = await assertClassActive(sb, link.target_class);
  if (classErr) return { error: classErr };

  if (!ipAllowed(clientIpFromReq(req), link.allowed_cidrs)) {
    return { error: "access_denied" };
  }

  return { link, valid_until: getClassDashWindowEndISO() || undefined };
}

async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return json({ error: "access_denied" }, 401);

  const metaRole =
    (data.user.app_metadata as any)?.role ||
    (data.user.user_metadata as any)?.role;

  const sb = serviceClient();
  const { data: profile } = await sb
    .from("users")
    .select("id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = profile?.role || metaRole;
  if (role !== "admin") return json({ error: "access_denied" }, 403);
  return { userId: data.user.id };
}

async function handleManage(
  sb: SupabaseClient,
  req: Request,
  body: any,
): Promise<Response> {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const targetClass = String(body.target_class || "").trim();
  if (!targetClass) return json({ error: "action_rejected", message: "target_class required" }, 400);

  const action = body.action as string;

  if (action === "get") {
    const { data } = await sb
      .from("shared_links")
      .select("id, token, target_class, is_active, created_at, rotated_at, allowed_cidrs")
      .eq("type", "class_dashboard")
      .eq("target_class", targetClass)
      .eq("is_active", true)
      .maybeSingle();
    return json({ link: data || null });
  }

  if (action === "generate") {
    const { data: existing } = await sb
      .from("shared_links")
      .select("id, token, target_class, is_active, created_at, rotated_at")
      .eq("type", "class_dashboard")
      .eq("target_class", targetClass)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) return json({ link: existing });

    const { data, error } = await sb
      .from("shared_links")
      .insert({
        type: "class_dashboard",
        target_class: targetClass,
        is_active: true,
        created_by: admin.userId,
      })
      .select("id, token, target_class, is_active, created_at, rotated_at")
      .single();
    if (error) return json({ error: "action_rejected", message: error.message }, 500);
    return json({ link: data });
  }

  if (action === "regenerate") {
    await sb
      .from("shared_links")
      .update({ is_active: false })
      .eq("type", "class_dashboard")
      .eq("target_class", targetClass)
      .eq("is_active", true);

    const { data, error } = await sb
      .from("shared_links")
      .insert({
        type: "class_dashboard",
        target_class: targetClass,
        is_active: true,
        created_by: admin.userId,
        rotated_at: new Date().toISOString(),
      })
      .select("id, token, target_class, is_active, created_at, rotated_at")
      .single();
    if (error) return json({ error: "action_rejected", message: error.message }, 500);
    return json({ link: data });
  }

  if (action === "disable") {
    const { error } = await sb
      .from("shared_links")
      .update({ is_active: false })
      .eq("type", "class_dashboard")
      .eq("target_class", targetClass)
      .eq("is_active", true);
    if (error) return json({ error: "action_rejected", message: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "action_rejected", message: "Unknown manage action" }, 400);
}

async function handleBootstrap(
  sb: SupabaseClient,
  req: Request,
  body: any,
): Promise<Response> {
  const access = await validateTokenAccess(sb, String(body.token || ""), req);
  if (access.error || !access.link) return json({ error: access.error || "invalid_link" }, 403);

  const targetClass = access.link.target_class;

  const { data: users, error } = await sb
    .from("users")
    .select(
      "id, username, display_name, role, class, class_number, created_at, ecas, avatar_url",
    )
    .eq("class", targetClass)
    .eq("role", "user")
    .order("class_number", { ascending: true });

  if (error) return json({ error: "action_rejected", message: error.message }, 500);

  const ids = (users || []).map((u: any) => u.id);
  let roomByUser: Record<string, any> = {};
  if (ids.length > 0) {
    const { data: rooms } = await sb
      .from("user_room_data")
      .select("*")
      .in("user_id", ids);
    for (const row of rooms || []) {
      roomByUser[row.user_id] = row;
    }
  }

  const enriched = (users || []).map((u: any) => {
    const room = roomByUser[u.id] || {};
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      role: u.role,
      class: u.class,
      class_number: u.class_number,
      created_at: u.created_at,
      ecas: u.ecas || [],
      avatar_url: u.avatar_url || room.avatar_url || null,
      coins: room.coins ?? 0,
      virtual_coins: room.virtual_coins ?? 0,
      toilet_coins: room.toilet_coins ?? 100,
      daily_counts: room.daily_counts || null,
      morning_status: room.morning_status || "todo",
      last_morning_update: room.last_morning_update || null,
      equipped_item_ids: room.equipped_item_ids || [],
      custom_offsets: room.custom_offsets || null,
      consequence_count: room.consequence_count || 0,
    };
  });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const { data: homework } = await sb
    .from("daily_homework")
    .select("*")
    .eq("class_name", targetClass)
    .eq("date", today)
    .maybeSingle();

  const { data: morningLogs } = await sb
    .from("morning_duty_logs")
    .select("*")
    .eq("class", targetClass)
    .eq("log_date", today);

  return json({
    target_class: targetClass,
    valid_until: access.valid_until,
    link_id: access.link.id,
    users: enriched,
    daily_homework: homework || null,
    morning_duty_logs: morningLogs || [],
  });
}

async function assertStudentInClass(
  sb: SupabaseClient,
  userId: string,
  targetClass: string,
): Promise<boolean> {
  const { data } = await sb
    .from("users")
    .select("id, class")
    .eq("id", userId)
    .maybeSingle();
  return !!data && data.class === targetClass;
}

async function handleAction(
  sb: SupabaseClient,
  req: Request,
  body: any,
): Promise<Response> {
  const access = await validateTokenAccess(sb, String(body.token || ""), req);
  if (access.error || !access.link) return json({ error: access.error || "invalid_link" }, 403);

  const targetClass = access.link.target_class;
  const action = String(body.action || "");
  const payload = body.payload || {};
  const sourceMeta = `class_dash_link:${access.link.id}`;

  try {
    if (action === "award_coins") {
      const userId = String(payload.userId || "");
      const amount = Number(payload.amount);
      const reason = String(payload.reason || "Class Dashboard");
      if (!userId || Number.isNaN(amount)) {
        return json({ error: "action_rejected", message: "userId and amount required" }, 400);
      }
      if (!(await assertStudentInClass(sb, userId, targetClass))) {
        return json({ error: "access_denied", message: "Student not in class" }, 403);
      }
      const { error } = await sb.rpc("increment_room_coins", {
        target_user_id: userId,
        amount,
        log_reason: `${reason} [${sourceMeta}]`,
        log_admin_id: null,
        p_batch_id: payload.batchId || null,
        p_skip_daily_count: !!payload.skipDailyCount,
      });
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true });
    }

    if (action === "insert_record") {
      const studentId = String(payload.studentId || "");
      if (!studentId) return json({ error: "action_rejected", message: "studentId required" }, 400);
      if (!(await assertStudentInClass(sb, studentId, targetClass))) {
        return json({ error: "access_denied", message: "Student not in class" }, 403);
      }
      const { data, error } = await sb
        .from("student_records")
        .insert({
          student_id: studentId,
          message: String(payload.message || ""),
          type: String(payload.type || "log"),
          record_type: payload.record_type || "log",
          source: sourceMeta,
          target_classes: [targetClass],
          created_by: null,
        })
        .select("id")
        .single();
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true, id: data.id });
    }

    if (action === "upsert_daily_homework") {
      const date = String(payload.date || "");
      const assignments = payload.assignments;
      if (!date) return json({ error: "action_rejected", message: "date required" }, 400);
      const { error } = await sb.from("daily_homework").upsert(
        {
          class_name: targetClass,
          date,
          assignments: assignments ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "class_name,date" },
      );
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true });
    }

    if (action === "morning_duty") {
      const studentId = String(payload.student_id || payload.studentId || "");
      if (!studentId) return json({ error: "action_rejected", message: "student_id required" }, 400);
      if (!(await assertStudentInClass(sb, studentId, targetClass))) {
        return json({ error: "access_denied", message: "Student not in class" }, 403);
      }
      const logDate = String(payload.p_date || payload.p_log_date || payload.date || "");
      const status = String(payload.p_status || payload.status || "submitted");
      if (!logDate) return json({ error: "action_rejected", message: "date required" }, 400);

      const { error } = await sb.from("morning_duty_logs").upsert(
        {
          log_date: logDate,
          student_id: studentId,
          class: targetClass,
          status,
          missing_items: payload.p_missing_items || payload.missing_items || null,
          notes: `${payload.p_notes || payload.notes || ""} [${sourceMeta}]`.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "log_date,student_id" },
      );
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true });
    }

    if (action === "revert_homework_record") {
      const { error } = await sb.rpc("revert_homework_record", {
        p_record_ids: payload.p_record_ids || payload.recordIds,
      });
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true });
    }

    if (action === "deduct_toilet_coins") {
      const userId = String(payload.userId || "");
      if (!userId) return json({ error: "action_rejected", message: "userId required" }, 400);
      if (!(await assertStudentInClass(sb, userId, targetClass))) {
        return json({ error: "access_denied", message: "Student not in class" }, 403);
      }
      const { error } = await sb.rpc("deduct_toilet_coins", {
        p_user_id: userId,
        p_amount: Number(payload.amount ?? 20),
      });
      if (error) return json({ error: "action_rejected", message: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "action_rejected", message: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    return json({ error: "action_rejected", message: err?.message || "Unknown error" }, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");
    const sb = serviceClient();

    if (op === "validate") {
      const access = await validateTokenAccess(sb, String(body.token || ""), req);
      if (access.error || !access.link) {
        return json({ error: access.error || "invalid_link" }, 403);
      }
      return json({
        target_class: access.link.target_class,
        valid_until: access.valid_until,
        link_id: access.link.id,
      });
    }

    if (op === "manage") return await handleManage(sb, req, body);
    if (op === "bootstrap") return await handleBootstrap(sb, req, body);
    if (op === "action") return await handleAction(sb, req, body);

    return json({ error: "action_rejected", message: "Unknown op" }, 400);
  } catch (err: any) {
    console.error("class-dash error:", err);
    return json({ error: "action_rejected", message: err?.message || "Fatal error" }, 500);
  }
});
