import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-action, x-database-id",
  "Vary": "Origin",
};

function createCORSResponse(body: unknown, status = 200, req?: Request) {
  const origin = req?.headers.get("origin");
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
  };
  return new Response(body instanceof ReadableStream ? body : JSON.stringify(body), { status, headers });
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin || "*" } });
  }

  try {
    const notionToken = Deno.env.get("NOTION_TOKEN");
    if (!notionToken) return createCORSResponse({ error: "Missing NOTION_TOKEN" }, 500, req);

    const VERSION = "1.2.1-generic";
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    
    // Standardized Auth Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createCORSResponse({ error: "Unauthorized: Missing Authorization header" }, 401, req);
    }

    const token = authHeader.replace("Bearer ", "");
    // Initialize Supabase for auth check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authUser) {
      console.error("[notion-api] Auth error:", authError);
      return createCORSResponse({ error: "Unauthorized: Invalid token", details: authError?.message }, 401, req);
    }

    let body: any = {};
    if (req.method === "POST" || req.method === "PUT") {
      try { body = await req.json(); } catch { /* ignore */ }
    }
    
    const action = req.headers.get("x-action") || body.action || url.searchParams.get("action") || path.split("/").pop();
    const dbId = req.headers.get("x-database-id") || body.databaseId || url.searchParams.get("databaseId");

    console.log(`[notion-api] [${VERSION}] Action: ${action}, User: ${authUser.email}`);

    // ── 0. save-unknown ───────────────────────────────────────────────
    if (action === "save-unknown") {
      const helpDbId = Deno.env.get("NOTION_HELP_DATABASE_ID") || "2647f405a5a14e9fa6660dc164a3e502";
      const resp = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          parent: { database_id: helpDbId },
          properties: {
            "Name": { title: [{ text: { content: body.text || "Unknown Item" } }] },
            "Type": { select: { name: body.type || "Word" } },
            "Source Context": { rich_text: [{ text: { content: body.context || "" } }] },
            "Learning Set": { rich_text: [{ text: { content: body.setId || "" } }] },
            "User": { rich_text: [{ text: { content: body.userName || "Anonymous" } }] },
            "Date Added": { date: { start: new Date().toISOString() } }
          }
        })
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    }

    // ── 1. get-cycle-day ──────────────────────────────────────────────
    if (action === "get-cycle-day") {
      const dateDbId = "2579baca6fa3806f9c6ef193f7d81213";
      const now = new Date();
      const hkOffset = 8 * 60 * 60 * 1000;
      const hkDateStr = new Date(now.getTime() + hkOffset).toISOString().split("T")[0];

      const resp = await fetch(`${NOTION_API}/databases/${dateDbId}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          filter: {
            property: "Date",
            date: { equals: hkDateStr }
          }
        })
      });

      if (!resp.ok) return createCORSResponse(await resp.json(), resp.status, req);
      const data = await resp.json();
      
      if (data.results && data.results.length > 0) {
        const page = data.results[0];
        const props = page.properties;
        return createCORSResponse({
          found: true,
          cycleDay: props["Day of the cycle"]?.select?.name,
          cycleNumber: props["Cycle"]?.select?.name,
          studentOnDuty: props["Student on Duty"]?.number,
          date: props["Date"]?.date?.start
        }, 200, req);
      }
      return createCORSResponse({ found: false, searchDate: hkDateStr }, 200, req);
    }

    // ── 2. query-mcq-database / list-activities ───────────────────────
    if (action === "query-mcq-database" || action === "list-activities") {
      const targetDbId = dbId || "3239baca6fa380a9b501deceb133946d";
      const resp = await fetch(`${NOTION_API}/databases/${targetDbId}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({ page_size: 100 }),
      });
      return createCORSResponse(await resp.json(), resp.status, req);
    }

    // ── 3. list-all-databases (Internal/Debug) ────────────────────────
    if (action === "list-all-databases") {
      const resp = await fetch(`${NOTION_API}/search`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          filter: { property: "object", value: "database" },
          page_size: 100
        }),
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    }

    return createCORSResponse({ error: `Unknown action: ${action}`, version: VERSION }, 404, req);
  } catch (error) {
    return createCORSResponse({ error: error.message }, 500, req);
  }
});