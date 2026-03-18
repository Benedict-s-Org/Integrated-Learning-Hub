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

const VOICE_MAPPING: Record<string, { name: string; languageCode: string }> = {
  "en-GB": { name: "en-GB-Neural2-B", languageCode: "en-GB" },
  "en-US": { name: "en-US-Neural2-F", languageCode: "en-US" },
  "en-AU": { name: "en-AU-Neural2-A", languageCode: "en-AU" },
};

/**
 * Gets a Google Auth token using the Service Account JSON
 */
async function getAccessToken(serviceAccount: any) {
  const { client_email, private_key } = serviceAccount;
  
  // We use a simplified JWT approach for the Edge environment
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

  // Sign the JWT (In Deno Edge environment, we use SubtleCrypto)
  const keyBuffer = Uint8Array.from(atob(private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----|\n/g, "")), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  
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
    const { text, accent = "en-GB" } = (await req.json()) as TTSRequest;
    if (!text) throw new Error("Text is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const saJson = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}");
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    // 1. Check Cache
    const { data: cache } = await supabase
      .from("tts_cache")
      .select("drive_file_id")
      .eq("text", text.toLowerCase().trim())
      .eq("accent", accent)
      .maybeSingle();

    const accessToken = await getAccessToken(saJson);

    if (cache?.drive_file_id) {
      console.log(`[Cache Hit] Fetching ${text} from Drive`);
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cache.drive_file_id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (driveRes.ok) {
        const audioBlob = await driveRes.blob();
        const buffer = await audioBlob.arrayBuffer();
        const audioContent = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return new Response(JSON.stringify({ audioContent, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.warn("Drive file missing even though cached. Re-generating...");
    }

    // 2. Generate New TTS
    console.log(`[Cache Miss] Generating TTS for: ${text}`);
    const voiceConfig = VOICE_MAPPING[accent] || VOICE_MAPPING["en-GB"];
    const ttsResponse = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
      }),
    });

    const ttsData = await ttsResponse.json();
    if (!ttsResponse.ok) throw new Error(ttsData.error?.message || "TTS Generation failed");

    // 3. Upload to Google Drive (Background Process)
    // We don't await this to keep the user response fast, but Deno.serve might kill it. 
    // For reliability, we await the upload but it's very quick.
    const fileName = `${accent}_${text.toLowerCase().replace(/[^a-z0-9]/g, "_")}.mp3`;
    const metadata = { name: fileName, parents: [folderId], mimeType: "audio/mpeg" };
    
    // Multi-part upload for Drive
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const multipartBody = 
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
      `${delimiter}Content-Type: audio/mpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${ttsData.audioContent}` +
      closeDelimiter;

    const driveUpload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    const driveData = await driveUpload.json();
    
    // 4. Save to Cache Table
    if (driveData.id) {
      await supabase.from("tts_cache").upsert({
        text: text.toLowerCase().trim(),
        accent,
        drive_file_id: driveData.id,
      });
    }

    return new Response(JSON.stringify({ audioContent: ttsData.audioContent, cached: false }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
