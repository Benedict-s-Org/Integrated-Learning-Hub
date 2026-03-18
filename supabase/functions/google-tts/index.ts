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
}

const VOICE_FALLBACKS: Record<string, string[]> = {
  "en-GB": ["en-GB-Neural2-B", "en-GB-Wavenet-B"],
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    // 1. Authenticate User (Require JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // 2. Setup Admin Client for DB writes
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const saJson = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}");
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    const { text, accent = "en-GB" } = (await req.json()) as TTSRequest;
    if (!text) throw new Error("Text is required");

    // 3. Normalize Text for Cache
    const normalizedText = text.trim().replace(/\s+/g, " ");
    const cacheKey = normalizedText.toLowerCase();

    // 4. Check Cache
    const { data: cache } = await supabaseAdmin
      .from("tts_cache")
      .select("drive_file_id")
      .eq("text", cacheKey)
      .eq("accent", accent)
      .maybeSingle();

    const accessToken = await getAccessToken(saJson);

    if (cache?.drive_file_id) {
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cache.drive_file_id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (driveRes.ok) {
        const audioBlob = await driveRes.blob();
        const buffer = await audioBlob.arrayBuffer();
        const audioContent = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return new Response(JSON.stringify({ audioContent, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 5. Generate TTS using SSML and Voice Fallbacks
    const ssml = toSSML(normalizedText);
    const voices = VOICE_FALLBACKS[accent] || VOICE_FALLBACKS["en-GB"];
    let ttsContent = null;
    let lastError = null;

    for (const voiceName of voices) {
      try {
        const ttsResponse = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: accent, name: voiceName },
            audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
          }),
        });
        const ttsData = await ttsResponse.json();
        if (ttsResponse.ok) {
          ttsContent = ttsData.audioContent;
          break;
        }
        lastError = ttsData.error?.message;
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!ttsContent) throw new Error(`TTS failed after fallback: ${lastError}`);

    // 6. Upload to Drive and Save to Cache
    const safeText = cacheKey.replace(/[^a-z0-9]/g, "_").substring(0, 50);
    const fileName = `${accent}_${safeText}.mp3`;
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
    if (driveData.id) {
      await supabaseAdmin.from("tts_cache").upsert({ text: cacheKey, accent, drive_file_id: driveData.id });
    }

    return new Response(JSON.stringify({ audioContent: ttsContent, cached: false }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
