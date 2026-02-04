
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

    const endpoint = 'https://edge.flowith.net/external/use/knowledge-base/seek';

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
                prompt: string,
                model: string,
                tags: string[] = ['general'],
                stream: boolean = false
): Promise < FlowithResponse > {
                // We now use the Supabase Edge Function proxy
                // Endpoint path relative to the new host
                const endpointPath = '/external/use/knowledge-base/seek';

                try {
                    const { data, error } = await supabase.functions.invoke('flowith-proxy', {
                        body: {
                            endpoint: endpointPath, // The proxy will prepend https://api.flowith.io
                            method: 'POST',
                            body: {
                                prompt,
                                model,
                                tags,
                                stream
                            }
                        }
                    });

                    if(error) throw error;
                    if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));

                    return data as FlowithResponse;
                } catch(error) {
                    console.error('Error calling Flowith Proxy:', error);
                    throw error;
                }
            }

            /**
             * Fetches the list of available models from Flowith API.
             * @returns Array of model ID strings.
             */
            export async function get_flowith_models(): Promise<string[]> {
            }

            console.warn('Unknown model list format:', data);
            return ['google nano banana pro', 'gpt-4o-mini']; // Fallback

        } catch (error) {
            console.error('Error fetching Flowith models:', error);
            return ['google nano banana pro', 'gpt-4o-mini']; // Fallback on error
        }
    }
