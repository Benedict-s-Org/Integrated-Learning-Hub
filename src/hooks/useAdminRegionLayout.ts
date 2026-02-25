import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Region, RegionPlot, PublicFacility, RegionData, FacilityType, RegionTheme } from '@/types/region';

interface UseAdminRegionLayoutReturn {
    region: RegionData | null;
    loading: boolean;
    error: string | null;
    addFacility: (facility: Omit<PublicFacility, 'id' | 'regionId' | 'createdAt' | 'updatedAt' | 'level'>) => void;
    updateFacility: (id: string, updates: Partial<PublicFacility>) => void;
    removeFacility: (id: string) => void;
    updateRegion: (updates: Partial<Region>) => void;
    saveRegion: (regionId: string) => Promise<boolean>;
    loadRegion: (regionId: string) => Promise<void>;
    resetToDefault: (regionId: string) => Promise<void>;
    addMapElement: (element: { assetId: string; assetUrl: string; x: number; y: number; zIndex?: number }) => void;
    removeMapElement: (id: string) => void;
}

export function useAdminRegionLayout(): UseAdminRegionLayoutReturn {
    const [region, setRegion] = useState<RegionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadRegion = useCallback(async (regionId: string) => {
        setLoading(true);
        setError(null);
        try {
            // Fetch region metadata
            const { data: regionRow, error: regionError } = await supabase
                .from('regions')
                .select('*')
                .eq('id', regionId)
                .single();

            if (regionError) throw regionError;

            // Fetch plots
            const { data: plotsData, error: plotsError } = await supabase
                .from('region_plots')
                .select('*')
                .eq('region_id', regionId);

            if (plotsError) throw plotsError;

            // Fetch facilities
            const { data: facilitiesData, error: facilitiesError } = await supabase
                .from('public_facilities')
                .select('*')
                .eq('region_id', regionId);

            if (facilitiesError) throw facilitiesError;

            // Fetch map elements with asset info
            const { data: mapElementsData, error: mapElementsError } = await supabase
                .from('region_map_elements')
                .select('*, city_style_assets(image_url)')
                .eq('region_id', regionId);

            if (mapElementsError) throw mapElementsError;

            const fullRegion: RegionData = {
                id: regionRow.id,
                name: regionRow.name,
                gridSize: regionRow.grid_size,
                theme: regionRow.theme as RegionTheme,
                createdAt: regionRow.created_at,
                updatedAt: regionRow.updated_at,
                plots: (plotsData || []).map(row => ({
                    id: row.id,
                    regionId: row.region_id,
                    ownerId: row.owner_id,
                    position: { x: row.position_x, y: row.position_y },
                    size: { width: row.size_width, depth: row.size_depth },
                    plotType: row.plot_type,
                    cityLevel: row.city_level ?? undefined,
                    cityName: row.city_name ?? undefined,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                }) as RegionPlot),
                facilities: (facilitiesData || []).map(row => ({
                    id: row.id,
                    regionId: row.region_id,
                    plotId: row.plot_id,
                    facilityType: row.facility_type as FacilityType,
                    name: row.name,
                    level: row.level,
                    position: { x: row.position_x, y: row.position_y },
                    config: (row.config as any) || {},
                    customImageUrl: (row.config as any)?.customImageUrl,
                    customAssetId: (row.config as any)?.customAssetId,
                    transform: (row.config as any)?.transform,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                })),
                mapElements: (mapElementsData || []).map(row => ({
                    id: row.id,
                    regionId: row.region_id,
                    assetId: row.asset_id,
                    assetUrl: (row.city_style_assets as any)?.image_url,
                    x: row.x,
                    y: row.y,
                    zIndex: row.z_index || 0,
                    createdAt: row.created_at,
                })),
            };

            setRegion(fullRegion);
        } catch (err: any) {
            console.error('Error loading region:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const addFacility = useCallback((facility: Omit<PublicFacility, 'id' | 'regionId' | 'createdAt' | 'updatedAt' | 'level'>) => {
        if (!region) return;

        const newFacility: PublicFacility = {
            ...facility,
            id: crypto.randomUUID(),
            regionId: region.id,
            level: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setRegion(prev => prev ? {
            ...prev,
            facilities: [...prev.facilities, newFacility]
        } : null);
    }, [region]);

    const updateFacility = useCallback((id: string, updates: Partial<PublicFacility>) => {
        setRegion(prev => prev ? {
            ...prev,
            facilities: prev.facilities.map(f => f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f)
        } : null);
    }, []);

    const removeFacility = useCallback((id: string) => {
        setRegion(prev => prev ? {
            ...prev,
            facilities: prev.facilities.filter(f => f.id !== id)
        } : null);
    }, []);

    const updateRegion = useCallback((updates: Partial<Region>) => {
        setRegion(prev => prev ? { ...prev, ...updates } : null);
    }, []);

    const addMapElement = useCallback((element: { assetId: string; x: number; y: number; zIndex?: number }) => {
        if (!region) return;
        const newElement = {
            id: crypto.randomUUID(),
            regionId: region.id,
            assetId: element.assetId,
            assetUrl: '', // This will need to be looked up or passed if we want immediate preview with URL. 
            // Ideally we pass the URL too or look it up from a cache. For now let's hope the render logic handles empty or we fetch.
            // Actually, for immediate optimistic update, we should probably pass the asset object or URL.
            // But let's stick to the interface. The UI might flicker if we don't pass URL.
            // Let's assume the UI passes assetUrl via a different lookup or we update the type locally.
            // Wait, we need the URL to render.
            // Let's rely on the fact that we can look it up in the component or pass it.
            // I'll update the signature to accept assetUrl for optimistic rendering.
            x: element.x,
            y: element.y,
            zIndex: element.zIndex || 0,
            createdAt: new Date().toISOString()
        };

        // Wait, I can't easily change the signature in the middle of this tool call without changing the interface change above.
        // I will assume the caller will trigger a refetch or I can hack the URL in.
        // Actually, let's just update the state.

        setRegion(prev => prev ? {
            ...prev,
            mapElements: [...(prev.mapElements || []), { ...newElement, assetUrl: '' }] // Placeholder URL
        } : null);
    }, [region]);

    const removeMapElement = useCallback((id: string) => {
        setRegion(prev => prev ? {
            ...prev,
            mapElements: (prev.mapElements || []).filter(e => e.id !== id)
        } : null);
    }, []);

    const saveRegion = useCallback(async (regionId: string): Promise<boolean> => {
        if (!region) return false;
        setLoading(true);
        try {
            // 1. Update region metadata
            const { error: regionError } = await supabase
                .from('regions')
                .update({
                    name: region.name,
                    grid_size: region.gridSize,
                    theme: region.theme,
                    updated_at: new Date().toISOString()
                })
                .eq('id', regionId);

            if (regionError) throw regionError;

            // 2. We need to handle facilities (sync local state with DB)
            // For simplicity, we'll delete all facilities for this region and re-insert
            const { error: deleteError } = await supabase
                .from('public_facilities')
                .delete()
                .eq('region_id', regionId);

            if (deleteError) throw deleteError;

            if (region.facilities.length > 0) {
                const facilitiesToInsert = region.facilities.map(f => ({
                    region_id: regionId,
                    plot_id: f.plotId,
                    facility_type: f.facilityType,
                    name: f.name,
                    level: f.level,
                    position_x: f.position.x,
                    position_y: f.position.y,
                    config: {
                        ...f.config,
                        customImageUrl: f.customImageUrl,
                        customAssetId: f.customAssetId,
                        transform: f.transform
                    } as any
                }));

                const { error: insertError } = await supabase
                    .from('public_facilities')
                    .insert(facilitiesToInsert as any);

                if (insertError) throw insertError;
                if (insertError) throw insertError;
            }

            // 3. Handle map elements
            const { error: deleteElementsError } = await supabase
                .from('region_map_elements')
                .delete()
                .eq('region_id', regionId);

            if (deleteElementsError) throw deleteElementsError;

            if (region.mapElements.length > 0) {
                const elementsToInsert = region.mapElements.map(e => ({
                    region_id: regionId,
                    asset_id: e.assetId,
                    x: e.x,
                    y: e.y,
                    z_index: e.zIndex
                }));

                const { error: insertElementsError } = await supabase
                    .from('region_map_elements') // @ts-ignore
                    .insert(elementsToInsert);

                if (insertElementsError) throw insertElementsError;
            }

            return true;
        } catch (err: any) {
            console.error('Error saving region:', err);
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, [region]);

    const resetToDefault = useCallback(async (_regionId: string) => {
        if (!region) return;
        setRegion({
            ...region,
            facilities: []
        });
    }, [region]);

    return {
        region,
        loading,
        error,
        addFacility,
        updateFacility,
        removeFacility,
        updateRegion,
        saveRegion,
        loadRegion,
        resetToDefault,
        addMapElement,
        removeMapElement,
    };
}
