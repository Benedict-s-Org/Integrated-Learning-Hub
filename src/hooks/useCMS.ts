import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AppContent {
  id: string;
  key: string;
  content: any;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

export function useCMS() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch a single content item by key
   */
  const getContent = useCallback(async (key: string): Promise<AppContent | null> => {
    try {
      setLoading(true);
      setError(null);
      
      // Changed from .single() to .select() + manual pick to avoid 406 (Not Acceptable) errors
      // with missing keys and content negotiation.
      const { data, error: fetchError } = await (supabase
        .from('app_content' as any)
        .select('*')
        .eq('key', key) as any);

      if (fetchError) {
        throw fetchError;
      }

      // Return first item or null if not found
      return (data && data.length > 0) ? (data[0] as AppContent) : null;
    } catch (err: any) {
      console.error(`Error fetching CMS content for key ${key}:`, err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch all content items
   */
  const getAllContent = useCallback(async (): Promise<AppContent[]> => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await (supabase
        .from('app_content' as any)
        .select('*')
        .order('key') as any);

      if (fetchError) throw fetchError;
      return (data || []) as unknown as AppContent[];
    } catch (err: any) {
      console.error('Error fetching all CMS content:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update or create content by key
   */
  const updateContent = useCallback(async (key: string, content: any, description?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: upsertError } = await (supabase
        .from('app_content' as any)
        .upsert({
          key,
          content,
          description,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        }, { onConflict: 'key' }) as any);

      if (upsertError) throw upsertError;
      return { success: true };
    } catch (err: any) {
      const { data: { user } } = await supabase.auth.getUser();
      console.error(`Error updating CMS content for key ${key}:`, err);
      console.error(`Attempted by user: ${user?.email || 'Not logged in'} (ID: ${user?.id || 'None'})`);
      
      const errorMessage = err.message || String(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getContent,
    getAllContent,
    updateContent
  };
}
