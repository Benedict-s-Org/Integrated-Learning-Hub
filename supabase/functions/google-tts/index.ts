// Force redeploy to update secrets
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TTSRequest {
  action?: 'synthesize' | 'list' | 'delete_multiple' | 'proxy_download';
  text?: string;
  accent?: string;
  voiceName?: string;
  speakingRate?: number;
  overwrite?: boolean;
  folderName?: string;
  customFileName?: string;
  recursive?: boolean;
  fileIds?: string[];
  fileId?: string;
}

interface TTSResponse {
  audioUrl?: string;
  driveFileId?: string;
  cached?: boolean;
  voiceName?: string;
  speakingRate?: number;
  audioContent?: string;
  files?: any[];
  success?: boolean;
  deletedCount?: number;
}

const DEFAULT_VOICE = "en-GB-Neural2-B";
const DEFAULT_SPEAKING_RATE = 0.9;

const VOICE_FALLBACKS: Record<string, string[]> = {
  "en-GB": ["en-GB-Neural2-B", "en-GB-Neural2-A", "en-GB-Wavenet-B"],
  "en-US": ["en-US-Neural2-F", "en-US-Wavenet-F"],
  "en-AU": ["en-AU-Neural2-A", "en-AU-Wavenet-A"],
};

/**
 * Escapes XML characters and adds breaks after punctuation for natural speech.
 */
function toSSML(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("<speak>") && trimmed.endsWith("</speak>")) {
    return trimmed;
  }

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<speak>${escaped
    .replace(/([.?!])\s*/g, '$1<break time="450ms"/> ')
    .replace(/([,])\s*/g, '$1<break time="200ms"/> ')
    .replace(/([:;])\s*/g, '$1<break time="250ms"/> ')}</speak>`;
}

/**
 * Compute a SHA-256 hex digest of an input string.
 */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a deterministic Drive download URL from a file ID.
 */
function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Gets a Google Auth token using Service Account JSON.
 */
async function getAccessToken({ client_email, private_key }: { client_email: string, private_key: string }): Promise<string> {
  if (!client_email || !private_key) {
    throw new Error(`Invalid Service Account: client_email or private_key missing.`);
  }
  
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    iss: client_email,
    sub: client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/drive",
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
 * Downloads a file from Google Drive as Base64.
 */
async function downloadFromDrive(fileId: string, accessToken: string): Promise<string> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&supportsTeamDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`Drive download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Set public read permission on a Drive file.
 */
async function setDrivePublicPermission(fileId: string, accessToken: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&supportsTeamDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", role: "reader" }),
    }
  );
}

/**
 * Finds or creates a subfolder by name.
 */
async function findOrCreateFolder(folderName: string, parentId: string, accessToken: string): Promise<string> {
  const query = encodeURIComponent(`name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  const createRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Failed to create Drive folder '${folderName}'`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * List all audio files recursively starting from a root folder.
 */
async function listAllFiles(rootFolderId: string, accessToken: string): Promise<any[]> {
  const allFiles: any[] = [];
  const folderCache: Record<string, string> = {};
  let pageToken: string | null = null;
  
  do {
    const query = encodeURIComponent(`mimeType = 'audio/mpeg' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,files(id, name, createdTime, size, parents, webViewLink, thumbnailLink)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ""}`;
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error("Failed to list files from Drive");
    
    const data = await res.json();
    const batch = data.files || [];
    
    // Enrich with folder names
    for (const file of batch) {
      if (file.parents && file.parents.length > 0) {
        const parentId = file.parents[0];
        if (!folderCache[parentId]) {
          const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${parentId}?supportsAllDrives=true&fields=name`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (folderRes.ok) {
            const folderData = await folderRes.json();
            folderCache[parentId] = folderData.name;
          } else {
            folderCache[parentId] = "Unknown Folder";
          }
        }
        file.folderName = folderCache[parentId];
      } else {
        file.folderName = "No Parent";
      }
    }

    allFiles.push(...batch);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Delete a single file and verify it's actually gone.
 * On Shared Drives, canDelete is often false but canTrash is true.
 * Strategy: try trash first (more reliable), then permanent delete as bonus.
 */
async function deleteSingleFileVerified(id: string, accessToken: string): Promise<{id: string, success: boolean, method?: string, stillExists?: boolean, error?: string, capabilities?: any}> {
  try {
    // Step 1: Check file metadata + capabilities
    const checkBefore = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,trashed,driveId,ownedByMe,capabilities(canDelete,canTrash)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (checkBefore.status === 404) {
      return { id, success: true, method: 'already_gone', stillExists: false };
    }
    
    const fileBefore = checkBefore.ok ? await checkBefore.json() : null;
    const caps = fileBefore?.capabilities || {};
    console.log(`[DEL] ${id}: name="${fileBefore?.name}" driveId=${fileBefore?.driveId || 'MyDrive'} canDelete=${caps.canDelete} canTrash=${caps.canTrash}`);

    // Step 2: Choose strategy based on capabilities
    if (caps.canTrash) {
      // TRASH the file (works on Shared Drives where canDelete=false)
      const trashRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        }
      );
      console.log(`[DEL] TRASH ${id} => status=${trashRes.status}`);
      
      if (trashRes.ok) {
        // Verify it's trashed
        const checkAfter = await fetch(
          `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,trashed`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const fileAfter = checkAfter.ok ? await checkAfter.json() : null;
        if (checkAfter.status === 404 || fileAfter?.trashed) {
          console.log(`[DEL] ✅ ${id} trashed successfully`);
          return { id, success: true, method: 'trashed', stillExists: false };
        }
        console.warn(`[DEL] Trash returned OK but file not trashed? trashed=${fileAfter?.trashed}`);
      } else {
        const errBody = await trashRes.text();
        console.error(`[DEL] Trash failed for ${id}: ${trashRes.status} ${errBody}`);
      }
    }
    
    if (caps.canDelete) {
      // Try permanent delete
      const delRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log(`[DEL] DELETE ${id} => status=${delRes.status}`);
      
      if (delRes.ok || delRes.status === 204) {
        const checkAfter = await fetch(
          `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (checkAfter.status === 404) {
          console.log(`[DEL] ✅ ${id} permanently deleted`);
          return { id, success: true, method: 'permanent', stillExists: false };
        }
      }
    }

    // If we get here, nothing worked
    console.error(`[DEL] ❌ ${id} could not be deleted. canDelete=${caps.canDelete} canTrash=${caps.canTrash}`);
    return { id, success: false, method: 'all_failed', stillExists: true, capabilities: caps, error: `Cannot delete "${fileBefore?.name}". canDelete=${caps.canDelete}, canTrash=${caps.canTrash}` };
  } catch (e: any) {
    console.error(`[DEL] Error ${id}:`, e);
    return { id, success: false, stillExists: true, error: e.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let requestBody: TTSRequest = {};
  try {
    requestBody = await req.json();
  } catch (e) {
    // If it's a GET, requestBody remains empty
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Auth failed" }), { status: 401, headers: corsHeaders });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const saEnv = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}";
    const saJson = JSON.parse(saEnv);
    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") || "";

    const { action = 'synthesize' } = requestBody;

    // ── ACTION: LIST ────────────────────────────────────────────────
    if (action === 'list') {
      const accessToken = await getAccessToken(saJson);
      const files = await listAllFiles(rootFolderId, accessToken);
      
      // Optionally enrich with file path logic here if needed, 
      // but 'parents' should suffice for now.
      
      return new Response(JSON.stringify({ success: true, files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── ACTION: DELETE ──────────────────────────────────────────────
    if (action === 'delete_multiple') {
      const { fileIds } = requestBody;
      if (!fileIds || !Array.isArray(fileIds)) throw new Error("fileIds array is required");
      
      console.log(`[DELETE_MULTI] Received ${fileIds.length} IDs: ${JSON.stringify(fileIds)}`);
      
      const accessToken = await getAccessToken(saJson);
      const results = await Promise.all(fileIds.map(id => deleteSingleFileVerified(id, accessToken)));
      const deletedCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      const stillExistCount = results.filter(r => r.stillExists).length;
      
      console.log(`[DELETE_MULTI] Done: ${deletedCount} ok, ${failedCount} failed, ${stillExistCount} still exist`);
      
      // Clean up cache entries for successfully deleted files
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      if (successfulIds.length > 0) {
        await supabaseAdmin
          .from("tts_cache")
          .delete()
          .in("drive_file_id", successfulIds);
      }

      return new Response(JSON.stringify({ 
        success: failedCount === 0, 
        deletedCount, 
        failedCount,
        stillExistCount,
        results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── ACTION: PROXY DOWNLOAD ──────────────────────────────────────
    if (action === 'proxy_download') {
      const { fileId } = requestBody;
      if (!fileId) throw new Error("fileId is required for proxy_download");
      
      const accessToken = await getAccessToken(saJson);
      const base64Audio = await downloadFromDrive(fileId, accessToken);
      
      return new Response(JSON.stringify({
        success: true,
        audioContent: base64Audio,
        driveFileId: fileId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: SYNTHESIZE (Default) ────────────────────────────────
    const { text, accent = "en-GB", voiceName, speakingRate, folderName, customFileName, overwrite = false } = requestBody;
    if (!text) throw new Error("Text is required for synthesis");

    const normalizedText = text.trim().replace(/\s+/g, " ");
    const cacheText = normalizedText.toLowerCase();
    const effectiveVoice = voiceName || (VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"])[0] || DEFAULT_VOICE;
    const effectiveRate = speakingRate ?? DEFAULT_SPEAKING_RATE;

    const { data: cacheHit } = await supabaseAdmin
      .from("tts_cache")
      .select("drive_file_id")
      .eq("text", cacheText)
      .eq("accent", accent)
      .eq("voice_name", effectiveVoice)
      .eq("speaking_rate", effectiveRate)
      .maybeSingle();

    if (cacheHit?.drive_file_id && !overwrite) {
      try {
        const accessToken = await getAccessToken(saJson);
        const base64Audio = await downloadFromDrive(cacheHit.drive_file_id, accessToken);
        
        return new Response(JSON.stringify({
          audioUrl: driveDownloadUrl(cacheHit.drive_file_id),
          audioContent: base64Audio,
          driveFileId: cacheHit.drive_file_id,
          cached: true,
          voiceName: effectiveVoice,
          speakingRate: effectiveRate,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (hitError: any) {
        // Fall through
      }
    }

    if (cacheHit?.drive_file_id && overwrite) {
      await supabaseAdmin
        .from("tts_cache")
        .delete()
        .eq("text", cacheText)
        .eq("accent", accent)
        .eq("voice_name", effectiveVoice)
        .eq("speaking_rate", effectiveRate);
    }

    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    let googleToken: string | null = null;
    if (!apiKey) googleToken = await getAccessToken(saJson);

    const ssml = toSSML(normalizedText);
    const voicesToTry = [effectiveVoice, ...(VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"]).filter(v => v !== effectiveVoice)];

    let ttsContent: string | null = null;
    let usedVoice = effectiveVoice;

    for (const currentVoice of voicesToTry) {
      try {
        const url = apiKey ? `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}` : "https://texttospeech.googleapis.com/v1/text:synthesize";
        const headers: any = { "Content-Type": "application/json" };
        if (googleToken) headers["Authorization"] = `Bearer ${googleToken}`;

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: accent, name: currentVoice },
            audioConfig: { audioEncoding: "MP3", speakingRate: effectiveRate },
          }),
        });
        const data = await res.json();
        if (res.ok) {
          ttsContent = data.audioContent;
          usedVoice = currentVoice;
          break;
        }
      } catch (e) {}
    }

    if (!ttsContent) throw new Error("TTS synthesis failed");

    const hashInput = `${cacheText}|${accent}|${effectiveVoice}|${effectiveRate}`;
    const fileHash = await sha256(hashInput);
    const fileName = customFileName ? (customFileName.endsWith('.mp3') ? customFileName : `${customFileName}.mp3`) : `${fileHash}.mp3`;

    let driveFileId: string | null = null;
    let driveError: string | null = null;

    try {
      const driveAccessToken = googleToken || await getAccessToken(saJson);
      let targetFolderId = rootFolderId;
      if (folderName && rootFolderId) {
        targetFolderId = await findOrCreateFolder(folderName, rootFolderId, driveAccessToken);
      }

      const metadata: any = { name: fileName, mimeType: "audio/mpeg" };
      if (targetFolderId) metadata.parents = [targetFolderId];

      const boundary = "-------314159265358979323846";
      const multipartBody = 
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: audio/mpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${ttsContent}\r\n` +
        `--${boundary}--`;

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&supportsTeamDrives=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${driveAccessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      });

      if (uploadRes.ok) {
        const driveData = await uploadRes.json();
        driveFileId = driveData.id;
        await setDrivePublicPermission(driveFileId!, driveAccessToken);
        await supabaseAdmin.from("tts_cache").upsert({
          text: cacheText,
          accent,
          voice_name: effectiveVoice,
          speaking_rate: effectiveRate,
          drive_file_id: driveFileId,
        }, { onConflict: "text,accent,voice_name,speaking_rate" });
      } else {
        driveError = `Upload failed (${uploadRes.status})`;
      }
    } catch (e: any) {
      driveError = e.message;
    }

    return new Response(JSON.stringify({
      audioUrl: driveFileId ? driveDownloadUrl(driveFileId) : "",
      driveFileId: driveFileId || "",
      fileName: fileName,
      cached: false,
      voiceName: usedVoice,
      speakingRate: effectiveRate,
      audioContent: ttsContent,
      driveError: driveError
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
