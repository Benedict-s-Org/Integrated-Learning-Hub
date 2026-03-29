import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequest {
  action: 'search';
  query: string;
  limit?: number;
}

interface ProxyRequest {
  action: 'proxy';
  url: string;
}

type RequestBody = SearchRequest | ProxyRequest;

export interface ImageCandidate {
  source: string;
  thumbUrl: string;
  sourcePageUrl: string;
  downloadUrl: string;
  licenseTag: string;
}

// Interleave two arrays alternatively
function interleave<T>(a: T[], b: T[]): T[] {
  const result: T[] = [];
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < a.length) result.push(a[i]);
    if (i < b.length) result.push(b[i]);
  }
  return result;
}

async function searchWikimedia(query: string): Promise<ImageCandidate[]> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|extmetadata|mime&format=json&origin=*`;
    const response = await fetch(searchUrl);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.query || !data.query.pages) return [];

    const pages = Object.values(data.query.pages) as any[];
    const candidates: ImageCandidate[] = [];

    for (const page of pages) {
      if (!page.imageinfo || !page.imageinfo[0]) continue;
      const info = page.imageinfo[0];
      const extMeta = info.extmetadata || {};

      // Filter for CC0 or Public Domain
      const license = extMeta.LicenseShortName?.value?.toLowerCase() || '';
      const usageTerms = extMeta.UsageTerms?.value?.toLowerCase() || '';

      if (
        license.includes('cc0') || 
        license.includes('pd') || 
        license.includes('public domain') ||
        usageTerms.includes('public domain') ||
        usageTerms.includes('cc0')
      ) {
        // Discard CC-BY / CC-BY-SA just to be safe if they partially matched 'pd' somehow
        if (license.includes('by') || license.includes('sa') || license.includes('nc') || license.includes('nd')) {
          continue;
        }

        candidates.push({
          source: 'Wikimedia Commons',
          thumbUrl: info.responsiveUrls?.[0] || info.url,
          sourcePageUrl: info.descriptionurl,
          downloadUrl: info.url,
          licenseTag: license.includes('cc0') ? 'CC0' : 'Public Domain',
        });
      }
    }

    return candidates;
  } catch (error) {
    console.error("Wikimedia error:", error);
    return [];
  }
}

async function searchOpenverse(query: string): Promise<ImageCandidate[]> {
  try {
    // Specifically request CC0 and PDM (Public Domain Mark) to guarantee safe licensing
    const searchUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm&page_size=15`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'SupabaseLearningHub/1.0 (Integration/EdgeFunction)',
      }
    });
    
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results) return [];

    return data.results.map((item: any) => ({
      source: 'Openverse',
      thumbUrl: item.thumbnail || item.url,
      sourcePageUrl: item.foreign_landing_url,
      downloadUrl: item.url,
      // API returned exactly cc0 or pdm due to query filter
      licenseTag: item.license.toLowerCase() === 'cc0' ? 'CC0' : 'Public Domain',
    }));
  } catch (error) {
    console.error("Openverse error:", error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();

    if (body.action === 'search') {
      const { query, limit = 5 } = body;
      console.log(`[Search] Query: "${query}", Limit: ${limit}`);
      
      if (!query) {
        return new Response(JSON.stringify({ error: 'Query is required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch in parallel
      const [wikiResults, openverseResults] = await Promise.all([
        searchWikimedia(query),
        searchOpenverse(query),
      ]);

      console.log(`[Search] Results: Wikimedia=${wikiResults.length}, Openverse=${openverseResults.length}`);

      // Mix sources
      let mixed = interleave(wikiResults, openverseResults);

      // Limit results
      mixed = mixed.slice(0, limit);
      console.log(`[Search] Returning ${mixed.length} candidates after mixing and limiting.`);

      return new Response(
        JSON.stringify({ success: true, candidates: mixed }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } 

    if (body.action === 'proxy') {
      const { url } = body;
      if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'SupabaseLearningHub/1.0 (Integration/EdgeFunction Proxy)',
        }
      });

      if (!imageResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch image proxy' }), {
          status: imageResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentType = imageResponse.headers.get("content-type") || "application/octet-stream";
      
      // We stream the exact buffer back, bypassing CORS locally for the JSZip builder
      return new Response(imageResponse.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400", // cache proxy requests
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error in image-search function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
