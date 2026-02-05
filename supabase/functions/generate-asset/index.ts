import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("🔥 generate-asset: Module Loaded");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log("🚀 generate-asset: Handler Start -", req.method);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        let bodyText = "";
        try {
            bodyText = await req.text();
            console.log("📦 Body received (len):", bodyText.length);
        } catch (e) {
            console.error("❌ Body read error:", e);
        }

        if (!bodyText) {
            console.error("❌ No body text found");
            throw new Error("Missing request body");
        }

        let payload;
        try {
            payload = JSON.parse(bodyText);
        } catch (e) {
            console.error("❌ JSON Parse error:", e.message);
            throw new Error(`Invalid JSON: ${e.message}`);
        }

        const { prompt, style_preset, reference_images } = payload;
        const apiKey = Deno.env.get('FLOWITH_API_KEY');

        console.log("🔑 API Key Present:", !!apiKey);

        if (!apiKey) throw new Error('Missing FLOWITH_API_KEY');
        if (!prompt) throw new Error('Missing prompt');

        const flowithBody = {
            model: "nano-banana-pro",
            prompt: `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, game asset style, white background, isolated`,
            n: 1,
            size: "1024x1024",
            response_format: "url",
            images: Array.isArray(reference_images) ? reference_images.slice(0, 5) : undefined
        };

        console.log("📡 Calling Flowith...");
        const response = await fetch('https://api.flowith.io/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(flowithBody),
        });

        console.log("📶 Flowith HTTP Status:", response.status);

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Flowith API Error Payload:", data);
            throw new Error(`Flowith error (${response.status}): ${JSON.stringify(data)}`);
        }

        console.log("✅ Success! Image generated.");
        return new Response(
            JSON.stringify({
                image: data.data?.[0]?.url,
                success: true,
                model: "nano-banana-pro"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('💥 CRASH in handler:', error.message);
        return new Response(
            JSON.stringify({
                error: error.message,
                success: false,
                stack: error.stack
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
})
