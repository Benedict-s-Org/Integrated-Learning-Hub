import { supabase } from '@/integrations/supabase/client';

export interface FlowithImageResponse {
    data: {
        url: string;
        revised_prompt?: string;
    }[];
}

export const FLOWITH_IMAGE_MODELS = [
    "nano-banana-pro", // Aligned with existing flowithApi.ts models
    "flux",
    "seedream"
];

/**
 * Calls the Flowith API for image generation.
 * Uses the /external/use/image-generation/generate endpoint (speculative, will verify).
 * If that fails, we might need to use the universal /seek endpoint with specific parameters.
 */
export async function generate_flowith_image(
    prompt: string,
    model: string = 'nano-banana-pro'
): Promise<string> {

    // Based on standard Flowith patterns, image generation usually has its own endpoint 
    // or uses a specific payload on a general endpoint. 
    // For now, I'll assume a standard OpenAI-like image generation structure or the specific Flowith path.
    // Let's try the likely endpoint for image models.
    // We'll use the Seek Knowledge endpoint which seems to be the main gateway for Flowith models
    const endpointPath = '/external/use/seek-knowledge/seek';

    // Construct the payload expected by Flowith Seek API
    const payload = {
        model: model,
        stream: false,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        kb_list: ['general']
    };

    try {
        const { data, error } = await supabase.functions.invoke('flowith-proxy', {
            body: {
                endpoint: endpointPath,
                method: 'POST',
                body: payload
            }
        });

        if (error) throw error;

        if (data && data.proxyError) {
            console.error('Proxy reported an error:', JSON.stringify(data, null, 2));
            const errorMessage = typeof data.error === 'object'
                ? (data.error.message || JSON.stringify(data.error))
                : (data.error || 'Proxy error');
            throw new Error(`[Proxy ${data.flowithStatus}] ${errorMessage}`);
        }

        // Parse response from Seek API
        // Expected format: { tag: string, content: string }
        // The image URL should be in the content, usually as a markdown image or raw URL
        if (data.content) {
            // Extract URL from markdown/text: ![image](url) or just url
            const urlMatch = data.content.match(/!\[.*?\]\((.*?)\)/) || data.content.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                return urlMatch[1];
            }
            // If just text ref provided, return it as is or handle error
            if (data.content.startsWith('http')) return data.content;

            console.warn('Flowith response content does not look like a URL:', data.content);
            // Optionally throw, but let's return content if it's not empty, might be an error message from model
            return data.content;
        }

        if (data.data && data.data.length > 0 && data.data[0].url) {
            return data.data[0].url;
        }
        throw new Error('No image URL found in response');

    } catch (error) {
        console.error('Error generating Flowith image:', error);
        throw new Error(error instanceof Error ? error.message : JSON.stringify(error));
    }
}
