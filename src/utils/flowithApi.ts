import { supabase } from '@/integrations/supabase/client';

/**
 * Interface for Flowith API response when stream is false.
 */
interface FlowithResponse {
    tag: string;
    content: string;
}

/**
 * Calls the Flowith API to perform knowledge seeking or image generation via Supabase Edge Function Proxy.
 */
export async function call_flowith_api(
    prompt: string,
    model: string,
    tags: string[] = ['general'],
    stream: boolean = false
): Promise<FlowithResponse> {
    // We now use the Supabase Edge Function proxy
    // Endpoint path relative to the new host
    const endpointPath = '/external/use/seek-knowledge/seek';

    // Construct the payload expected by Flowith API
    // Doc: https://doc.flowith.io/knowledge-garden/knowledge-retrieval-api-guide
    const payload = {
        model: model, // Must be a valid model ID (e.g. 'gpt-4o-mini')
        stream: stream,
        messages: [
            {
                role: 'user',
                content: prompt // Must be a string
            }
        ],
        kb_list: tags // Assuming tags are used as kb_ids
    };

    try {
        const { data, error } = await supabase.functions.invoke('flowith-proxy', {
            body: {
                endpoint: endpointPath, // The proxy will prepend https://api.flowith.io
                method: 'POST',
                body: payload
            }
        });

        if (error) throw error;

        // Handle proxy diagnostics
        if (data && data.proxyError) {
            console.error('Proxy reported an error:', data);
            const detail = data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : 'Unknown proxy error';
            throw new Error(`[Proxy Error ${data.flowithStatus || 500}] ${detail} (URL: ${data.targetUrl})`);
        }

        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        // API returns just the response object, but we need to map it to FlowithResponse interface if needed
        // The previous error showed "tag" and "content" in the expected response type
        return data as FlowithResponse;
    } catch (error) {
        console.error('Error calling Flowith Proxy:', error);
        throw error;
    }
}

/**
 * Static list of verified Flowith models to avoid 522 timeouts on the models endpoint.
 */
export const FLOWITH_CHAT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet'];
export const FLOWITH_IMAGE_MODELS = ["nano-banana-pro", "seedream", "flux"];

/**
 * Fetches the list of available models from Flowith API via Supabase Proxy.
 * Now returns a hardcoded list immediately to avoid 522 timeouts.
 * @returns Array of model ID strings.
 */
export async function get_flowith_models(): Promise<string[]> {
    // We hardcode the models to avoid hitting the unstable /models endpoint
    return [...FLOWITH_CHAT_MODELS, ...FLOWITH_IMAGE_MODELS];
}
