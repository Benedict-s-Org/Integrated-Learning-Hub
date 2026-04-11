import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DB_QUESTIONS = "d7ea40d03cde4e54b8a6226ac75130cc";
const DB_RUNS = "9e203ecf9a7946cc8051f0b59329620f";
const DB_RESPONSES = "e6d90d25cb7d4ee8938f2e2c61a93d38";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-action",
  "Vary": "Origin",
};

function createCORSResponse(body: unknown, status = 200, req?: Request) {
  const origin = req?.headers.get("origin") || "*";
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

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
    return new Response(null, { 
      status: 204, 
      headers: { 
        ...corsHeaders, 
        "Access-Control-Allow-Origin": req.headers.get("origin") || "*" 
      } 
    });
  }

  if (!checkRateLimit(req)) {
    return createCORSResponse({ error: "Too many requests" }, 429, req);
  }

  try {
    const notionToken = Deno.env.get("NOTION_TOKEN");
    if (!notionToken) throw new Error("Missing NOTION_TOKEN environment variable");

    const url = new URL(req.url);
    
    // Robust action detection
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const action = req.headers.get("x-action") || body.action || url.searchParams.get("action");

    // ── 0. PING ────────────────────────────────────────────────────────
    if (action === "ping") {
      return createCORSResponse({ 
        status: "v5-active", 
        detectedAction: action, 
        reqUrl: req.url,
        method: req.method
      }, 200, req);
    }

    // ── 1. action=questions ────────────────────────────────────────────
    if (action === "questions") {
      const tier = url.searchParams.get("tier");
      const activeParam = url.searchParams.get("active");
      const isActive = activeParam !== "false";
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      // Allow caller to override the DB; fall back to hardcoded default
      const questionDbId = url.searchParams.get("databaseId") || DB_QUESTIONS;

      // Helper for Notion pagination
      const fetchAllResults = async (databaseId: string) => {
        let results: any[] = [];
        let hasMore = true;
        let cursor: string | undefined = undefined;

        while (hasMore) {
          const resp = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
            method: "POST",
            headers: notionHeaders(notionToken),
            body: JSON.stringify({ 
              page_size: 100,
              start_cursor: cursor
            })
          });

          if (!resp.ok) {
            throw new Error(`Notion API Error: ${resp.status} ${await resp.text()}`);
          }

          const data = await resp.json();
          results = [...results, ...data.results];
          hasMore = data.has_more;
          cursor = data.next_cursor;

          // Safety break to prevent infinite loops (max 10 pages for 1000 items)
          if (results.length >= 1000) break;
        }
        return results;
      };

      try {
        const results = await fetchAllResults(questionDbId);
        const allResults = results.map((page: any) => {
          const props = page.properties;
          return {
            questionPageUrl: page.url,
            questionId: page.id,
            letters: props["Letters"]?.title?.[0]?.plain_text || "",
            validAnswers: props["Valid answers"]?.multi_select?.map((s: any) => s.name) || [],
            tier: props["Tier"]?.select?.name || "",
            active: props["Active"]?.checkbox ?? false,
            length: props["Length 1"]?.formula?.number ?? 0
          };
        });

        const filtered = allResults.filter((q: any) => {
          const matchesActive = q.active === isActive;
          const matchesTier = !tier || q.tier.toLowerCase() === tier.toLowerCase();
          return matchesActive && matchesTier;
        }).slice(0, limit);

        if (filtered.length === 0) {
          return createCORSResponse({ 
             error: "No questions found", 
             tierRequested: tier,
             availableTiers: Array.from(new Set(allResults.map((r: any) => r.tier))),
          }, 404, req);
        }

        return createCORSResponse(filtered, 200, req);
      } catch (err: any) {
        return createCORSResponse({ error: "Failed to fetch from Notion", details: err.message }, 500, req);
      }
    }

    // ── 2. action=run ──────────────────────────────────────────────────
    if (action === "run" && req.method === "POST") {
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
        await fetch(`${NOTION_API}/pages`, {
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
      }

      return createCORSResponse({
        runPageUrl: runPage.url,
        runPageId: runPage.id
      }, 200, req);
    }

    // ── 3. action=setup-relations ──────────────────────────────────────
    if (action === "setup-relations") {
      const resp = await fetch(`${NOTION_API}/databases/${DB_RESPONSES}`, {
        method: "GET",
        headers: notionHeaders(notionToken)
      });
      const db = await resp.json();
      const currentProps = db.properties || {};
      
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
        return createCORSResponse({ success: true, message: "Relations updated." }, 200, req);
      }

      return createCORSResponse({ success: true, message: "Relations already exist." }, 200, req);
    }

    // ── 4. action=update-answers ─────────────────────────────────────────
    if (action === "update-answers" && req.method === "POST") {
      const { pageId, answers } = body;

      if (!pageId || !Array.isArray(answers) || answers.length === 0) {
        return createCORSResponse(
          { error: "Missing required fields: pageId (string) and answers (string[])" },
          400, req
        );
      }

      // Build the multi_select array from the provided answer strings
      const multiSelectValues = answers.map((a: string) => ({ name: a }));

      const patchResp = await fetch(`${NOTION_API}/pages/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          properties: {
            "Valid answers": {
              multi_select: multiSelectValues,
            },
          },
        }),
      });

      if (!patchResp.ok) {
        const errText = await patchResp.text();
        return createCORSResponse(
          { error: "Notion update failed", details: errText },
          500, req
        );
      }

      const patchData = await patchResp.json();
      return createCORSResponse(
        { success: true, pageId, updatedAnswers: answers, notionUrl: patchData.url },
        200, req
      );
    }

    return createCORSResponse({ error: `Invalid action: ${action}`, url: req.url }, 404, req);
    
  } catch (error: any) {
    return createCORSResponse({ error: error.message }, 500, req);
  }
});
