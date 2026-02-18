
import { uploadAssetPersistently } from './assetPersistence';
import type { Asset } from '@/types/ui-builder';

/**
 * Saves a generated image URL to the project's asset library (Supabase Storage + DB).
 * 
 * @param imageUrl The URL of the image to save (must be accessible likely via CORS or proxy)
 * @param prompt The prompt used to generate the image (used for filename)
 * @param context The asset context (e.g. 'general', 'phonics', 'ui_builder')
 * @returns The saved Asset object or null if failed
 */
export const saveGeneratedImageToAssets = async (
    imageUrl: string,
    prompt: string,
    context: string = 'general'
): Promise<Asset | null> => {
    try {
        // 1. Fetch the image data
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();

        // 2. Create a File object
        // Sanitize prompt for filename
        const safePrompt = prompt.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        const filename = `ai_gen_${safePrompt}_${Date.now()}.png`;
        const file = new File([blob], filename, { type: blob.type || 'image/png' });

        // 3. Upload using existing persistence logic
        const asset = await uploadAssetPersistently(file, 'image', {
            context: context,
            category: 'ai-generated', // Default category for AI assets
            generated_from: 'flowith'
        });

        return asset;
    } catch (error) {
        console.error('Error saving AI image to assets:', error);
        throw error;
    }
};
