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

interface UploadRequest {
  action: 'upload';
  url: string;
  customFileName?: string;
  folderName?: string;
}

type RequestBody = SearchRequest | ProxyRequest | UploadRequest;

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

/**
 * Gets a Google Auth token using Service Account JSON.
 */
async function getAccessToken({ client_email, private_key }: { client_email: string, private_key: string }): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    iss: client_email,
    sub: client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/drive",
  }));

  const keyBuffer = Uint8Array.from(atob(private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----|\n/g, "")), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${payload}`));
  const jwt = `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (data.error) throw new Error(`Auth failed: ${data.error_description}`);
  return data.access_token;
}

/**
 * Set "anyone with the link can read" permission on a Drive file.
 */
async function setDrivePublicPermission(fileId: string, accessToken: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&supportsTeamDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "anyone", role: "reader" }),
    }
  );
}

/**
 * Finds or creates a subfolder by name under a parent folder.
 */
/**
 * Recursive folder search/creation.
 * Supports paths like "Learning_Community/city/buildings"
 */
async function findOrCreateFolder(path: string, parentId: string, accessToken: string): Promise<string> {
  const parts = path.split('/').filter(p => p.length > 0);
  let currentParentId = parentId;

  for (const part of parts) {
    const query = encodeURIComponent(`name = '${part}' and '${currentParentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    let folderId = "";
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        folderId = data.files[0].id;
      }
    }

    if (!folderId) {
      const createRes = await fetch(`https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [currentParentId]
        }),
      });

      if (!createRes.ok) throw new Error(`Failed to create folder ${part}: ${await createRes.text()}`);
      const folderData = await createRes.json();
      folderId = folderData.id;
    }
    currentParentId = folderId;
  }

  return currentParentId;
}

/**
 * Lists files in a folder to check for existence or find by name.
 */
async function findFileInFolder(fileName: string, folderId: string, accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0].id : null;
}

/**
 * Downloads a file's content as text.
 */
async function getFileContent(fileId: string, accessToken: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return "";
  return await res.text();
}

/**
 * Updates an existing file's content (re-upload).
 */
async function updateFileContent(fileId: string, content: string, contentType: string, accessToken: string): Promise<void> {
  // Simple media-only update for text files
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType 
    },
    body: content
  });
  if (!res.ok) throw new Error(`Failed to update file: ${await res.text()}`);
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

    const payload: any = await req.json();
    const { action } = payload;

    // --- Search Action ---
    if (action === 'search') {
      const { query, limit = 5 } = payload;
      if (!query) throw new Error('Query is required');
      const [wikiResults, openverseResults] = await Promise.all([
        searchWikimedia(query),
        searchOpenverse(query),
      ]);
      const finalCandidates = selectTopCandidates(wikiResults, openverseResults, limit);
      return new Response(JSON.stringify({ success: true, candidates: finalCandidates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Proxy Action ---
    if (action === 'proxy') {
      const { url } = payload;
      if (!url) throw new Error("URL required");
      const res = await fetch(url);
      const blob = await res.blob();
      return new Response(blob, {
        headers: { ...corsHeaders, "Content-Type": res.headers.get("Content-Type") || "application/octet-stream" }
      });
    }

    // --- Drive Related Actions ---
    const saEnv = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const parentFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
    if (!saEnv || !parentFolderId) throw new Error("Drive configuration missing");
    const saJson = JSON.parse(saEnv);
    const accessToken = await getAccessToken(saJson);

    // 1. Unified Upload / Master Index Update
    if (action === 'upload' || action === 'update_index') {
      const { url, content, customFileName, folderName, isCsv = false } = payload;
      
      // Determine folder
      const targetFolderId = folderName 
        ? await findOrCreateFolder(folderName, parentFolderId, accessToken)
        : parentFolderId;
      
      const fileName = customFileName || (isCsv ? 'master_index.csv' : `file_${Date.now()}`);

      if (action === 'update_index') {
        const { row } = payload; // Array of items e.g. ["Word", "Filename", "URL"]
        if (!row) throw new Error("Row data required for update_index");
        
        let existingId = await findFileInFolder(fileName, targetFolderId, accessToken);
        let finalContent = "";
        
        if (existingId) {
          const oldContent = await getFileContent(existingId, accessToken);
          finalContent = oldContent.endsWith('\n') ? oldContent : oldContent + '\n';
        } else {
          // Add header if new file (optional, depends on if user provided it)
          if (payload.header) finalContent = payload.header.join(',') + '\n';
        }
        
        const csvLine = row.map((cell: any) => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(',');
        finalContent += csvLine + '\n';

        if (existingId) {
          await updateFileContent(existingId, finalContent, "text/csv", accessToken);
        } else {
          // Create new
          const metadata = { name: fileName, parents: [targetFolderId] };
          const boundary = "-------314159265358979323846";
          const multipartBody = 
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\nContent-Type: text/csv\r\n\r\n${finalContent}\r\n` +
            `--${boundary}--`;
          
          const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
            body: multipartBody,
          });
          const uploadData = await uploadRes.json();
          existingId = uploadData.id;
          await setDrivePublicPermission(existingId, accessToken);
        }

        return new Response(JSON.stringify({ success: true, fileId: existingId, fileName }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Standard Upload
      let fileContent: any;
      let contentType = "application/octet-stream";

      if (url) {
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error(`Source fetch failed: ${imgRes.status}`);
        fileContent = await imgRes.arrayBuffer();
        contentType = imgRes.headers.get("content-type") || "image/jpeg";
      } else if (content) {
        fileContent = content;
        contentType = payload.contentType || "text/plain";
      } else {
        throw new Error("Either url or content is required for upload");
      }

      // Multipart upload
      const metadata = { name: fileName, parents: [targetFolderId] };
      const boundary = "-------314159265358979323846";
      
      // Convert buffer to base64 if it's binary
      let base64Content = "";
      if (typeof fileContent === 'string') {
        base64Content = btoa(unescape(encodeURIComponent(fileContent)));
      } else {
        const uint8 = new Uint8Array(fileContent);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        base64Content = btoa(binary);
      }

      const multipartBody = 
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${contentType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Content}\r\n` +
        `--${boundary}--`;

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
      const uploadData = await uploadRes.json();
      await setDrivePublicPermission(uploadData.id, accessToken);

      return new Response(JSON.stringify({ 
        success: true, 
        fileId: uploadData.id, 
        fileName,
        url: `https://drive.google.com/uc?export=download&id=${uploadData.id}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
