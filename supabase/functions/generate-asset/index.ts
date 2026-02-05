import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        // Log start of function
        console.log("generate-asset: Function invoked");

        const bodyText = await req.text();
        console.log("Request Body Raw:", bodyText);

        let payload;
        try {
            payload = JSON.parse(bodyText);
        } catch (e) {
            console.error("Failed to parse request JSON:", bodyText);
            throw new Error("Invalid JSON in request body");
        }

        const { prompt, style_preset, reference_images } = payload;
        const apiKey = Deno.env.get('FLOWITH_API_KEY');

        console.log("API Key exists:", !!apiKey);

        if (!apiKey) {
            throw new Error('Missing FLOWITH_API_KEY in Supabase secrets. Please set it using: supabase secrets set FLOWITH_API_KEY=...');
        }

        if (!prompt) {
            throw new Error('Missing prompt in request body');
        }

        console.log(`Generating asset for prompt: ${prompt}. References: ${reference_images?.length || 0}`);

        // enhance prompt for game asset style
        const enhancedPrompt = `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, simple design, thick outlines, white background, isolated, game asset style`;

        const flowithBody: any = {
            model: "nano-banana-pro",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024",
            response_format: "url"
        };

        if (reference_images && Array.isArray(reference_images) && reference_images.length > 0) {
            flowithBody.images = reference_images.slice(0, 10);
        }

        console.log("Calling Flowith API...");
        const response = await fetch('https://api.flowith.io/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(flowithBody),
        });

        console.log("Flowith status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Flowith error response:", errorText);
            throw new Error(`Flowith API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log("Flowith data received successfully");

        const imageUrl = data.data?.[0]?.url;
        const revisedPrompt = data.data?.[0]?.revised_prompt;

        if (!imageUrl) {
            console.error("No image URL in Flowith response:", data);
            throw new Error("Flowith API succeeded but returned no image URL");
        }

        return new Response(
            JSON.stringify({
                image: imageUrl,
                revisedPrompt: revisedPrompt,
                model: "nano-banana-pro"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('generate-asset Full Error:', error);
        return new Response(
            JSON.stringify({
                error: error.message,
                status: 500
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
