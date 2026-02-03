
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
    model: string = 'google nano banana pro'
): Promise<string> {
    const apiKey = import.meta.env.VITE_FLOWITH_API_KEY || process.env.FLOWITH_API_KEY;

    if (!apiKey) {
        throw new Error('VITE_FLOWITH_API_KEY is not defined in .env file.');
    }

    const endpoint = 'https://edge.flowith.net/external/use/seek-knowledge/seek';

    const payload = {
        messages: [
            {
                role: 'user',
                content: query,
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
