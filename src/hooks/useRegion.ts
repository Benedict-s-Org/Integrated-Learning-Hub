import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Region, RegionPlot, PublicFacility, RegionData, PlotType, FacilityType } from '@/types/region';

interface UseRegionReturn {
  region: RegionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  claimPlot: (plotId: string, cityName: string) => Promise<boolean>;
  visitFacility: (facilityId: string) => Promise<{ success: boolean; message: string; rewards?: Record<string, number> }>;
  createPublicFacility: (
    facilityType: FacilityType,
    name: string,
    position: { x: number, y: number },
    config?: Record<string, unknown>
  ) => Promise<boolean>;
}

// Convert database row to RegionPlot
function toRegionPlot(row: Record<string, unknown>): RegionPlot {
  return {
    id: row.id as string,
    regionId: row.region_id as string,
    ownerId: row.owner_id as string | null,
    position: {
      x: row.position_x as number,
      y: row.position_y as number
    },
    size: {
      width: row.size_width as number,
      depth: row.size_depth as number
    },
    plotType: row.plot_type as PlotType,
    cityLevel: row.city_level as number | undefined,
    cityName: row.city_name as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Convert database row to PublicFacility
function toPublicFacility(row: Record<string, unknown>): PublicFacility {
  return {
    id: row.id as string,
    regionId: row.region_id as string,
    plotId: row.plot_id as string | null,
    facilityType: row.facility_type as FacilityType,
    name: row.name as string,
    level: row.level as number,
    position: {
      x: row.position_x as number,
      y: row.position_y as number
    },
    config: row.config as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useRegion(regionId?: string): UseRegionReturn {
  const [region, setRegion] = useState<RegionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If no regionId provided, get the first (default) region
      let targetRegionId = regionId;

      if (!targetRegionId) {
        const { data: regions, error: regionsError } = await supabase
          .from('regions')
          .select('*')
          .limit(1)
          .single();

        if (regionsError) throw regionsError;
        if (!regions) throw new Error('No regions found');

        targetRegionId = regions.id;
      }

      // Fetch region data
      const { data: regionData, error: regionError } = await supabase
        .from('regions')
        .select('*')
        .eq('id', targetRegionId)
        .single();

      if (regionError) throw regionError;

      // Fetch plots
      const { data: plotsData, error: plotsError } = await supabase
        .from('region_plots')
        .select('*')
        .eq('region_id', targetRegionId);

      if (plotsError) throw plotsError;

      // Fetch facilities
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('public_facilities')
        .select('*')
        .eq('region_id', targetRegionId);

      if (facilitiesError) throw facilitiesError;

      const fullRegion: RegionData = {
        id: regionData.id,
        name: regionData.name,
        gridSize: regionData.grid_size,
        theme: regionData.theme,
        createdAt: regionData.created_at,
        updatedAt: regionData.updated_at,
        plots: (plotsData || []).map(toRegionPlot),
        facilities: (facilitiesData || []).map(toPublicFacility),
      };

      setRegion(fullRegion);
    } catch (err) {
      console.error('Error fetching region:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch region');
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  const claimPlot = useCallback(async (plotId: string, cityName: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Must be logged in to claim a plot');
        return false;
      }

      const { error: updateError } = await supabase
        .from('region_plots')
        .update({
          owner_id: user.id,
          plot_type: 'city',
          city_name: cityName,
          city_level: 1,
        })
        .eq('id', plotId)
        .is('owner_id', null);

      if (updateError) throw updateError;

      await fetchRegion();
      return true;
    } catch (err) {
      console.error('Error claiming plot:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim plot');
      return false;
    }
  }, [fetchRegion]);

  useEffect(() => {
    fetchRegion();
  }, [fetchRegion]);

  const visitFacility = useCallback(async (facilityId: string): Promise<{ success: boolean; message: string; rewards?: Record<string, number> }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, message: '請先登入' };

      // In a real app, we would log the visit and transaction in the database
      // For now, we'll just simulate the reward
      // You'd typically want a "facility_visits" table to track cooldowns

      const facility = region?.facilities.find(f => f.id === facilityId);
      if (!facility) return { success: false, message: '找不到設施' };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Return configured rewards or defaults
      const rewards = (facility.config.rewards as Record<string, number>) || { coins: 10 };

      return {
        success: true,
        message: `訪問成功！獲得 ${Object.entries(rewards).map(([k, v]) => `${v} ${k}`).join(', ')}`,
        rewards
      };
    } catch (err) {
      console.error('Error visiting facility:', err);
      return { success: false, message: '訪問失敗' };
    }
  }, [region?.facilities]);

  const createPublicFacility = useCallback(async (
    facilityType: FacilityType,
    name: string,
    position: { x: number, y: number },
    config: Record<string, unknown> = {}
  ): Promise<boolean> => {
    try {
      if (!region) throw new Error('No active region');

      const { error: insertError } = await supabase
        .from('public_facilities')
        .insert({
          region_id: region.id,
          facility_type: facilityType,
          name,
          position_x: position.x,
          position_y: position.y,
          config: config as any
        } as any);

      if (insertError) throw insertError;

      await fetchRegion();
      return true;
    } catch (err) {
      console.error('Error creating facility:', err);
      setError(err instanceof Error ? err.message : 'Failed to create facility');
      return false;
    }
  }, [region, fetchRegion]);

  return {
    region,
    loading,
    error,
    refetch: fetchRegion,
    claimPlot,
    visitFacility,
    createPublicFacility,
  };
}
