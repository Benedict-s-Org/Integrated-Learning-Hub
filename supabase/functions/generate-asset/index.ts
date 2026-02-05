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
        const { prompt, style_preset } = await req.json()
        const apiKey = Deno.env.get('FLOWITH_API_KEY')

        if (!apiKey) {
            throw new Error('Missing FLOWITH_API_KEY in Supabase secrets')
        }

        if (!prompt) {
            throw new Error('Missing prompt in request body')
        }

        console.log(`Generating asset for prompt: ${prompt} using Flowith`)

        // enhance prompt for game asset style
        const enhancedPrompt = `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, simple design, thick outlines, white background, isolated, game asset style`

        const response = await fetch('https://api.flowith.io/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "nano-banana-pro",
                prompt: enhancedPrompt,
                n: 1,
                size: "1024x1024",
                response_format: "url"
            }),
        })

        const data = await response.json()

        if (!response.ok || data.error) {
            console.error('Flowith API Error:', data.error || data)
            throw new Error(data.error?.message || data.message || 'Flowith API Error')
        }

        const imageUrl = data.data[0].url
        const revisedPrompt = data.data[0].revised_prompt

        return new Response(
            JSON.stringify({
                image: imageUrl,
                revisedPrompt: revisedPrompt
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
