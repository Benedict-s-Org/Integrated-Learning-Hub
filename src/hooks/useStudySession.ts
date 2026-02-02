import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DueCard {
  id: string;
  front: string;
  back: string;
  furniture_id: string | null;
  palace_id: string | null;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  state: number;
}

export function useStudySession() {
  const [dueQueue, setDueQueue] = useState<DueCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStudyMode, setIsStudyMode] = useState(false);

  // Fetch due cards from Supabase
  const fetchDueCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('請先登入以使用學習功能');
        setIsLoading(false);
        return;
      }

      const now = new Date().toISOString();
      
      const { data, error: fetchError } = await supabase
        .from('cards')
        .select('*')
        .lte('due', now)
        .order('due', { ascending: true });
      
      if (fetchError) {
        console.error('Error fetching due cards:', fetchError);
        setError('無法載入學習卡片');
        return;
      }
      
      setDueQueue(data || []);
    } catch (err) {
      console.error('Error in fetchDueCards:', err);
      setError('發生錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh due cards when study mode is enabled
  useEffect(() => {
    if (isStudyMode) {
      fetchDueCards();
    }
  }, [isStudyMode, fetchDueCards]);

  // Check if a furniture has a due card
  const hasDueCard = useCallback((furnitureId: string) => {
    return dueQueue.some(card => card.furniture_id === furnitureId);
  }, [dueQueue]);

  // Get due card for a specific furniture placement
  const getDueCardForFurniture = useCallback((placementId: string) => {
    return dueQueue.find(card => card.furniture_id === placementId);
  }, [dueQueue]);

  // Review a card with FSRS rating
  const reviewCard = useCallback(async (cardId: string, rating: 1 | 2 | 3 | 4) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('review-card', {
        body: { cardId, rating }
      });

      if (invokeError) {
        console.error('Error reviewing card:', invokeError);
        throw new Error('無法提交複習結果');
      }

      // Remove the reviewed card from the queue
      setDueQueue(prev => prev.filter(card => card.id !== cardId));
      
      return { success: true, data };
    } catch (err) {
      console.error('Error in reviewCard:', err);
      throw err;
    }
  }, []);

  // Toggle study mode
  const toggleStudyMode = useCallback(() => {
    setIsStudyMode(prev => !prev);
  }, []);

  // Get count of due cards
  const dueCount = dueQueue.length;

  return {
    dueQueue,
    dueCount,
    isLoading,
    error,
    isStudyMode,
    toggleStudyMode,
    fetchDueCards,
    hasDueCard,
    getDueCardForFurniture,
    reviewCard,
  };
}
