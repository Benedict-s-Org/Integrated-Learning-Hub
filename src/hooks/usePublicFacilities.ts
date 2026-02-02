import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PublicFacility, FacilityType, CityVisit } from '@/types/region';

interface UseFacilityReturn {
  visitFacility: (facilityId: string) => Promise<void>;
  getVisitorCount: (facilityId: string) => Promise<number>;
  loading: boolean;
  error: string | null;
}

interface UseCityVisitsReturn {
  visits: CityVisit[];
  loading: boolean;
  error: string | null;
  recordVisit: (cityOwnerId: string) => Promise<boolean>;
  fetchMyVisits: () => Promise<void>;
  fetchVisitsToMyCity: () => Promise<void>;
}

export function usePublicFacilities(): UseFacilityReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visitFacility = useCallback(async (facilityId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, just log the visit
      // Future: implement facility-specific interactions
      console.log('Visiting facility:', facilityId);
      
    } catch (err) {
      console.error('Error visiting facility:', err);
      setError(err instanceof Error ? err.message : 'Failed to visit facility');
    } finally {
      setLoading(false);
    }
  }, []);

  const getVisitorCount = useCallback(async (facilityId: string): Promise<number> => {
    // Placeholder - would need a separate table to track facility visits
    return 0;
  }, []);

  return {
    visitFacility,
    getVisitorCount,
    loading,
    error,
  };
}

export function useCityVisits(): UseCityVisitsReturn {
  const [visits, setVisits] = useState<CityVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordVisit = useCallback(async (cityOwnerId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Must be logged in to record visit');
        return false;
      }

      // Don't record self-visits
      if (user.id === cityOwnerId) {
        return true;
      }

      const { error: insertError } = await supabase
        .from('city_visits')
        .insert({
          visitor_id: user.id,
          city_owner_id: cityOwnerId,
        });

      if (insertError) throw insertError;
      return true;
    } catch (err) {
      console.error('Error recording visit:', err);
      setError(err instanceof Error ? err.message : 'Failed to record visit');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyVisits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('city_visits')
        .select('*')
        .eq('visitor_id', user.id)
        .order('visited_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setVisits((data || []).map(row => ({
        id: row.id,
        visitorId: row.visitor_id,
        cityOwnerId: row.city_owner_id,
        visitedAt: row.visited_at,
      })));
    } catch (err) {
      console.error('Error fetching visits:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch visits');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVisitsToMyCity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('city_visits')
        .select('*')
        .eq('city_owner_id', user.id)
        .order('visited_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setVisits((data || []).map(row => ({
        id: row.id,
        visitorId: row.visitor_id,
        cityOwnerId: row.city_owner_id,
        visitedAt: row.visited_at,
      })));
    } catch (err) {
      console.error('Error fetching visits to my city:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch visits');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    visits,
    loading,
    error,
    recordVisit,
    fetchMyVisits,
    fetchVisitsToMyCity,
  };
}
