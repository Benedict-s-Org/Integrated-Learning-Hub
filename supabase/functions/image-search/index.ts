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

interface ScoredCandidate extends ImageCandidate {
  score: number;
  urlId: string;
}

// Generate multiple search queries to expand results
function getExpandedQueries(query: string): string[] {
  const norm = query.toLowerCase().trim();
  // Remove special characters that might mess up URL params
  const clean = norm.replace(/[^a-z0-9 ]/g, '');
  
  return Array.from(new Set([
    clean,                     // Base query
    `${clean} photo`,          // General photograph
    `${clean} isolated`,       // Good for vocab items
    `${clean} object`,         // Sometimes yields clean items
    `${clean} on white`        // Good for dictionary-style images
  ])).filter(q => q.trim().length > 0);
}

// Minimal quality filter and ranking function
function calculateQualityScore(cand: {
  width: number;
  height: number;
  title: string;
  isSvg: boolean;
  mime: string;
  query: string;
}): number {
  if (cand.isSvg) return -100; // Drop SVGs

  const titleLow = cand.title.toLowerCase();
  
  // Drop typical non-photograph artifacts
  if (titleLow.includes('icon') || 
      titleLow.includes('logo') || 
      titleLow.includes('clipart') || 
      titleLow.includes('vector') || 
      titleLow.includes('drawing') ||
      titleLow.includes('silhouette') ||
      titleLow.includes('illustration')) {
    return -100;
  }

  let score = 0;
  
  // Strongly prefer JPEGs (photos)
  const mime = cand.mime.toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    score += 15;
  }

  // Resolution scoring
  const maxDim = Math.max(cand.width, cand.height);
  if (maxDim >= 800) score += 20;
  else if (maxDim >= 600) score += 10;
  else if (maxDim > 0 && maxDim < 400) score -= 20;

  // Keyword match (Word boundary match gives highest confidence)
  const queryLow = cand.query.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (queryLow) {
    const rx = new RegExp(`\\b${queryLow}\\b`, 'i');
    if (rx.test(titleLow)) score += 15;
    else if (titleLow.includes(queryLow)) score += 5;
  }

  return score;
}

function mergeAndSort(candidatesList: ScoredCandidate[][]): ScoredCandidate[] {
  const map = new Map<string, ScoredCandidate>();
  for (const list of candidatesList) {
    for (const cand of list) {
      // Deduplicate by URL, keeping highest score
      if (!map.has(cand.urlId) || map.get(cand.urlId)!.score < cand.score) {
        map.set(cand.urlId, cand);
      }
    }
  }
  const merged = Array.from(map.values());
  merged.sort((a, b) => b.score - a.score);
  return merged;
}

// Fetch a single specific query from Wikimedia Commons
async function fetchWikimediaQuery(q: string, originalQuery: string): Promise<ScoredCandidate[]> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata|mime|size&format=json&origin=*`;
    const response = await fetch(searchUrl);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.query || !data.query.pages) return [];

    const pages = Object.values(data.query.pages) as any[];
    const candidates: ScoredCandidate[] = [];

    for (const page of pages) {
      if (!page.imageinfo || !page.imageinfo[0]) continue;
      const info = page.imageinfo[0];
      const extMeta = info.extmetadata || {};
      const mime = info.mime || '';
      
      const isSvg = mime.includes('svg');
      const title = page.title || '';

      const score = calculateQualityScore({
        width: info.width || 0,
        height: info.height || 0,
        title,
        isSvg,
        mime,
        query: originalQuery
      });

      if (score < -50) continue; // Drop bad matches early

      const license = extMeta.LicenseShortName?.value?.toLowerCase() || '';
      const usageTerms = extMeta.UsageTerms?.value?.toLowerCase() || '';

      if (
        license.includes('cc0') || 
        license.includes('pd') || 
        license.includes('public domain') ||
        usageTerms.includes('public domain') ||
        usageTerms.includes('cc0')
      ) {
        if (license.includes('by') || license.includes('sa') || license.includes('nc') || license.includes('nd')) {
          continue;
        }

        candidates.push({
          source: 'Wikimedia Commons',
          thumbUrl: info.responsiveUrls?.[0] || info.url,
          sourcePageUrl: info.descriptionurl,
          downloadUrl: info.url,
          licenseTag: license.includes('cc0') ? 'CC0' : 'Public Domain',
          score,
          urlId: info.url
        });
      }
    }

    return candidates;
  } catch (error) {
    return [];
  }
}

// Fetch a single specific query from Openverse
async function fetchOpenverseQuery(q: string, originalQuery: string): Promise<ScoredCandidate[]> {
  try {
    const searchUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=10`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'SupabaseLearningHub/1.0',
      }
    });
    
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results) return [];

    const candidates: ScoredCandidate[] = [];
    
    for (const item of data.results) {
      const isSvg = item.filetype?.toLowerCase().includes('svg') || item.url.toLowerCase().endsWith('.svg');
      
      const score = calculateQualityScore({
        width: item.width || 0,
        height: item.height || 0,
        title: item.title || '',
        isSvg,
        mime: item.filetype ? `image/${item.filetype.toLowerCase()}` : 'image/jpeg', // Default to giving jpeg points if unspecified
        query: originalQuery
      });

      if (score < -50) continue; // Drop bad matches early
      
      candidates.push({
        source: 'Openverse',
        thumbUrl: item.thumbnail || item.url,
        sourcePageUrl: item.foreign_landing_url,
        downloadUrl: item.url,
        licenseTag: item.license.toLowerCase() === 'cc0' ? 'CC0' : 'Public Domain',
        score,
        urlId: item.url
      });
    }

    return candidates;
  } catch (error) {
    return [];
  }
}

async function searchWikimedia(query: string): Promise<ScoredCandidate[]> {
  const queries = getExpandedQueries(query);
  const results = await Promise.all(queries.map(q => fetchWikimediaQuery(q, query)));
  return mergeAndSort(results);
}

async function searchOpenverse(query: string): Promise<ScoredCandidate[]> {
  const queries = getExpandedQueries(query);
  const results = await Promise.all(queries.map(q => fetchOpenverseQuery(q, query)));
  return mergeAndSort(results);
}

// Blend aiming for 3 Openverse + 2 Commons in top 5
function selectTopCandidates(wikiResults: ScoredCandidate[], openverseResults: ScoredCandidate[], limit: number): ImageCandidate[] {
   let selected: ScoredCandidate[] = [];
   
   // We aim for 3 openverse + 2 commons for top 5. If limit is different, adjust ratio roughly 3:2.
   const targetOvCount = Math.ceil(limit * 0.6); 
   const targetWikiCount = limit - targetOvCount;

   const ovCount = Math.min(targetOvCount, openverseResults.length);
   selected.push(...openverseResults.slice(0, ovCount));
   
   const wikiCountNeeded = Math.min(limit - selected.length, wikiResults.length);
   selected.push(...wikiResults.slice(0, wikiCountNeeded));

   // If short, grab more from Openverse
   if (selected.length < limit) {
     const extraOvNeeded = Math.min(limit - selected.length, openverseResults.length - ovCount);
     selected.push(...openverseResults.slice(ovCount, ovCount + extraOvNeeded));
   }
   
   // If still short, grab more from Wiki
   if (selected.length < limit) {
      const currentWikiUsed = wikiCountNeeded;
      const extraWikiNeeded = Math.min(limit - selected.length, wikiResults.length - currentWikiUsed);
      selected.push(...wikiResults.slice(currentWikiUsed, currentWikiUsed + extraWikiNeeded));
   }

   // Map down to ImageCandidate (removes score and urlId)
   return selected.map(c => ({
     source: c.source,
     thumbUrl: c.thumbUrl,
     sourcePageUrl: c.sourcePageUrl,
     downloadUrl: c.downloadUrl,
     licenseTag: c.licenseTag
   }));
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

      console.log(`[Search] Candidates pre-filter: Wikimedia=${wikiResults.length}, Openverse=${openverseResults.length}`);

      // Smart blend
      const finalCandidates = selectTopCandidates(wikiResults, openverseResults, limit);
      
      console.log(`[Search] Returning ${finalCandidates.length} candidates after blending.`);

      return new Response(
        JSON.stringify({ success: true, candidates: finalCandidates }),
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
      
      return new Response(imageResponse.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400", 
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
