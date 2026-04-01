import { supabase } from '@/integrations/supabase/client';

/**
 * Metadata for indexing a Drive asset.
 */
export interface SyncMetadata {
    word?: string;
    category?: string;
    context?: string;
    source?: string;
    originalName?: string;
}

/**
 * Universal utility to sync an asset to Google Drive and update its master index.
 */
export const syncAssetToDrive = async (
    sourceUrl: string,
    fileName: string,
    folderPath: string,
    metadata: SyncMetadata = {}
) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers = {
            'Authorization': `Bearer ${session?.access_token || anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
        };

        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-search`;

        // 1. Upload the main asset
        const uploadRes = await fetch(functionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                action: 'upload',
                url: sourceUrl,
                customFileName: fileName,
                folderName: folderPath
            })
        });

        if (!uploadRes.ok) throw new Error(`Drive upload failed: ${uploadRes.statusText}`);
        const uploadData = await uploadRes.json();

        // 2. Update the Master Index in this folder
        // We propose a standard row format: [Timestamp, Name, Category, Word, Source, Drive URL]
        const timestamp = new Date().toISOString();
        const row = [
            timestamp,
            metadata.originalName || fileName,
            metadata.category || 'general',
            metadata.word || '',
            metadata.source || 'Upload',
            uploadData.url || ''
        ];

        const indexRes = await fetch(functionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                action: 'update_index',
                folderName: folderPath,
                customFileName: 'master_index.csv',
                header: ["Timestamp", "Item Name", "Category", "Word/Key", "Source", "Drive URL"],
                row
            })
        });

        if (!indexRes.ok) {
            console.warn('Failed to update Drive index, but upload succeeded.', await indexRes.text());
        }

        return uploadData;
    } catch (error) {
        console.error('Core Drive Sync Error:', error);
        return null;
    }
};

/**
 * Specialized version for TTS sync (audio)
 */
export const syncAudioToDrive = async (
    word: string,
    accent: string = 'en-GB',
    folderPath: string
) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token || anonKey}`,
                'apikey': anonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text: word, 
                accent,
                folderName: folderPath,
                // The google-tts function handles its own Drive sync if folderName is provided
            })
        });
        
        if (!res.ok) throw new Error(`Audio sync failed: ${res.statusText}`);
        return await res.json();
    } catch (error) {
        console.error('Audio Drive Sync Error:', error);
        return null;
    }
};
