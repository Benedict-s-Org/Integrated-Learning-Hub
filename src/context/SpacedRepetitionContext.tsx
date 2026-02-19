import React, { createContext, useContext, useState, useEffect } from 'react';
import { SpacedRepetitionSet, SpacedRepetitionQuestion, SpacedRepetitionSchedule, UserStreak, UserAchievement } from '../types';
import { supabase } from '../lib/supabase';
import { calculateNextReview, getQualityRatingFromCorrectness, initializeSchedule, getAchievementUnlocked } from '../utils/spacedRepetitionAlgorithm';

interface SpacedRepetitionContextType {
  sets: SpacedRepetitionSet[];
  currentSet: SpacedRepetitionSet | null;
  questions: SpacedRepetitionQuestion[];
  schedules: SpacedRepetitionSchedule[];
  streak: UserStreak | null;
  achievements: UserAchievement[];
  loading: boolean;

  createSet: (title: string, description: string, difficulty: string) => Promise<string | null>;
  addQuestions: (setId: string, questions: any[]) => Promise<boolean>;
  updateSet: (setId: string, updates: Partial<SpacedRepetitionSet>) => Promise<boolean>;
  updateQuestion: (questionId: string, updates: Partial<SpacedRepetitionQuestion>) => Promise<boolean>;
  deleteQuestion: (questionId: string) => Promise<boolean>;
  deleteSet: (setId: string) => Promise<void>;
  restoreSet: (setId: string) => Promise<boolean>;
  permanentlyDeleteSet: (setId: string) => Promise<boolean>;
  fetchSet: (setId: string) => Promise<void>;
  fetchRecycleBin: () => Promise<SpacedRepetitionSet[]>;
  fetchCardsDueToday: () => Promise<SpacedRepetitionQuestion[]>;
  recordAttempt: (questionId: string, selectedIndex: number, responseTime: number) => Promise<boolean>;
  getQuestionsForSet: (setId: string) => Promise<SpacedRepetitionQuestion[]>;
  getStreakData: () => UserStreak | null;
  getAchievements: () => UserAchievement[];
}

const SpacedRepetitionContextInstance = createContext<SpacedRepetitionContextType | undefined>(undefined);

interface SpacedRepetitionProviderProps {
  children: React.ReactNode;
  userId?: string;
}

export const SpacedRepetitionProvider: React.FC<SpacedRepetitionProviderProps> = ({ children, userId }) => {
  const [sets, setSets] = useState<SpacedRepetitionSet[]>([]);
  const [currentSet, setCurrentSet] = useState<SpacedRepetitionSet | null>(null);
  const [questions, setQuestions] = useState<SpacedRepetitionQuestion[]>([]);
  const [schedules, setSchedules] = useState<SpacedRepetitionSchedule[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchAllData();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchAllData = async () => {
    if (!userId) return;

    try {
      const [setsRes, streakRes, achievementsRes] = await Promise.all([
        ((supabase as any).from('spaced_repetition_sets').select('*') as any).eq('user_id', userId),
        ((supabase as any).from('user_streaks').select('*') as any).eq('user_id', userId).maybeSingle(),
        ((supabase as any).from('user_achievements').select('*') as any).eq('user_id', userId),
      ]);

      setSets((setsRes.data || []) as unknown as SpacedRepetitionSet[]);
      setStreak(streakRes.data as unknown as UserStreak | null);
      setAchievements((achievementsRes.data || []) as unknown as UserAchievement[]);
    } catch (error) {
      console.error('Failed to fetch spaced repetition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSet = async (title: string, description: string, difficulty: string): Promise<string | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await ((supabase as any)
        .from('spaced_repetition_sets')
        .insert({
          user_id: userId,
          title,
          description,
          difficulty,
          total_questions: 0,
          is_published: false,
        } as any) as any)
        .select()
        .single();

      if (error) throw error;

      const newSet = data as unknown as SpacedRepetitionSet;
      setSets([...sets, newSet]);
      return newSet.id;
    } catch (error) {
      console.error('Failed to create set:', error);
      return null;
    }
  };

  const addQuestions = async (setId: string, questionsData: any[]): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get current max order index to prevent collisions if appending
      const { data: maxOrderData } = await (supabase as any)
        .from('spaced_repetition_questions')
        .select('order_index')
        .eq('set_id', setId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startOrderIndex = (maxOrderData?.order_index ?? -1) + 1;

      const questionRecords = questionsData.map((q, idx) => ({
        set_id: setId,
        question_text: q.question_text || q.question,
        choices: q.choices,
        correct_answer_index: q.correct_answer_index,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
        order_index: typeof q.order_index === 'number' ? q.order_index : (startOrderIndex + idx),
      })) as any[];

      const { data: insertedQuestions, error: insertError } = await ((supabase as any)
        .from('spaced_repetition_questions')
        .insert(questionRecords) as any)
        .select();

      if (insertError) throw insertError;

      const typedQuestions = (insertedQuestions || []) as unknown as SpacedRepetitionQuestion[];

      const scheduleRecords = typedQuestions.map(q => ({
        ...initializeSchedule(q.id, userId),
        user_id: userId,
      })) as any[];

      const { error: scheduleError } = await ((supabase as any)
        .from('spaced_repetition_schedules')
        .insert(scheduleRecords) as any);

      if (scheduleError) throw scheduleError;

      setQuestions(typedQuestions);
      setSchedules(scheduleRecords as unknown as SpacedRepetitionSchedule[]);
      return true;
    } catch (error) {
      console.error('Failed to add questions:', error);
      return false;
    }
  };

  const updateSet = async (setId: string, updates: Partial<SpacedRepetitionSet>): Promise<boolean> => {
    try {
      const { error } = await ((supabase as any)
        .from('spaced_repetition_sets')
        .update(updates as any) as any)
        .eq('id', setId);

      if (error) throw error;

      setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));
      if (currentSet?.id === setId) {
        setCurrentSet(prev => prev ? { ...prev, ...updates } : null);
      }
      return true;
    } catch (error) {
      console.error('Failed to update set:', error);
      return false;
    }
  };

  const updateQuestion = async (questionId: string, updates: Partial<SpacedRepetitionQuestion>): Promise<boolean> => {
    try {
      const { error } = await ((supabase as any)
        .from('spaced_repetition_questions')
        .update(updates as any) as any)
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, ...updates } : q));
      return true;
    } catch (error) {
      console.error('Failed to update question:', error);
      return false;
    }
  };

  const deleteQuestion = async (questionId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('spaced_repetition_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== questionId));
      return true;
    } catch (error) {
      console.error('Failed to delete question:', error);
      return false;
    }
  };

  const deleteSet = async (setId: string) => {
    try {
      // Soft-delete
      await ((supabase as any)
        .from('spaced_repetition_sets')
        .update({ deleted_at: new Date().toISOString() } as any) as any)
        .eq('id', setId);

      setSets(sets.filter(s => s.id !== setId));
    } catch (error) {
      console.error('Failed to soft-delete set:', error);
    }
  };

  const restoreSet = async (setId: string): Promise<boolean> => {
    try {
      const { error } = await ((supabase as any)
        .from('spaced_repetition_sets')
        .update({ deleted_at: null } as any) as any)
        .eq('id', setId);

      if (error) throw error;

      // We don't necessarily re-add to 'sets' here immediately, 
      // usually the caller will re-fetch or the Hub will refresh.
      return true;
    } catch (error) {
      console.error('Failed to restore set:', error);
      return false;
    }
  };

  const permanentlyDeleteSet = async (setId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('spaced_repetition_sets')
        .delete()
        .eq('id', setId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to permanently delete set:', error);
      return false;
    }
  };

  const fetchRecycleBin = async (): Promise<SpacedRepetitionSet[]> => {
    try {
      const { data, error } = await ((supabase as any)
        .from('spaced_repetition_sets')
        .select('*') as any)
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SpacedRepetitionSet[];
    } catch (error) {
      console.error('Failed to fetch recycle bin:', error);
      return [];
    }
  };

  const fetchSet = async (setId: string) => {
    try {
      const [setRes, questionsRes, schedulesRes] = await Promise.all([
        ((supabase as any).from('spaced_repetition_sets').select('*') as any).eq('id', setId).single(),
        ((supabase as any).from('spaced_repetition_questions').select('*') as any).eq('set_id', setId),
        ((supabase as any).from('spaced_repetition_schedules').select('*') as any).eq('user_id', userId || '').eq('question_id', setId),
      ]);

      setCurrentSet(setRes.data as unknown as SpacedRepetitionSet | null);
      setQuestions((questionsRes.data || []) as unknown as SpacedRepetitionQuestion[]);
      setSchedules((schedulesRes.data || []) as unknown as SpacedRepetitionSchedule[]);
    } catch (error) {
      console.error('Failed to fetch set:', error);
    }
  };

  const fetchCardsDueToday = async (): Promise<SpacedRepetitionQuestion[]> => {
    if (!userId) return [];

    try {
      const { data: schedulesData, error } = await ((supabase as any)
        .from('spaced_repetition_schedules')
        .select('*, spaced_repetition_questions(*)') as any)
        .eq('user_id', userId)
        .lte('next_review_date', new Date().toISOString());

      if (error) throw error;

      const rawSchedules = (schedulesData || []) as any[];
      return rawSchedules.map(s => s.spaced_repetition_questions).filter(Boolean) as unknown as SpacedRepetitionQuestion[];
    } catch (error) {
      console.error('Failed to fetch cards due today:', error);
      return [];
    }
  };

  const recordAttempt = async (questionId: string, selectedIndex: number, responseTime: number): Promise<boolean> => {
    if (!userId) return false;

    try {
      const schedule = schedules.find(s => s.question_id === questionId);
      let activeSchedule: SpacedRepetitionSchedule | null | undefined = schedule;
      if (!activeSchedule) {
        const { data } = await ((supabase as any)
          .from('spaced_repetition_schedules')
          .select('*') as any)
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .maybeSingle();
        activeSchedule = data as unknown as SpacedRepetitionSchedule | null;
      }

      const question = questions.find(q => q.id === questionId || (q as any).question_id === questionId);
      if (!question) {
        // Fetch question if not in state
        const { data: qData } = await (supabase as any)
          .from('spaced_repetition_questions')
          .select('*')
          .eq('id', questionId)
          .single();
        if (!qData) return false;
        // Temporary fix for property naming inconsistency
        (qData as any).correct_answer_index = qData.correct_answer_index;
      }

      const isCorrect = selectedIndex === (question?.correct_answer_index ?? (question as any)?.correct_answer_index);
      const qualityRating = getQualityRatingFromCorrectness(isCorrect, responseTime);

      const { error: attemptError } = await ((supabase as any)
        .from('spaced_repetition_attempts')
        .insert({
          user_id: userId,
          question_id: questionId,
          selected_answer_index: selectedIndex,
          is_correct: isCorrect,
          response_time_ms: responseTime,
          quality_rating: qualityRating,
        } as any) as any);

      if (attemptError) throw attemptError;

      if (activeSchedule) {
        const nextReview = calculateNextReview(activeSchedule, qualityRating);
        const { error: updateError } = await ((supabase as any)
          .from('spaced_repetition_schedules')
          .update({
            ease_factor: nextReview.easeFactor,
            interval_days: nextReview.interval,
            repetitions: nextReview.repetitions,
            next_review_date: nextReview.nextReviewDate.toISOString(),
            last_reviewed_at: new Date().toISOString(),
            last_quality_rating: qualityRating,
            updated_at: new Date().toISOString()
          } as any) as any)
          .eq('id', activeSchedule.id);

        if (updateError) throw updateError;
      }

      // Update streak and master stats
      await updateStreakData(isCorrect);
      checkForAchievements();

      return true;
    } catch (error) {
      console.error('Failed to record attempt:', error);
      return false;
    }
  };

  const getQuestionsForSet = async (setId: string): Promise<SpacedRepetitionQuestion[]> => {
    try {
      const { data, error } = await ((supabase as any)
        .from('spaced_repetition_questions')
        .select('*') as any)
        .eq('set_id', setId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SpacedRepetitionQuestion[];
    } catch (error) {
      console.error('Failed to get questions for set:', error);
      return [];
    }
  };

  const updateStreakData = async (isCorrect: boolean) => {
    if (!userId) return;

    try {
      // 1. Get current card stats from RPC
      const { data: statsData, error: statsError } = await (supabase as any)
        .rpc('get_user_card_stats', { p_user_id: userId });

      if (statsError) throw statsError;

      let currentStreak = streak?.current_streak_days || 0;
      const today = new Date().toDateString();
      const lastPractice = streak?.last_practice_date ? new Date(streak.last_practice_date).toDateString() : null;

      // Only increment streak if this is the first practice of the day
      if (isCorrect && lastPractice !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastPractice === yesterday.toDateString()) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }

      const longest = Math.max(currentStreak, streak?.longest_streak_days || 0);

      const { data, error } = await ((supabase as any)
        .from('user_streaks')
        .upsert({
          user_id: userId,
          current_streak_days: currentStreak,
          longest_streak_days: longest,
          last_practice_date: lastPractice === today ? streak?.last_practice_date : today,
          total_cards_learned: statsData.total_learned,
          total_cards_mastered: statsData.total_mastered,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }) as any)
        .select()
        .single();

      if (!error && data) {
        setStreak(data as unknown as UserStreak);
      }
    } catch (error) {
      console.error('Failed to update streak:', error);
    }
  };

  const checkForAchievements = async () => {
    if (!userId || !streak) return;

    try {
      const { count: totalAttempts, error: countError } = await ((supabase as any)
        .from('spaced_repetition_attempts')
        .select('id', { count: 'exact' }) as any)
        .eq('user_id', userId);

      if (countError) {
        console.error('Failed to count attempts:', countError);
        return;
      }

      const attemptsCount = totalAttempts || 0;

      const achievementType = get_achievement_unlocked(attemptsCount);

      if (achievementType && !achievements.find(a => a.achievement_type === achievementType)) {
        const { data, error } = await ((supabase as any)
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_type: achievementType,
            achievement_name: achievementType,
            earned_at: new Date().toISOString(),
          } as any) as any)
          .select()
          .single();

        if (!error && data) {
          setAchievements([...achievements, data as unknown as UserAchievement]);
        }
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  };

  const get_achievement_unlocked = (attempts: number) => {
    if (!streak) return null;
    return getAchievementUnlocked(
      streak.total_cards_mastered,
      streak.current_streak_days,
      attempts
    );
  };

  const getStreakData = () => streak;
  const getAchievements = () => achievements;

  return (
    <SpacedRepetitionContextInstance.Provider
      value={{
        sets,
        currentSet,
        questions,
        schedules,
        streak,
        achievements,
        loading,
        createSet,
        addQuestions,
        updateSet,
        updateQuestion,
        deleteQuestion,
        deleteSet,
        restoreSet,
        permanentlyDeleteSet,
        fetchSet,
        fetchRecycleBin,
        fetchCardsDueToday,
        recordAttempt,
        getQuestionsForSet,
        getStreakData,
        getAchievements,
      }}
    >
      {children}
    </SpacedRepetitionContextInstance.Provider>
  );
};

export const useSpacedRepetition = () => {
  const context = useContext(SpacedRepetitionContextInstance);
  if (context === undefined) {
    throw new Error('useSpacedRepetition must be used within SpacedRepetitionProvider');
  }
  return context;
};