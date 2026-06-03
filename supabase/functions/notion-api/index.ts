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

    // Fetch notion_database_ids from system_config
    let notionDbConfig: any = null;
    try {
      const { data: configData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'notion_database_ids')
        .single();
      if (configData?.value) {
        notionDbConfig = JSON.parse(configData.value);
      }
    } catch (err) {
      console.error("[notion-api] Error fetching database IDs from system_config:", err);
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authUser) {
      console.error("[notion-api] Auth error:", {
        message: authError?.message,
        status: authError?.status,
        tokenPrefix: token ? `${token.substring(0, 5)}...` : 'none'
      });
      return createCORSResponse({ 
        error: "Unauthorized: Invalid token", 
        details: authError?.message 
      }, 401, req);
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
      const helpDbId = notionDbConfig?.help_db_id || Deno.env.get("NOTION_HELP_DATABASE_ID") || "2647f405a5a14e9fa6660dc164a3e502";
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
      const dateDbId = notionDbConfig?.cycle_day_db_id || "2579baca6fa3806f9c6ef193f7d81213";
      
      // Calculate HK Today String robustly
      const now = new Date();
      const hkOffset = 8 * 60 * 60 * 1000;
      const hkDateStr = new Date(now.getTime() + hkOffset).toISOString().split("T")[0];
      
      console.log(`[notion-api] Querying Date DB for: ${hkDateStr}`);

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

      if (!resp.ok) {
        const errJson = await resp.json();
        console.error(`[notion-api] Notion Query Failed:`, errJson);
        return createCORSResponse(errJson, resp.status, req);
      }
      
      const data = await resp.json();
      
      if (data.results && data.results.length > 0) {
        const page = data.results[0];
        const props = page.properties;
        
        // Log keys for debugging if something is missing
        console.log(`[notion-api] Found page props: ${Object.keys(props).join(", ")}`);

        // Helper to get property value regardless of name casing or slight variations
        const getPropValue = (names: string[]) => {
          for (const name of names) {
            const p = props[name];
            if (p) {
              if (p.type === 'select') return p.select?.name;
              if (p.type === 'number') return p.number;
              if (p.type === 'rich_text') return p.rich_text?.[0]?.plain_text;
              if (p.type === 'title') return p.title?.[0]?.plain_text;
              if (p.type === 'date') return p.date?.start;
              if (p.type === 'formula') {
                  if (p.formula.type === 'string') return p.formula.string;
                  if (p.formula.type === 'number') return p.formula.number;
              }
            }
          }
          return null;
        };

        const cycleDay = getPropValue(["Day of the cycle", "Day", "Cycle Day"]);
        const cycleNumber = getPropValue(["Cycle", "Cycle Number"]);
        const studentOnDuty = getPropValue(["Student on Duty", "Student on duty", "Duty Student"]);
        const notionDate = getPropValue(["Date"]);
        
        const isHoliday = cycleDay === "Holiday" || cycleDay === "Holiday Mode";
        
        console.log(`[notion-api] Resolved: Day=${cycleDay}, Cycle=${cycleNumber}, Student=${studentOnDuty}, Holiday=${isHoliday}`);

        return createCORSResponse({
          found: true,
          cycleDay: cycleDay || '-',
          cycleNumber: cycleNumber || '-',
          studentOnDuty: studentOnDuty ?? '-',
          date: notionDate || hkDateStr,
          isHoliday: isHoliday
        }, 200, req);
      }
      
      console.warn(`[notion-api] No results found for date: ${hkDateStr}`);
      return createCORSResponse({ found: false, searchDate: hkDateStr }, 200, req);
    }


    // ── 2. query-mcq-database / list-activities ───────────────────────
    if (action === "query-mcq-database" || action === "list-activities") {
      const targetDbId = dbId || notionDbConfig?.reading_pdfs_db_id || "3239baca6fa380a9b501deceb133946d";
      
      let allResults = [];
      let hasMore = true;
      let cursor = undefined;

      while (hasMore) {
        const resp = await fetch(`${NOTION_API}/databases/${targetDbId}/query`, {
          method: "POST",
          headers: notionHeaders(notionToken),
          body: JSON.stringify({ 
            page_size: 100,
            start_cursor: cursor
          }),
        });
        
        if (!resp.ok) {
          const err = await resp.json();
          console.error(`[notion-api] Notion Query Failed during pagination:`, err);
          return createCORSResponse(err, resp.status, req);
        }

        const data = await resp.json();
        const results = data.results || [];
        allResults.push(...results);
        hasMore = data.has_more;
        cursor = data.next_cursor;

        console.log(`[notion-api] Fetched page. Current total: ${allResults.length}, Has more: ${hasMore}`);

        // Safety break to prevent infinite loops (e.g. max 2000 items)
        if (allResults.length > 2000) {
          console.warn(`[notion-api] Pagination reached safety limit of 2000 items.`);
          break;
        }
      }

      return createCORSResponse({ results: allResults }, 200, req);
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

    // ── 4. update-page-properties ─────────────────────────────────────
    if (action === "update-page-properties") {
      const pageId = body.pageId;
      if (!pageId) return createCORSResponse({ error: "Missing pageId" }, 400, req);
      
      const resp = await fetch(`${NOTION_API}/pages/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          properties: body.properties
        })
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    }

    return createCORSResponse({ error: `Unknown action: ${action}`, version: VERSION }, 404, req);
  } catch (error) {
    return createCORSResponse({ error: error.message }, 500, req);
  }
});