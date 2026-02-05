import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("🔥 generate-asset: Module Loaded (v3 - Multi-Model Support)");

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}));

        if (body.ping) {
            return new Response(JSON.stringify({ ok: true, message: "pong" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { prompt, style_preset, reference_images, model = "nano-banana-pro" } = body;
        const apiKey = Deno.env.get('FLOWITH_API_KEY');

        if (!apiKey) throw new Error("FLOWITH_API_KEY missing");
        if (!prompt) throw new Error("Prompt missing");

        // Strategy 1: Nano Banana Direct (More stable for this specific model)
        const isNanoBanana = model.includes('banana');
        const targetUrl = isNanoBanana
            ? 'https://nanobananapro.cloud/api/v1/image/nano-banana'
            : 'https://api.flowith.io/v1/images/generations';

        console.log(`📡 Calling Model: ${model} via ${targetUrl}`);

        const flowithBody = isNanoBanana ? {
            model: model,
            prompt: `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, game asset style, white background, isolated`,
            aspectRatio: "1:1",
            imageSize: "1K",
            imageUrl: Array.isArray(reference_images) && reference_images.length > 0 ? reference_images[0] : undefined
        } : {
            model: model,
            prompt: `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, game asset style, white background, isolated`,
            n: 1,
            size: "1024x1024",
            response_format: "url",
            images: Array.isArray(reference_images) ? reference_images.slice(0, 5) : undefined
        };

        const flowithResp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(flowithBody),
        });

        const flowithText = await flowithResp.text();
        console.log(`📶 Status: ${flowithResp.status} from ${targetUrl}`);

        let flowithData;
        try {
            flowithData = JSON.parse(flowithText);
        } catch {
            throw new Error(`Flowith non-JSON response (${flowithResp.status}): ${flowithText.slice(0, 100)}`);
        }

        if (!flowithResp.ok) {
            // Check for common Cloudflare 522/524 errors
            if (flowithResp.status === 522 || flowithResp.status === 524) {
                throw new Error(`The AI service is currently overloaded or timing out (Error ${flowithResp.status}). Please try switching the model or try again later.`);
            }
            throw new Error(`Flowith API error (${flowithResp.status}): ${JSON.stringify(flowithData)}`);
        }

        // Adapt response based on endpoint
        const imageUrl = isNanoBanana
            ? (flowithData.imageUrl || flowithData.data?.[0]?.url)
            : flowithData.data?.[0]?.url;

        if (!imageUrl) throw new Error("Image URL not found in response");

        return new Response(
            JSON.stringify({
                image: imageUrl,
                success: true,
                modelUsed: model
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("💥 Error:", error.message);
        return new Response(
            JSON.stringify({
                error: error.message,
                success: false,
                tip: "Try switching to 'Flux' model if Nano Banana is timing out."
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
})
