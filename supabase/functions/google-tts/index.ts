// Force redeploy to update secrets
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TTSRequest {
  text: string;
  accent?: string;
  voiceName?: string;
  speakingRate?: number;
}

interface TTSResponse {
  audioUrl: string;
  driveFileId: string;
  cached: boolean;
  voiceName: string;
  speakingRate: number;
  /** @deprecated Use audioUrl instead. Kept for backward compatibility. */
  audioContent?: string;
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
 * Gets a Google Auth token using Service Account JSON for Drive/TTS operations.
 */
async function getAccessToken({ client_email, private_key }: { client_email: string, private_key: string }): Promise<string> {
  if (!client_email || !private_key) {
    throw new Error(`Invalid Service Account: client_email or private_key missing. (Got email=${!!client_email}, key=${!!private_key})`);
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
 * Downloads a file from Google Drive as Base64 using internal service account auth.
 */
async function downloadFromDrive(fileId: string, accessToken: string): Promise<string> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&supportsTeamDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    const err = await response.text();
    console.error(`[google-tts] Failed to download from Drive ${fileId}:`, err);
    throw new Error(`Drive download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  // Using btoa with chunking for large files would be better, but small MP3s are fine
  const uint8 = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Set "anyone with the link can read" permission on a Drive file.
 */
async function setDrivePublicPermission(fileId: string, accessToken: string): Promise<void> {
  const permRes = await fetch(
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

  if (!permRes.ok) {
    const errBody = await permRes.text();
    console.warn(`[google-tts] Permission setting error (might be org policy):`, errBody);
    // Non-fatal, return the ID anyway; maybe the file is already accessible.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let raw = "";
  try {
    raw = await req.text();
  } catch (e) {}

  let requestBody: any = {};
  try {
    if (raw.trim()) requestBody = JSON.parse(raw);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate User ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Auth failed" }), { status: 401, headers: corsHeaders });

    // ── 2. Setup Admin Client ────────────────────────────────────────
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    let saJson: any = {};
    const saEnv = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}";
    try {
      saJson = JSON.parse(saEnv);
    } catch (e) {}
    
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    // ── 3. Parse Request ─────────────────────────────────────────────
    const { text, accent = "en-GB", voiceName, speakingRate } = requestBody as TTSRequest;
    if (!text) throw new Error("Text is required");

    const normalizedText = text.trim().replace(/\s+/g, " ");
    const cacheText = normalizedText.toLowerCase();
    const effectiveVoice = voiceName || (VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"])[0] || DEFAULT_VOICE;
    const effectiveRate = speakingRate ?? DEFAULT_SPEAKING_RATE;

    // ── 4. Cache lookup ──────────────────────────────────────────────
    const { data: cacheHit } = await supabaseAdmin
      .from("tts_cache")
      .select("drive_file_id")
      .eq("text", cacheText)
      .eq("accent", accent)
      .eq("voice_name", effectiveVoice)
      .eq("speaking_rate", effectiveRate)
      .maybeSingle();

    if (cacheHit?.drive_file_id) {
      console.log(`[google-tts] Cache HIT: ${cacheHit.drive_file_id}. Fetching from Drive...`);
      try {
        const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
        let googleToken: string | null = null;
        googleToken = await getAccessToken(saJson); // Still need token for Drive download even if apiKey exists for synthesis
        
        const base64Audio = await downloadFromDrive(cacheHit.drive_file_id, googleToken);
        
        return new Response(JSON.stringify({
          audioUrl: driveDownloadUrl(cacheHit.drive_file_id), // Keep for ref, but fallback to content
          audioContent: base64Audio,
          driveFileId: cacheHit.drive_file_id,
          cached: true,
          voiceName: effectiveVoice,
          speakingRate: effectiveRate,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (hitError: any) {
        console.warn(`[google-tts] Proxy failed for cached file: ${hitError.message}. Re-generating...`);
        // Fall through to re-generation if proxy fails
      }
    }

    // ── 5. Get Synthesis Authorization ──────────────────────────────
    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    let googleToken: string | null = null;
    if (!apiKey) googleToken = await getAccessToken(saJson);

    // ── 6. Generate TTS ──────────────────────────────────────────────
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
        console.warn(`[google-tts] Voice ${currentVoice} failed: ${data.error?.message}`);
      } catch (e) {}
    }

    if (!ttsContent) throw new Error("TTS synthesis failed");

    // ── 7. Upload to Google Drive ────────────────────────────────────
    const hashInput = `${cacheText}|${accent}|${effectiveVoice}|${effectiveRate}`;
    const fileHash = await sha256(hashInput);
    const fileName = `${fileHash}.mp3`;

    let driveFileId: string | null = null;
    let driveError: string | null = null;

    try {
      const driveAccessToken = googleToken || await getAccessToken(saJson);
      const metadata: any = { name: fileName, mimeType: "audio/mpeg" };
      if (folderId) metadata.parents = [folderId];

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

      if (!uploadRes.ok) {
        const errBody = await uploadRes.text();
        console.error(`[google-tts] Drive upload failed:`, errBody);
        driveError = `Upload failed (${uploadRes.status})`;
        if (errBody.includes("storageQuotaExceeded")) {
          driveError = "Quota Exceeded. Ensure you use a Shared Drive (and add the Service Account as a Contributor).";
        }
      } else {
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
      }
    } catch (e: any) {
      driveError = e.message;
    }

    return new Response(JSON.stringify({
      audioUrl: driveFileId ? driveDownloadUrl(driveFileId) : "",
      driveFileId: driveFileId || "",
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
