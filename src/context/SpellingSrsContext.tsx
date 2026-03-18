import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { 
  calculateStandardNextReview, 
  initializeSpellingSchedule, 
  getStandardQualityRating 
} from '../utils/standardSm2Algorithm';

interface SpellingSrsContextType {
  getWordsDueForReview: () => Promise<string[]>;
  recordWordAttempt: (word: string, isCorrect: boolean, responseTimeMs: number) => Promise<void>;
  loading: boolean;
}

const SpellingSrsContext = createContext<SpellingSrsContextType | undefined>(undefined);

export const SpellingSrsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [loading] = useState(false);

  const getWordsDueForReview = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await (supabase as any)
        .from('spelling_word_schedules')
        .select('word')
        .eq('user_id', user.id)
        .lte('next_review_date', new Date().toISOString());
        
      if (error) throw error;
      return (data || []).map((r: any) => r.word);
    } catch (err) {
      console.error('Failed to fetch words due for review:', err);
      return [];
    }
  }, [user]);

  const recordWordAttempt = useCallback(async (word: string, isCorrect: boolean, responseTimeMs: number) => {
    if (!user) return;

    try {
      // 1. Get or initialize schedule
      const { data: existing, error: fetchError } = await (supabase as any)
        .from('spelling_word_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('word', word.trim())
        .maybeSingle();

      if (fetchError) throw fetchError;

      const schedule = existing || initializeSpellingSchedule(word, user.id);
      const qualityRating = getStandardQualityRating(isCorrect, responseTimeMs);
      
      // Calculate next review using standard SM-2
      const nextReview = calculateStandardNextReview(
        {
          ease_factor: Number(schedule.ease_factor),
          interval_days: schedule.interval_days,
          repetitions: schedule.repetitions
        },
        qualityRating
      );

      // Upsert into database
      const payload: any = {
        user_id: user.id,
        word: word.trim(),
        ease_factor: nextReview.easeFactor,
        interval_days: nextReview.interval,
        repetitions: nextReview.repetitions,
        next_review_date: nextReview.nextReviewDate.toISOString(),
        last_reviewed_at: new Date().toISOString(),
        last_quality_rating: qualityRating,
        updated_at: new Date().toISOString()
      };

      if (schedule.id) payload.id = schedule.id;

      const { error: upsertError } = await (supabase as any)
        .from('spelling_word_schedules')
        .upsert(payload);

      if (upsertError) throw upsertError;
    } catch (err) {
      console.error(`Failed to record attempt for word "${word}":`, err);
    }
  }, [user]);

  return (
    <SpellingSrsContext.Provider value={{ getWordsDueForReview, recordWordAttempt, loading }}>
        {children}
    </SpellingSrsContext.Provider>
  );
};

export const useSpellingSrs = () => {
  const context = useContext(SpellingSrsContext);
  if (context === undefined) {
    throw new Error('useSpellingSrs must be used within a SpellingSrsProvider');
  }
  return context;
};
