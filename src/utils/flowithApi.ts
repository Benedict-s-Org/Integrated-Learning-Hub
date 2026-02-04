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
    const endpointPath = '/external/use/knowledge-base/seek';

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
 * Fetches the list of available models from Flowith API via Supabase Proxy.
 * @returns Array of model ID strings.
 */
export async function get_flowith_models(): Promise<string[]> {
    const endpointPath = '/external/use/knowledge-base/models';

    try {
        const { data, error } = await supabase.functions.invoke('flowith-proxy', {
            body: {
                endpoint: endpointPath,
                method: 'GET'
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        // Handle different possible response formats
        if (Array.isArray(data)) {
            if (typeof data[0] === 'string') return data;
            if (data[0] && typeof data[0] === 'object' && 'id' in data[0]) return data.map((m: any) => m.id);
            return [];
        } else if (data && Array.isArray(data.data)) {
            if (typeof data.data[0] === 'string') return data.data;
            if (data.data[0] && typeof data.data[0] === 'object' && 'id' in data.data[0]) return data.data.map((m: any) => m.id);
            return [];
        } else if (data && data.models && Array.isArray(data.models)) {
            return data.models;
        }

        console.warn('Unknown model list format:', data);
        return ['gpt-4o-mini', 'gpt-4o']; // Valid Fallbacks
    } catch (error) {
        console.error('Error fetching Flowith models:', error);
        // Fallback or empty array with VALID models
        return ['gpt-4o-mini', 'gpt-4o'];
    }
}
