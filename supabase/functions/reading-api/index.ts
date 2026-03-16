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

    const VERSION = "1.0.2-routing-fix";
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    let body: any = {};
    if (req.method === "POST" || req.method === "PUT") {
      try { body = await req.json(); } catch { /* ignore */ }
    }
    
    // Priority: Header > Body > Query Param > Path Suffix (if not function name)
    let action = req.headers.get("x-action") || body.action || url.searchParams.get("action");
    if (!action && pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart !== "reading-api") {
        action = lastPart;
      }
    }

    const dbId = req.headers.get("x-database-id") || body.databaseId || url.searchParams.get("databaseId") || "3239baca6fa380a9b501deceb133946d";

    console.log(`[reading-api] [${VERSION}] Action: ${action}, DB ID: ${dbId}`);

    // ── -1. Get DB Schema (Debug) ───────────────────────────────────
    if (action === "get-db-schema") {
      const resp = await fetch(`${NOTION_API}/databases/${dbId}`, {
        method: "GET",
        headers: notionHeaders(notionToken),
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    } 
    // ── 0. Create Reading Database ─────────────────────────────────────
    else if (action === "create-reading-database") {
      const parentId = body.parentId || "2bbb40ca89b6441bb69bd8e0b115af03";
      const resp = await fetch(`${NOTION_API}/databases`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          parent: { type: "page_id", page_id: parentId },
          title: [{ type: "text", text: { content: "Reading Practice Questions" } }],
          properties: {
            "Question": { title: {} },
            "Source PDF": { relation: { database_id: "3239baca6fa380a9b501deceb133946d", single_property: {} } },
            "Page Number": { number: {} },
            "Crop X": { number: {} },
            "Crop Y": { number: {} },
            "Crop W": { number: {} },
            "Crop H": { number: {} },
            "Units": { select: { options: [{ name: "normalized", color: "blue" }] } },
            "Notes": { rich_text: {} }
          }
        }),
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    }
    // ── 1. List Reading PDFs / list-activities ────────────────────────
    else if (action === "list-reading-pdfs" || action === "list-activities") {
      const resp = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({ page_size: 100 }),
      });
      if (!resp.ok) return createCORSResponse(await resp.json(), resp.status, req);
      const data = await resp.json();
      
      const results = (data.results || []).map((p: any) => {
        const props = p.properties || {};
        
        // Robust name extraction
        const name = 
          props["名稱"]?.title?.[0]?.plain_text || 
          props["Name"]?.title?.[0]?.plain_text || 
          props["Title"]?.title?.[0]?.plain_text || 
          "Untitled";
          
        // Robust PDF/File extraction
        let fileUrl = null;
        const fileProp = props["Attachment"] || props["Source PDF"] || props["PDF"] || props["File"];
        if (fileProp?.files?.[0]) {
          fileUrl = fileProp.files[0].file?.url || fileProp.files[0].external?.url;
        } else if (fileProp?.url) {
          fileUrl = fileProp.url;
        }

        return {
          id: p.id,
          pageId: p.id,
          name,
          fileUrl,
          pdfUrl: fileUrl // Compatibility
        };
      });

      return createCORSResponse({ 
        results, 
        activities: results, 
        version: VERSION,
        debug: {
          databaseId: dbId,
          rowCount: results.length,
          sample: results[0] ? { name: results[0].name, hasUrl: !!results[0].fileUrl } : null
        }
      }, 200, req);
    }
    // ── 2. Proxy Reading PDF ───────────────────────────────────────────
    else if (action === "proxy-reading-pdf") {
      const pdfUrl = url.searchParams.get("url") || body.url;
      if (!pdfUrl) return createCORSResponse({ error: "Missing url" }, 400, req);
      const resp = await fetch(pdfUrl);
      if (!resp.ok) return createCORSResponse({ error: "Failed to fetch PDF" }, resp.status, req);
      const { readable, writable } = new TransformStream();
      resp.body?.pipeTo(writable);
      const headers: Record<string, string> = {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin || "*",
        "Content-Type": "application/pdf",
      };
      return new Response(readable, { status: 200, headers });
    }
    // ── 3. Create Reading Question ─────────────────────────────────────
    else if (action === "create-reading-question") {
      const qDbId = body.questionsDatabaseId || Deno.env.get("NOTION_QUESTIONS_DATABASE_ID") || "3249baca6fa381f18526ca44ce27447c";
      if (!qDbId) return createCORSResponse({ error: "Missing target database ID" }, 400, req);

      const resp = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          parent: { database_id: qDbId },
          properties: {
            "Question": { title: [{ text: { content: body.title || "New Question" } }] },
            "Source PDF": { relation: [{ id: body.sourcePageId }] },
            "Page Number": { number: body.pageNumber },
            "Crop X": { number: body.crop.x },
            "Crop Y": { number: body.crop.y },
            "Crop W": { number: body.crop.w },
            "Crop H": { number: body.crop.h },
            "Units": { select: { name: "normalized" } },
            "Notes": { rich_text: [{ text: { content: body.notes || "" } }] }
          }
        })
      });
      const data = await resp.json();
      return createCORSResponse(data, resp.status, req);
    }
    // ── 4. List Page Questions ─────────────────────────────────────────
    else if (action === "list-page-questions") {
      const qDbId = body.questionsDatabaseId || Deno.env.get("NOTION_QUESTIONS_DATABASE_ID") || "3249baca6fa381f18526ca44ce27447c";
      const { sourcePageId, pageNumber } = body;
      
      if (!sourcePageId || !pageNumber) {
        return createCORSResponse({ error: "Missing sourcePageId or pageNumber" }, 400, req);
      }

      console.log(`[reading-api] Querying questions for page ${pageNumber} of PDF ${sourcePageId} in DB ${qDbId}`);

      // First, get the database schema to find the correct property names
      const schemaResp = await fetch(`${NOTION_API}/databases/${qDbId}`, {
        method: "GET",
        headers: notionHeaders(notionToken),
      });
      if (!schemaResp.ok) return createCORSResponse({ error: "Failed to fetch DB schema", detail: await schemaResp.json() }, schemaResp.status, req);
      const schema = await schemaResp.json();
      const props = schema.properties || {};

      // Find the best matching properties
      const findProp = (possibleNames: string[]) => 
        Object.keys(props).find(p => possibleNames.includes(p.toLowerCase()));

      const questionProp = findProp(["question", "問題", "題目", "name", "名稱"]);
      const sourcePdfProp = findProp(["source pdf", "來源檔案", "pdf", "file", "檔案", "day", "日期"]);
      const pageNumberProp = findProp(["page number", "頁碼", "頁面", "page"]);
      const answerProp = findProp(["answer", "答案", "correct answer", "正確答案", "choice a"]);

      if (!sourcePdfProp || !pageNumberProp) {
        return createCORSResponse({ 
          error: "Missing required properties in Notion DB", 
          required: ["Source PDF", "Page Number"],
          found: Object.keys(props),
          hint: "Ensure your Notion database has columns named 'Source PDF' (Relation) and 'Page Number' (Number)."
        }, 400, req);
      }

      const sourcePdfType = props[sourcePdfProp]?.type;
      const pageNumberType = props[pageNumberProp]?.type;

      // Build the filter dynamically based on property types
      const andFilters: any[] = [];

      // 1. Source/PDF/Day Filter
      if (sourcePdfType === 'relation') {
        andFilters.push({ property: sourcePdfProp, relation: { contains: sourcePageId } });
      } else if (sourcePdfType === 'number' || sourcePdfType === 'select') {
        // Fallback: If it's a number/select, try to find by title/name of the source page
        // or just skip if we don't have a numeric ID (though usually sourcePageId is UUID)
        // For now, if it's a relation we match it, otherwise we might need a different linker
      }

      // 2. Page Number Filter
      if (pageNumberType === 'number') {
        andFilters.push({ property: pageNumberProp, number: { equals: parseInt(pageNumber) } });
      } else if (pageNumberType === 'select' || pageNumberType === 'rich_text') {
        andFilters.push({ property: pageNumberProp, [pageNumberType]: { equals: pageNumber.toString() } });
      }

      const resp = await fetch(`${NOTION_API}/databases/${qDbId}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          filter: andFilters.length > 0 ? { and: andFilters } : undefined
        })
      });

      if (!resp.ok) return createCORSResponse(await resp.json(), resp.status, req);
      const data = await resp.json();
      
      const results = (data.results || []).map((p: any) => {
        const pProps = p.properties || {};
        return {
          id: p.id,
          question: questionProp ? (pProps[questionProp]?.title?.[0]?.plain_text || "Untitled") : "Untitled",
          answer: answerProp ? (pProps[answerProp]?.rich_text?.[0]?.plain_text || "") : ""
        };
      });

      return createCORSResponse({ 
        results, 
        version: VERSION,
        diagnostics: {
          matchedProperties: { questionProp, sourcePdfProp, pageNumberProp, answerProp },
          totalResults: data.results?.length
        }
      }, 200, req);
    }

    return createCORSResponse({ error: `Unknown action: ${action}`, version: VERSION }, 404, req);
  } catch (error) {
    console.error(`[reading-api] Error: ${error.message}`);
    return createCORSResponse({ error: error.message }, 500, req);
  }
});
