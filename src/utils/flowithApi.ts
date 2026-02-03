
/**
 * Interface for Flowith API response when stream is false.
 */
interface FlowithResponse {
    tag: string;
    content: string;
}

/**
 * Calls the Flowith API to perform knowledge seeking or image generation.
 * 
 * @param query - The user's question or prompt.
 * @param kb_ids - Array of Knowledge Base IDs to retrieve information from.
 * @param model - The model to use. Defaults to 'google nano banana pro' as requested.
 * @returns The final content string from the API response.
 */
export async function call_flowith_api(
    query: string,
    kb_ids: string[],
    model: string = 'google nano banana pro',
    refImage?: string,
    refDesc?: string,
    targetImage?: string
): Promise<string> {
    const apiKey = import.meta.env.VITE_FLOWITH_API_KEY || process.env.FLOWITH_API_KEY;

    if (!apiKey) {
        throw new Error('VITE_FLOWITH_API_KEY is not defined in .env file.');
    }

    const endpoint = 'https://edge.flowith.net/external/use/seek-knowledge/seek';

    // Construct content payload
    let contentPayload: any = query;

    // If images are present, we use the multimodal format (array of content parts)
    if (refImage || targetImage) {
        contentPayload = [];

        // Add user query text
        if (query) {
            contentPayload.push({
                type: 'text',
                text: query
            });
        }

        // Add Reference Style Image
        if (refImage) {
            let descText = "Reference Style Image";
            if (refDesc) descText += `: ${refDesc}`;

            contentPayload.push({
                type: 'text',
                text: descText
            });
            contentPayload.push({
                type: 'image_url',
                image_url: {
                    url: refImage
                }
            });
        }

        // Add Target Content Image
        if (targetImage) {
            contentPayload.push({
                type: 'text',
                text: "Target Content Image"
            });
            contentPayload.push({
                type: 'image_url',
                image_url: {
                    url: targetImage
                }
            });
        }
    }

    const payload = {
        messages: [
            {
                role: 'user',
                content: contentPayload,
            },
        ],
        model: model,
        stream: false,
        kb_list: kb_ids,
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Flowith API request failed with status ${response.status}: ${errorText}`);
        }

        const data: FlowithResponse = await response.json();

        if (data.tag !== 'final') {
            // In case the API behavior changes or non-final tag is returned for stream=false
            console.warn(`Unexpected tag in Flowith response: ${data.tag}`);
        }

        return data.content;

    } catch (error) {
        console.error('Error calling Flowith API:', error);
        throw error; // Re-throw to let the caller handle it
    }
}

/**
 * Fetches the list of available models from Flowith API.
 * @returns Array of model ID strings.
 */
export async function get_flowith_models(): Promise<string[]> {
    const apiKey = import.meta.env.VITE_FLOWITH_API_KEY || process.env.FLOWITH_API_KEY;

    if (!apiKey) {
        throw new Error('VITE_FLOWITH_API_KEY is not defined in .env file.');
    }

    const endpoint = 'https://edge.flowith.net/external/use/seek-knowledge/models';

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Handle different possible response formats
        if (Array.isArray(data)) {
            // Assume array of strings or objects
            if (typeof data[0] === 'string') return data;
            if (data[0] && typeof data[0] === 'object' && 'id' in data[0]) return data.map((m: any) => m.id);
            return []; // Unknown format
        } else if (data && Array.isArray(data.data)) {
            // Standard format { data: [...] }
            if (typeof data.data[0] === 'string') return data.data;
            if (data.data[0] && typeof data.data[0] === 'object' && 'id' in data.data[0]) return data.data.map((m: any) => m.id);
            return [];
        }

        console.warn('Unknown model list format:', data);
        return ['google nano banana pro', 'gpt-4o-mini']; // Fallback

    } catch (error) {
        console.error('Error fetching Flowith models:', error);
        return ['google nano banana pro', 'gpt-4o-mini']; // Fallback on error
    }
}
