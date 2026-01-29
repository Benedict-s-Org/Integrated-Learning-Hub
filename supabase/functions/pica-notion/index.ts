import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const picaSecretKey = Deno.env.get("PICA_SECRET_KEY");
    const picaNotionConnectionKey = Deno.env.get("PICA_NOTION_CONNECTION_KEY");

    if (!picaSecretKey || !picaNotionConnectionKey) {
      console.error("Missing Pica environment variables");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Missing Pica credentials",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/debug-raw")) {
      const databaseId = "a35db621-f94e-4a0b-9f53-6d895d6972d6";
      const results: Record<string, unknown> = {
        debug: {
          hasPicaSecretKey: !!picaSecretKey,
          picaSecretKeyLength: picaSecretKey?.length || 0,
          picaSecretKeyPrefix: picaSecretKey?.substring(0, 10) || "N/A",
          hasPicaNotionConnectionKey: !!picaNotionConnectionKey,
          picaNotionConnectionKeyLength: picaNotionConnectionKey?.length || 0,
          picaNotionConnectionKeyPrefix: picaNotionConnectionKey?.substring(0, 10) || "N/A",
          databaseId,
        },
      };

      const actionsPage1 = await fetch(
        "https://api.picaos.com/v1/available-actions/notion?page=1&limit=50",
        {
          method: "GET",
          headers: {
            "x-pica-secret": picaSecretKey,
            "Content-Type": "application/json",
          },
        }
      );
      const page1Data = await actionsPage1.json();

      const allActions = page1Data?.rows || [];
      results.availableActions = allActions.map((a: { title: string; key: string; path: string; method: string }) => ({
        title: a.title,
        key: a.key,
        path: a.path,
        method: a.method,
      }));

      const dataSourceQueryAction = allActions.find(
        (a: { key: string }) => a.key?.includes("datasourcepages")
      );
      results.dataSourceQueryAction = dataSourceQueryAction;

      const requestUrl1 = `https://api.picaos.com/v1/passthrough/data_sources/${databaseId}/query`;
      const response1 = await fetch(requestUrl1, {
        method: "POST",
        headers: {
          "x-pica-secret": picaSecretKey,
          "x-pica-connection-key": picaNotionConnectionKey,
          "x-pica-action-id": dataSourceQueryAction?.key || "datasourcepages_query",
          "Content-Type": "application/json",
          "Notion-Version": "2025-09-03", 
        },
        body: JSON.stringify({ page_size: 100 }),
      });
      const text1 = await response1.text();
      let parsed1;
      try { parsed1 = JSON.parse(text1); } catch { parsed1 = text1; }
      results.attempt1_databases_path = { url: requestUrl1, status: response1.status, body: parsed1 };

      const requestUrl2 = `https://api.picaos.com/v1/passthrough/data_sources/${databaseId}/query`;
      const response2 = await fetch(requestUrl2, {
        method: "POST",
        headers:  {
          "x-pica-secret": picaSecretKey,
          "x-pica-connection-key": picaNotionConnectionKey,
          "x-pica-action-id": dataSourceQueryAction?.key || "datasourcepages_query",
          "Content-Type": "application/json",
          "Notion-Version": "2025-09-03", 
        },
        body: JSON.stringify({ page_size: 100 }),
      });
      const text2 = await response2.text();
      let parsed2;
      try { parsed2 = JSON.parse(text2); } catch { parsed2 = text2; }
      results.attempt2_data_sources_path = { url: requestUrl2, status: response2.status, body: parsed2 };

      const requestUrl3 = `https://api.picaos.com/v1/passthrough/v1/data_sources/${databaseId}/query`;
      const response3 = await fetch(requestUrl3, {
        method: "POST",
        headers: {
        "x-pica-secret": picaSecretKey,
        "x-pica-connection-key": picaNotionConnectionKey,
        "x-pica-action-id": dataSourceQueryAction?.key ||      "datasourcepages_query",
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03",  // 
      },
        body: JSON.stringify({ page_size: 100 }),
      });
      const text3 = await response3.text();
      let parsed3;
      try { parsed3 = JSON.parse(text3); } catch { parsed3 = text3; }
      results.attempt3_v1_databases_path = { url: requestUrl3, status: response3.status, body: parsed3 };

      return new Response(
        JSON.stringify(results, null, 2),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

         if (path.endsWith('list-activities')) {
              const databaseId = 'a35db621-f94e-4a0b-9f53-6d895d6972d6'; // Your Database ID

              // 1. Fetch available actions to get the correct paths
              const actionsResp = await fetch(
                `https://api.picaos.com/v1/available-actions/notion?page=1&limit=50`,
                { headers: { 'x-pica-secret': picaSecretKey } }
              );
              const actionsData = await actionsResp.json();
      
              // Find the actions we need
              const retrieveDatabaseAction = actionsData.rows?.find((a: any) => 
        a.key?.includes('retrievedatabase')
      );
              const queryDataSourceAction = actionsData.rows?.find((a: any) => 
                a.key?.includes('querydatasourcepages')
              );

      // 2. FIRST: Retrieve the Database Metadata to find the Data Source ID
              const dbResponse = await fetch(
                `https://api.picaos.com/v1/passthrough/v1/databases/${databaseId}`,
                {
                  method: 'GET',
                  headers: {
                    'x-pica-secret': picaSecretKey,
                    'x-pica-connection-key': picaNotionConnectionKey,
                    'x-pica-action-id': retrieveDatabaseAction?.key || 'api::notion::v1::database::get_one',
                    'Content-Type': 'application/json',
                    'Notion-Version': '2025-09-03',
          },
        }
      );

      if (!dbResponse.ok) {
        const errorText = await dbResponse.text();
        console.error('Failed to retrieve database metadata:', errorText);
        return new Response(
            JSON.stringify({ error: 'Failed to find database', details: errorText }),
            { status: dbResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dbData = await dbResponse.json();
      // EXTRACT THE REAL DATA SOURCE ID
      // Notion databases now have a 'data_sources' array. We usually want the first one.
      const realDataSourceId = dbData.data_sources?.[0]?.id;

      if (!realDataSourceId) {
         return new Response(
            JSON.stringify({ error: 'Database has no data source', details: 'The 2025-09-03 API requires a valid data source.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. NOW: Query the Data Source using the ID we just found
      const notionResponse = await fetch(
        `https://api.picaos.com/v1/passthrough/data_sources/${realDataSourceId}/query`,
        {
          method: 'POST',
          headers: {
            'x-pica-secret': picaSecretKey,
            'x-pica-connection-key': picaNotionConnectionKey,
            'x-pica-action-id': queryDataSourceAction?.key || 'datasourcepagesquery',
            'Content-Type': 'application/json',
            'Notion-Version': '2025-09-03',
          },
          body: JSON.stringify({
             // REMOVED THE STATUS FILTER to avoid the other error
             page_size: 100, 
          }),
        }
      );

      const notionData = await notionResponse.json();
      const activities: LearningActivity[] = [];

      for (const page of notionData.results || []) {
        const notionPage = page as NotionPage;
        const props = notionPage.properties;

        let name = "Untitled";
        const nameProperty = props["Name"] || props["name"] || props["Title"] || props["title"];
        if (nameProperty) {
          const nameProp = nameProperty as { type: string; title?: Array<{ plain_text: string }>; rich_text?: Array<{ plain_text: string }> };
          if (nameProp.type === "title" && nameProp.title?.[0]) {
            name = nameProp.title[0].plain_text;
          } else if (nameProp.type === "rich_text" && nameProp.rich_text?.[0]) {
            name = nameProp.rich_text[0].plain_text;
          }
        }

        let difficulty = "Medium";
        const difficultyProperty = props["Difficulty"] || props["difficulty"];
        if (difficultyProperty) {
          const diffProp = difficultyProperty as { type: string; select?: { name: string }; rich_text?: Array<{ plain_text: string }> };
          if (diffProp.type === "select" && diffProp.select) {
            difficulty = diffProp.select.name;
          } else if (diffProp.type === "rich_text" && diffProp.rich_text?.[0]) {
            difficulty = diffProp.rich_text[0].plain_text;
          }
        }

        let questionsJson: unknown[] = [];
        const questionsProperty = props["Questions"] || props["questions"] || props["Questions JSON"] || props["questions_json"];
        if (questionsProperty) {
          const qProp = questionsProperty as { type: string; rich_text?: Array<{ plain_text: string }> };
          if (qProp.type === "rich_text" && qProp.rich_text?.[0]) {
            try {
              const parsed = JSON.parse(qProp.rich_text[0].plain_text);
              questionsJson = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              questionsJson = [];
            }
          }
        }

        let thumbnail: string | null = null;
        if (notionPage.cover) {
          if (notionPage.cover.external?.url) {
            thumbnail = notionPage.cover.external.url;
          } else if (notionPage.cover.file?.url) {
            thumbnail = notionPage.cover.file.url;
          }
        }
        const thumbnailProperty = props["Thumbnail"] || props["thumbnail"] || props["Image"] || props["image"];
        if (!thumbnail && thumbnailProperty) {
          const thumbProp = thumbnailProperty as { type: string; url?: string; files?: Array<{ file?: { url: string }; external?: { url: string } }> };
          if (thumbProp.type === "url" && thumbProp.url) {
            thumbnail = thumbProp.url;
          } else if (thumbProp.type === "files" && thumbProp.files?.[0]) {
            const file = thumbProp.files[0];
            thumbnail = file.file?.url || file.external?.url || null;
          }
        }

        activities.push({
          id: notionPage.id,
          name,
          thumbnail,
          difficulty,
          questionsJson,
        });
      }

      return new Response(
        JSON.stringify({ activities }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/get-activity")) {
      const { activityId } = await req.json();

      if (!activityId) {
        return new Response(
          JSON.stringify({ error: "Activity ID is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // FIX: Use the correct Action ID for "Retrieve Page"
      // We don't need to fetch the dynamic list because this ID is standard across integrations.
      const notionResponse = await fetch(
        `https://api.picaos.com/v1/passthrough/pages/${activityId}`,
        {
          method: "GET",
          headers: {
          "x-pica-secret": picaSecretKey,
          "x-pica-connection-key": picaNotionConnectionKey,
          // CORRECT ACTION ID for "Retrieve a Page by ID"
          "x-pica-action-id": "api::notion::v1::pages::get_one",
          "Content-Type": "application/json",
          "Notion-Version": "2025-09-03", 
        },
        }
      );

      if (!notionResponse.ok) {
        const errorText = await notionResponse.text();
        console.error("Notion API error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch activity from Notion" }),
          {
            status: notionResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const notionPage = await notionResponse.json() as NotionPage;
      const props = notionPage.properties;

      let name = "Untitled";
      const nameProperty = props["Name"] || props["name"] || props["Title"] || props["title"];
      if (nameProperty) {
        const nameProp = nameProperty as { type: string; title?: Array<{ plain_text: string }>; rich_text?: Array<{ plain_text: string }> };
        if (nameProp.type === "title" && nameProp.title?.[0]) {
          name = nameProp.title[0].plain_text;
        } else if (nameProp.type === "rich_text" && nameProp.rich_text?.[0]) {
          name = nameProp.rich_text[0].plain_text;
        }
      }

      let difficulty = "Medium";
      const difficultyProperty = props["Difficulty"] || props["difficulty"];
      if (difficultyProperty) {
        const diffProp = difficultyProperty as { type: string; select?: { name: string }; rich_text?: Array<{ plain_text: string }> };
        if (diffProp.type === "select" && diffProp.select) {
          difficulty = diffProp.select.name;
        } else if (diffProp.type === "rich_text" && diffProp.rich_text?.[0]) {
          difficulty = diffProp.rich_text[0].plain_text;
        }
      }

      let questionsJson: unknown[] = [];
      const questionsProperty = props["Questions"] || props["questions"] || props["Questions JSON"] || props["questions_json"];
      if (questionsProperty) {
        const qProp = questionsProperty as { type: string; rich_text?: Array<{ plain_text: string }> };
        if (qProp.type === "rich_text" && qProp.rich_text?.[0]) {
          try {
            const parsed = JSON.parse(qProp.rich_text[0].plain_text);
            questionsJson = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            questionsJson = [];
          }
        }
      }

      let thumbnail: string | null = null;
      if (notionPage.cover) {
        if (notionPage.cover.external?.url) {
          thumbnail = notionPage.cover.external.url;
        } else if (notionPage.cover.file?.url) {
          thumbnail = notionPage.cover.file.url;
        }
      }

      return new Response(
        JSON.stringify({
          activity: {
            id: notionPage.id,
            name,
            thumbnail,
            difficulty,
            questionsJson,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in pica-notion function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});