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
        const { endpoint, method, body } = await req.json()
        const apiKey = Deno.env.get('FLOWITH_API_KEY')

        if (!apiKey) {
            throw new Error('Missing FLOWITH_API_KEY in Supabase secrets')
        }

        // Replace the edge domain with the main API host as requested
        // Logic: if the requested endpoint contains 'edge.flowith.net', force it to 'api.flowith.io'
        // Or simply expect the client to send the correct path, but we enforce the host here for safety.

        // Actually, let's allow flexibility but default to the user's requested fix
        let targetUrl = endpoint || '';
        if (targetUrl.includes('edge.flowith.net')) {
            targetUrl = targetUrl.replace('edge.flowith.net', 'api.flowith.io');
        }

        if (targetUrl && !targetUrl.startsWith('http')) {
            targetUrl = `https://api.flowith.io${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
        }

        console.log(`Proxying request to Flowith: ${targetUrl} [${method}]`)

        const response = await fetch(targetUrl, {
            method: method || 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        // Safely parse JSON or return text
        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text.slice(0, 500) }; // Capture start of HTML if any
        }

        if (!response.ok) {
            console.error('Flowith API Error:', data)
            return new Response(
                JSON.stringify({
                    error: data,
                    proxyError: true,
                    flowithStatus: response.status,
                    targetUrl: targetUrl
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Proxy Catch Error:', error.message)
        return new Response(
            JSON.stringify({
                error: error.message,
                proxyError: true,
                status: 500,
                targetUrl: 'Check logs for URL'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
