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
async function getAccessToken(serviceAccount: any) {
  const { client_email, private_key } = serviceAccount;
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    iss: client_email,
    sub: client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/drive.file",
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
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
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
    console.error(`[google-tts] Failed to set Drive permission for ${fileId}:`, errBody);
    throw new Error(`Drive permission error: ${permRes.status} – ${errBody}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let raw = "";
  try {
    raw = await req.text();
    console.log("RAW_BODY:", raw);
  } catch (e) {
    console.error("Failed to read request body text:", e.message);
  }

  let requestBody: any = {};
  try {
    if (raw.trim()) {
      requestBody = JSON.parse(raw);
    }
  } catch (e) {
    console.error("PARSE_FAIL: request_body", e.message, "RAW_BODY:", raw);
    return new Response(JSON.stringify({ error: "Invalid JSON in request body", details: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // ── 1. Authenticate User ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[google-tts] Missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[google-tts] Auth error:", authError?.message || "No user found");
      return new Response(JSON.stringify({ 
        error: `Unauthorized: ${authError?.message || "No user found"}`,
        details: "JWT validation failed. Ensure you are logged in."
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // ── 2. Setup Admin Client for DB writes ──────────────────────────
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    let saJson: any = {};
    try {
      const saEnv = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}";
      saJson = JSON.parse(saEnv);
    } catch (e) {
      console.error("PARSE_FAIL: GOOGLE_SERVICE_ACCOUNT_JSON", e.message);
      return new Response(JSON.stringify({ error: "Server Configuration Error", details: "Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    // ── 3. Parse & normalize request ─────────────────────────────────
    const { text, accent = "en-GB", voiceName, speakingRate } = requestBody as TTSRequest;

    if (!text) throw new Error("Text is required");

    const normalizedText = text.trim().replace(/\s+/g, " ");
    const cacheText = normalizedText.toLowerCase();

    // Resolve effective voice: use provided voiceName, or first fallback for accent
    const effectiveVoice = voiceName || (VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"])[0] || DEFAULT_VOICE;
    const effectiveRate = speakingRate ?? DEFAULT_SPEAKING_RATE;

    console.log(`[google-tts] Request: voice=${effectiveVoice}, rate=${effectiveRate}, accent=${accent}, text="${normalizedText.substring(0, 40)}..."`);

    // ── 4. Cache lookup (all 4 columns) ──────────────────────────────
    const { data: cacheHit, error: cacheErr } = await supabaseAdmin
      .from("tts_cache")
      .select("drive_file_id")
      .eq("text", cacheText)
      .eq("accent", accent)
      .eq("voice_name", effectiveVoice)
      .eq("speaking_rate", effectiveRate)
      .maybeSingle();

    if (cacheErr) {
      console.error("[google-tts] Cache lookup error:", cacheErr.message);
      // Non-fatal: continue to generate
    }

    if (cacheHit?.drive_file_id) {
      console.log(`[google-tts] Cache HIT – drive_file_id=${cacheHit.drive_file_id}`);
      const response: TTSResponse = {
        audioUrl: driveDownloadUrl(cacheHit.drive_file_id),
        driveFileId: cacheHit.drive_file_id,
        cached: true,
        voiceName: effectiveVoice,
        speakingRate: effectiveRate,
      };
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[google-tts] Cache MISS – generating TTS audio");

    // ── 5. Get Google access token ───────────────────────────────────
    const accessToken = await getAccessToken(saJson);

    // ── 6. Generate TTS with voice fallbacks ─────────────────────────
    const ssml = toSSML(normalizedText);

    // Build ordered list: preferred voice first, then fallbacks
    const voicesToTry: string[] = [effectiveVoice];
    const fallbacks = VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"];
    fallbacks.forEach((v) => {
      if (v !== effectiveVoice) voicesToTry.push(v);
    });

    let ttsContent: string | null = null;
    let usedVoice = effectiveVoice;
    let lastError: string | null = null;

    for (const currentVoice of voicesToTry) {
      try {
        const ttsResponse = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: accent, name: currentVoice },
            audioConfig: { audioEncoding: "MP3", speakingRate: effectiveRate },
          }),
        });
        const ttsData = await ttsResponse.json();
        if (ttsResponse.ok) {
          ttsContent = ttsData.audioContent;
          usedVoice = currentVoice;
          break;
        }
        lastError = ttsData.error?.message;
        console.warn(`[google-tts] Voice ${currentVoice} failed: ${lastError}`);
      } catch (e) {
        lastError = e.message;
        console.warn(`[google-tts] Voice ${currentVoice} threw: ${lastError}`);
      }
    }

    if (!ttsContent) throw new Error(`TTS generation failed after trying all voices: ${lastError}`);

    // ── 7. Deterministic file name via SHA-256 ───────────────────────
    const hashInput = `${cacheText}|${accent}|${effectiveVoice}|${effectiveRate}`;
    const fileHash = await sha256(hashInput);
    const fileName = `${fileHash}.mp3`;

    // ── 8. Upload to Google Drive ────────────────────────────────────
    const metadata = { name: fileName, parents: [folderId], mimeType: "audio/mpeg" };
    const boundary = "-------314159265358979323846";
    const multipartBody = 
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
      `\r\n--${boundary}\r\nContent-Type: audio/mpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${ttsContent}` +
      `\r\n--${boundary}--`;

    const driveUpload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    });

    const driveData = await driveUpload.json();

    if (!driveData.id) {
      console.error("[google-tts] Drive upload failed:", JSON.stringify(driveData));
      throw new Error(`Drive upload failed: ${driveData.error?.message || "No file ID returned"}`);
    }

    console.log(`[google-tts] Uploaded to Drive: ${driveData.id} (${fileName})`);

    // ── 9. Set public read permission ────────────────────────────────
    try {
      await setDrivePublicPermission(driveData.id, accessToken);
      console.log(`[google-tts] Set public permission on ${driveData.id}`);
    } catch (permError) {
      // Log but don't fail — the file was uploaded successfully
      console.error("[google-tts] Permission setting failed (non-fatal):", permError.message);
    }

    // ── 10. Upsert cache row ─────────────────────────────────────────
    const { error: upsertError } = await supabaseAdmin
      .from("tts_cache")
      .upsert(
        {
          text: cacheText,
          accent,
          voice_name: effectiveVoice,
          speaking_rate: effectiveRate,
          drive_file_id: driveData.id,
        },
        { onConflict: "text,accent,voice_name,speaking_rate" }
      );

    if (upsertError) {
      // Log but don't fail — audio was generated and uploaded successfully
      console.error("[google-tts] Cache upsert failed (non-fatal):", upsertError.message);
    } else {
      console.log("[google-tts] Cache upserted successfully");
    }

    // ── 11. Return response ──────────────────────────────────────────
    const response: TTSResponse = {
      audioUrl: driveDownloadUrl(driveData.id),
      driveFileId: driveData.id,
      cached: false,
      voiceName: usedVoice,
      speakingRate: effectiveRate,
      // Backward compat: include base64 so existing frontends still work
      audioContent: ttsContent,
    };

    return new Response(JSON.stringify(response), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("[google-tts] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
