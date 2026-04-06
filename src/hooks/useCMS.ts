import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AppContent } from '../types';

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
      const { data, error: fetchError } = await (supabase
        .from('app_content' as any)
        .select('*')
        .eq('key', key) as any)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') return null; // Not found
        throw fetchError;
      }

      return data as AppContent;
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
  const updateContent = useCallback(async (key: string, content: any, description?: string): Promise<boolean> => {
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
      return true;
    } catch (err: any) {
      console.error(`Error updating CMS content for key ${key}:`, err);
      setError(err.message);
      return false;
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
