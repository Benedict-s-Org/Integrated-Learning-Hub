import { supabase } from '@/integrations/supabase/client';
import type { Asset } from '@/types/ui-builder';

/**
 * Uploads an asset (file) to Supabase Storage and records metadata in the database
 */
export const uploadAssetPersistently = async (
    file: File,
    type: 'image' | 'document' | 'data',
    metadata: any = {}
): Promise<Asset | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileName = `${type}/${timestamp}_${randomString}_${file.name}`;

        // 1. Upload to Storage
        // Note: Ensure the 'ui-assets' bucket exists and is public or has appropriate RLS
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('ui-assets')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('ui-assets')
            .getPublicUrl(uploadData.path);

        // 3. Save to Database
        const { data: dbData, error: dbError } = await (supabase
            .from('ui_builder_assets' as any)
            .insert({
                name: file.name,
                type,
                metadata,
                storage_path: uploadData.path,
                public_url: publicUrl,
                created_by: user.id
            })
            .select()
            .single() as any);

        if (dbError) throw dbError;

        // 4. Map back to UI Builder Asset type
        const asset: Asset = {
            id: dbData.id,
            name: dbData.name,
            type: dbData.type,
            createdAt: dbData.created_at,
            ...(type === 'image' ? {
                image: {
                    id: dbData.id,
                    name: dbData.name,
                    url: dbData.public_url,
                    type: 'single',
                    createdAt: dbData.created_at
                }
            } : {}),
            ...(type === 'document' ? { document: { ...(dbData.metadata as any), id: dbData.id, fileName: dbData.name, url: dbData.public_url } } : {}),
            ...(type === 'data' ? { data: { ...(dbData.metadata as any), id: dbData.id, fileName: dbData.name } } : {}),
        };

        return asset;
    } catch (error) {
        console.error('Failed to persist asset:', error);
        return null;
    }
};

/**
 * Fetches all UI Builder assets from the database
 */
export const fetchUIBuilderAssets = async (): Promise<Asset[]> => {
    try {
        const { data, error } = await (supabase
            .from('ui_builder_assets' as any)
            .select('*')
            .order('created_at', { ascending: false }) as any);

        if (error) throw error;

        return data.map((item: any) => {
            const asset: Asset = {
                id: item.id,
                name: item.name,
                type: item.type,
                createdAt: item.created_at,
                ...(item.type === 'image' ? {
                    image: {
                        id: item.id,
                        name: item.name,
                        url: item.public_url,
                        type: 'single',
                        createdAt: item.created_at
                    }
                } : {}),
                ...(item.type === 'document' ? { document: { ...(item.metadata as any), id: item.id, fileName: item.name, url: item.public_url } } : {}),
                ...(item.type === 'data' ? { data: { ...(item.metadata as any), id: item.id, fileName: item.name } } : {}),
            };
            return asset;
        });
    } catch (error) {
        console.error('Failed to fetch assets:', error);
        return [];
    }
};

/**
 * Deletes an asset from both Storage and Database
 */
export const deleteUIBuilderAsset = async (asset: Asset): Promise<boolean> => {
    try {
        // 1. Get the storage path from the database first if not in asset object
        const { data, error: fetchError } = await (supabase
            .from('ui_builder_assets' as any)
            .select('storage_path')
            .eq('id', asset.id)
            .single() as any);

        if (fetchError) throw fetchError;

        // 2. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('ui-assets')
            .remove([data.storage_path]);

        if (storageError) throw storageError;

        // 3. Delete from Database
        const { error: dbError } = await supabase
            .from('ui_builder_assets' as any)
            .delete()
            .eq('id', asset.id);

        if (dbError) throw dbError;

        return true;
    } catch (error) {
        console.error('Failed to delete asset:', error);
        return false;
    }
};
