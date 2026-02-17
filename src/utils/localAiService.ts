import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'local_openai_api_key';

export const localAiService = {
    // --- key Management ---
    saveKey: (key: string) => {
        localStorage.setItem(STORAGE_KEY, key);
    },

    getKey: (): string | null => {
        return localStorage.getItem(STORAGE_KEY);
    },

    removeKey: () => {
        localStorage.removeItem(STORAGE_KEY);
    },

    hasKey: (): boolean => {
        return !!localStorage.getItem(STORAGE_KEY);
    },

    // --- Generation ---
    generateImage: async (prompt: string, apiKey?: string): Promise<string> => {
        const key = apiKey || localStorage.getItem(STORAGE_KEY);
        if (!key) {
            throw new Error("No API Key provided");
        }

        try {
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    response_format: "url" // We get a URL, then we'll fetch it to blob
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to generate image");
            }

            return data.data[0].url;
        } catch (error) {
            console.error("Local AI Generation Error:", error);
            throw error;
        }
    },

    // --- Storage ---
    // Helper to fetch the image from the external URL and upload it to Supabase
    // This is needed because OpenAI URLs expire, so we must persist it.
    uploadToSupabase: async (imageUrl: string, bucket: string = 'question-images'): Promise<string> => {
        try {
            // 1. Fetch the image data
            const res = await fetch(imageUrl);
            const blob = await res.blob();

            // 2. Generate a unique filename
            const filename = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

            // 3. Upload to Supabase
            const { error } = await supabase.storage
                .from(bucket)
                .upload(filename, blob, {
                    contentType: 'image/png'
                });

            if (error) throw error;

            // 4. Get Public URL
            const { data } = supabase.storage
                .from(bucket)
                .getPublicUrl(filename);

            return data.publicUrl;
        } catch (error) {
            console.error("Upload to Supabase failed:", error);
            throw error;
        }
    }
};
