import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DB_QUESTIONS = "d7ea40d03cde4e54b8a6226ac75130cc";
const DB_RUNS = "9e203ecf9a7946cc8051f0b59329620f";
const DB_RESPONSES = "e6d90d25cb7d4ee8938f2e2c61a93d38";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Vary": "Origin",
  "Access-Control-Allow-Origin": "*",
};

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Simple In-Memory Rate Limiter
const rateLimits = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 100;

function checkRateLimit(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown-ip";
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.expiresAt) {
    rateLimits.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= MAX_REQUESTS) return false;
  record.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!checkRateLimit(req)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { 
      status: 429, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const notionToken = Deno.env.get("NOTION_TOKEN");
    if (!notionToken) throw new Error("Missing NOTION_TOKEN environment variable");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ==========================================
    // GET /?action=questions
    // ==========================================
    if (req.method === "GET" && action === "questions") {
      const tier = url.searchParams.get("tier");
      const activeParam = url.searchParams.get("active");
      const isActive = activeParam !== "false";
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);

      const filter: any = {
        and: [{ property: "Active", checkbox: { equals: isActive } }]
      };
      if (tier) {
        filter.and.push({ property: "Tier", select: { equals: tier } });
      }

      console.log(`[questions] Querying Tier: ${tier}, Active: ${isActive}`);

      const resp = await fetch(`${NOTION_API}/databases/${DB_QUESTIONS}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          filter,
          page_size: limit,
        })
      });

      if (!resp.ok) {
        const err = await resp.json();
        return new Response(JSON.stringify({ error: "Notion API Error", details: err }), { 
          status: resp.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const data = await resp.json();
      console.log("!!! NOTION DATA !!!", JSON.stringify(data, null, 2));

      if (data.results.length === 0) {
          return new Response(JSON.stringify({ 
              error: "V3_DEBUG: No questions found", 
              queriedTier: tier,
              fullResponse: data
          }), { 
              status: 404, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
      }

      const results = data.results.map((page: any) => {
        const props = page.properties;
        return {
          questionPageUrl: page.url,
          questionId: page.id,
          letters: props["Letters"]?.title?.[0]?.plain_text || "",
          validAnswers: props["Valid answers"]?.multi_select?.map((s: any) => s.name) || [],
          tier: props["Tier"]?.select?.name || "",
          length: props["Length 1"]?.formula?.number ?? 0
        };
      });

      return new Response(JSON.stringify(results), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // ==========================================
    // POST /?action=run
    // ==========================================
    if (req.method === "POST" && action === "run") {
      const body = await req.json();
      const { responses = [], ...runData } = body;

      const runResp = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          parent: { database_id: DB_RUNS },
                    properties: {
            "Run ID": { title: [{ text: { content: runData.runId || "Unknown" } }] },
            "Participant ID": { rich_text: [{ text: { content: runData.participantId || "" } }] },
            "Task Version": { select: { name: runData.taskVersion || "v1" } },
            "Started At": { date: { start: runData.startedAt || new Date().toISOString() } },
            "Finished At": runData.finishedAt ? { date: { start: runData.finishedAt } } : undefined,
            "Total Duration (ms)": { number: runData.totalDurationMs || 0 },
            "Completed": { checkbox: runData.completed || false },
            "Calib Pred (sec)": { number: runData.calibrationPredSec || 0 },
            "Calib Actual (sec)": { number: runData.calibrationActualSec || 0 },
            "Easy Pred (sec)": { number: runData.easyPredSec || 0 },
            "Easy Actual (sec)": { number: runData.easyActualSec || 0 },
            "Hard Pred (sec)": { number: runData.hardPredSec || 0 },
            "Hard Actual (sec)": { number: runData.hardActualSec || 0 },
            "Device / Browser": { rich_text: [{ text: { content: runData.deviceBrowser || "" } }] },
            "Notes": { rich_text: [{ text: { content: runData.notes || "" } }] },
          }
        })
      });

      if (!runResp.ok) throw new Error(`Run Create Error: ${await runResp.text()}`);
      const runPage = await runResp.json();

      const responseUrls: string[] = [];
      for (const res of responses) {
        const respPageResp = await fetch(`${NOTION_API}/pages`, {
          method: "POST",
          headers: notionHeaders(notionToken),
          body: JSON.stringify({
            parent: { database_id: DB_RESPONSES },
            properties: {
              "Response ID": { title: [{ text: { content: res.responseId || `resp_${Date.now()}` } }] },
              "Block": { select: { name: res.block || "Unknown" } },
              "Position": { number: res.position || 0 },
              "Letters Shown": { rich_text: [{ text: { content: res.lettersShown || "" } }] },
              "Word Length": { number: res.wordLength || 0 },
              "Answer Typed": { rich_text: [{ text: { content: res.answerTyped || "" } }] },
              "Is Correct": { checkbox: res.isCorrect || false },
              "Skipped": { checkbox: res.skipped || false },
              "Attempts": { number: res.attempts || 1 },
              "Time Taken (ms)": { number: res.timeTakenMs || 0 },
              "Submitted At": res.submittedAt ? { date: { start: res.submittedAt } } : undefined,
              "Valid Answers Snapshot": { rich_text: [{ text: { content: res.validAnswersSnapshot || "" } }] },
              "Run": { relation: [{ id: runPage.id }] },
              ...(res.questionId ? { "Question": { relation: [{ id: res.questionId }] } } : {})
            }
          })
        });
        if (respPageResp.ok) {
          const p = await respPageResp.json();
          responseUrls.push(p.url);
        }
      }

      return new Response(JSON.stringify({
        runPageUrl: runPage.url,
        runPageId: runPage.id,
        responsePageUrls: responseUrls
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // POST /?action=setup-relations
    // ==========================================
    if (req.method === "POST" && action === "setup-relations") {
      const resp = await fetch(`${NOTION_API}/databases/${DB_RESPONSES}`, {
        method: "GET",
        headers: notionHeaders(notionToken)
      });
      const responsesDb = await resp.json();
      let currentProps = responsesDb.properties || {};
      
      const propertiesToUpdate: any = {};
      const setups = [
        { propName: "Run", targetDbId: DB_RUNS, syncedPropName: "Responses" },
        { propName: "Question", targetDbId: DB_QUESTIONS, syncedPropName: "Responses" }
      ];

      for (const config of setups) {
        if (!currentProps[config.propName]) {
          propertiesToUpdate[config.propName] = {
            relation: {
              database_id: config.targetDbId,
              type: "dual_property",
            dual_property: { synced_property_name: config.syncedPropName }
            }
          };
        }
      }

      if (Object.keys(propertiesToUpdate).length > 0) {
        await fetch(`${NOTION_API}/databases/${DB_RESPONSES}`, {
          method: "PATCH",
          headers: notionHeaders(notionToken),
          body: JSON.stringify({ properties: propertiesToUpdate })
        });
        return new Response(JSON.stringify({ success: true, message: "Relations updated." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, message: "Relations already exist." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
