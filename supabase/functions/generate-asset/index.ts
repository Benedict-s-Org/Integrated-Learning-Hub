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
        const apiKey = Deno.env.get('OPENAI_API_KEY')

        if (!apiKey) {
            throw new Error('Missing OPENAI_API_KEY in Supabase secrets')
        }

        if (!prompt) {
            throw new Error('Missing prompt in request body')
        }

        console.log(`Generating asset for prompt: ${prompt}`)

        // enhance prompt for game asset style
        const enhancedPrompt = `Isometric ${prompt}, ${style_preset || 'cute vector art style'}, high quality, simple design, thick outlines, white background, isolated, game asset style`

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: enhancedPrompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
                quality: "standard",
                style: "vivid"
            }),
        })

        const data = await response.json()

        if (data.error) {
            console.error('OpenAI API Error:', data.error)
            throw new Error(data.error.message || 'OpenAI API Error')
        }

        const image = data.data[0].b64_json
        const revisedPrompt = data.data[0].revised_prompt

        return new Response(
            JSON.stringify({
                image: `data:image/png;base64,${image}`,
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
