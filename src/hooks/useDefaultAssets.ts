import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CityStyleAsset } from '@/types/city';

export function useDefaultAssets() {
    const [defaultTerrain, setDefaultTerrain] = useState<CityStyleAsset | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDefaults = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('city_style_assets')
                .select('*')
                .eq('is_default', true)
                .eq('asset_type', 'ground')
                .maybeSingle();

            if (error) {
                console.error('Error fetching default terrain:', error);
            } else {
                setDefaultTerrain(data as unknown as CityStyleAsset);
            }
        } catch (err) {
            console.error('Failed to fetch default assets:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDefaults();

        // Subscribe to Realtime updates for city_style_assets
        const channel = supabase
            .channel('city-assets-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'city_style_assets',
                    filter: 'is_default=eq.true',
                },
                () => {
                    fetchDefaults();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDefaults]);

    return { defaultTerrain, isLoading, refresh: fetchDefaults };
}
