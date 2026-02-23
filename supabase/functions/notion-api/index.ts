import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  cover?: {
    type: string;
    external?: { url: string };
    file?: { url: string };
  };
}

interface LearningActivity {
  id: string;
  name: string;
  thumbnail: string | null;
  difficulty: string;
  questionsJson: unknown[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function extractText(
  props: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const prop = props[key] as
      | {
        type: string;
        title?: Array<{ plain_text: string }>;
        rich_text?: Array<{ plain_text: string }>;
      }
      | undefined;
    if (!prop) continue;
    if (prop.type === "title" && prop.title)
      return prop.title.map((t) => t.plain_text).join("");
    if (prop.type === "rich_text" && prop.rich_text)
      return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

function extractSelect(
  props: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const prop = props[key] as
      | {
        type: string;
        select?: { name: string };
        rich_text?: Array<{ plain_text: string }>;
      }
      | undefined;
    if (!prop) continue;
    if (prop.type === "select" && prop.select) return prop.select.name;
    if (prop.type === "rich_text" && prop.rich_text?.[0])
      return prop.rich_text[0].plain_text;
  }
  return "";
}

function extractThumbnail(page: NotionPage): string | null {
  if (page.cover) {
    if (page.cover.external?.url) return page.cover.external.url;
    if (page.cover.file?.url) return page.cover.file.url;
  }
  const props = page.properties;
  const thumbProp = (props["Thumbnail"] || props["thumbnail"] || props["Image"] || props["image"]) as
    | {
      type: string;
      url?: string;
      files?: Array<{
        file?: { url: string };
        external?: { url: string };
      }>;
    }
    | undefined;
  if (thumbProp) {
    if (thumbProp.type === "url" && thumbProp.url) return thumbProp.url;
    if (thumbProp.type === "files" && thumbProp.files?.[0]) {
      const f = thumbProp.files[0];
      return f.file?.url || f.external?.url || null;
    }
  }
  return null;
}

function extractQuestionsJson(props: Record<string, unknown>): unknown[] {
  const qProp = (props["Questions"] ||
    props["questions"] ||
    props["Questions JSON"] ||
    props["questions_json"]) as
    | { type: string; rich_text?: Array<{ plain_text: string }> }
    | undefined;
  if (qProp?.type === "rich_text" && qProp.rich_text?.[0]) {
    try {
      const parsed = JSON.parse(qProp.rich_text[0].plain_text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  return [];
}

function pageToActivity(page: NotionPage): LearningActivity {
  const props = page.properties;
  return {
    id: page.id,
    name: extractText(props, "Name", "name", "Title", "title") || "Untitled",
    thumbnail: extractThumbnail(page),
    difficulty: extractSelect(props, "Difficulty", "difficulty") || "Medium",
    questionsJson: extractQuestionsJson(props),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const notionToken = Deno.env.get("NOTION_TOKEN");

    if (!notionToken) {
      console.error("Missing NOTION_TOKEN environment variable");
      return jsonResponse(
        { error: "Server configuration error: Missing NOTION_TOKEN secret" }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, ""); // Remove trailing slashes
    console.log(`[notion-api] Handling request: ${req.method} ${path}`);

    // ── List Activities (from a hardcoded database) ──────────────────────
    if (path.endsWith("/list-activities")) {
      const databaseId = "a35db621-f94e-4a0b-9f53-6d895d6972d6";

      const resp = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({ page_size: 100 }),
      });

      if (!resp.ok) {
        const errorBody = await resp.text();
        console.error("Notion query failed:", resp.status, errorBody);
        let details = errorBody;
        try { const parsed = JSON.parse(errorBody); details = parsed.message || errorBody; } catch { }
        return jsonResponse(
          { error: `Notion API error (${resp.status}): ${details}` }
        );
      }

      const data = await resp.json();
      const activities: LearningActivity[] = (data.results || []).map(
        (page: NotionPage) => pageToActivity(page)
      );

      return jsonResponse({ activities });
    }

    // ── Get Single Activity ─────────────────────────────────────────────
    if (path.endsWith("/get-activity")) {
      const { activityId } = await req.json();

      if (!activityId) {
        return jsonResponse({ error: "Activity ID is required" });
      }

      const resp = await fetch(`${NOTION_API}/pages/${activityId}`, {
        method: "GET",
        headers: notionHeaders(notionToken),
      });

      if (!resp.ok) {
        const errorBody = await resp.text();
        console.error("Notion page fetch failed:", resp.status, errorBody);
        let details = errorBody;
        try { const parsed = JSON.parse(errorBody); details = parsed.message || errorBody; } catch { }
        return jsonResponse(
          { error: `Notion API error (${resp.status}): ${details}` }
        );
      }

      const notionPage = (await resp.json()) as NotionPage;
      return jsonResponse({ activity: pageToActivity(notionPage) });
    }

    // ── Query MCQ Database (used by SpacedRepetition NotionImporter) ────
    if (path.endsWith("/query-mcq-database")) {
      const { databaseId } = await req.json();

      if (!databaseId) {
        return jsonResponse({ error: "Database ID is required" });
      }

      // Paginate through all results (Notion caps at 100 per request)
      const allResults: unknown[] = [];
      let nextCursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const body: Record<string, unknown> = {
          page_size: 100,
          sorts: [{ timestamp: "created_time", direction: "ascending" }],
        };
        if (nextCursor) body.start_cursor = nextCursor;

        const resp = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
          method: "POST",
          headers: notionHeaders(notionToken),
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const errorBody = await resp.text();
          console.error("Notion MCQ query failed:", resp.status, errorBody);
          let details = errorBody;
          try { const parsed = JSON.parse(errorBody); details = parsed.message || errorBody; } catch { }
          return jsonResponse(
            { error: `Notion API error (${resp.status}): ${details}` }
          );
        }

        const data = await resp.json();
        allResults.push(...(data.results || []));
        hasMore = data.has_more === true;
        nextCursor = data.next_cursor || undefined;
      }

      return jsonResponse({ results: allResults });
    }

    // ── Save Unknown Item ───────────────────────────────────────────────
    if (path.endsWith("/save-unknown")) {
      const { text, type, context, setId, userName } = await req.json();
      const databaseId = Deno.env.get("NOTION_HELP_DATABASE_ID");

      if (!databaseId) {
        console.error("Missing NOTION_HELP_DATABASE_ID environment variable");
        return jsonResponse(
          { error: "Server configuration error: Missing NOTION_HELP_DATABASE_ID secret" }
        );
      }

      const resp = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            "Name": {
              title: [{ text: { content: text } }]
            },
            "Type": {
              select: { name: type }
            },
            "Source Context": {
              rich_text: [{ text: { content: context } }]
            },
            "Learning Set": {
              rich_text: [{ text: { content: setId } }]
            },
            "User": {
              rich_text: [{ text: { content: userName || "Unknown User" } }]
            },
            "Date Added": {
              date: { start: new Date().toISOString().split('T')[0] }
            },
            "Status": {
              select: { name: "New" }
            }
          }
        })
      });

      if (!resp.ok) {
        const errorBody = await resp.text();
        console.error("Notion save unknown failed:", resp.status, errorBody);
        let details = errorBody;
        try { const parsed = JSON.parse(errorBody); details = parsed.message || errorBody; } catch { }
        return jsonResponse(
          { error: `Notion API error (${resp.status}): ${details}` }
        );
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown endpoint" });
  } catch (error) {
    console.error("Error in notion-api function:", error);
    return jsonResponse(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      }
    );
  }
});