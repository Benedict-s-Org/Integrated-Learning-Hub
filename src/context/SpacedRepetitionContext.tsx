import React, { createContext, useContext, useState, useEffect } from 'react';
import { SpacedRepetitionSet, SpacedRepetitionQuestion, SpacedRepetitionSchedule, SpacedRepetitionAttempt, UserStreak, UserAchievement } from '../types';
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
  deleteSet: (setId: string) => Promise<void>;
  fetchSet: (setId: string) => Promise<void>;
  fetchCardsDueToday: () => Promise<SpacedRepetitionQuestion[]>;
  recordAttempt: (questionId: string, selectedIndex: number, responseTime: number) => Promise<boolean>;
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
        supabase.from('spaced_repetition_sets').select('*').eq('user_id', userId),
        supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_achievements').select('*').eq('user_id', userId),
      ]);

      setSets(setsRes.data || []);
      setStreak(streakRes.data);
      setAchievements(achievementsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch spaced repetition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSet = async (title: string, description: string, difficulty: string): Promise<string | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('spaced_repetition_sets')
        .insert([{
          user_id: userId,
          title,
          description,
          difficulty,
          total_questions: 0,
          is_published: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setSets([...sets, data]);
      return data.id;
    } catch (error) {
      console.error('Failed to create set:', error);
      return null;
    }
  };

  const addQuestions = async (setId: string, questionsData: any[]): Promise<boolean> => {
    if (!userId) return false;

    try {
      const questionRecords = questionsData.map(q => ({
        set_id: setId,
        question_text: q.question,
        choices: q.choices,
        correct_answer_index: q.correct_answer_index,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
      }));

      const { data: insertedQuestions, error: insertError } = await supabase
        .from('spaced_repetition_questions')
        .insert(questionRecords)
        .select();

      if (insertError) throw insertError;

      const scheduleRecords = insertedQuestions.map(q => ({
        ...initializeSchedule(q.id, userId),
        user_id: userId,
      }));

      const { error: scheduleError } = await supabase
        .from('spaced_repetition_schedules')
        .insert(scheduleRecords);

      if (scheduleError) throw scheduleError;

      const { error: updateError } = await supabase
        .from('spaced_repetition_sets')
        .update({ total_questions: questionsData.length })
        .eq('id', setId);

      if (updateError) throw updateError;

      setQuestions(insertedQuestions);
      setSchedules(scheduleRecords);
      return true;
    } catch (error) {
      console.error('Failed to add questions:', error);
      return false;
    }
  };

  const deleteSet = async (setId: string) => {
    try {
      await supabase.from('spaced_repetition_sets').delete().eq('id', setId);
      setSets(sets.filter(s => s.id !== setId));
    } catch (error) {
      console.error('Failed to delete set:', error);
    }
  };

  const fetchSet = async (setId: string) => {
    try {
      const [setRes, questionsRes, schedulesRes] = await Promise.all([
        supabase.from('spaced_repetition_sets').select('*').eq('id', setId).single(),
        supabase.from('spaced_repetition_questions').select('*').eq('set_id', setId),
        supabase.from('spaced_repetition_schedules').select('*').eq('user_id', userId || '').eq('question_id', setId),
      ]);

      setCurrentSet(setRes.data);
      setQuestions(questionsRes.data || []);
      setSchedules(schedulesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch set:', error);
    }
  };

  const fetchCardsDueToday = async (): Promise<SpacedRepetitionQuestion[]> => {
    if (!userId) return [];

    try {
      const { data: schedulesData, error } = await supabase
        .from('spaced_repetition_schedules')
        .select('*, spaced_repetition_questions(*)')
        .eq('user_id', userId)
        .lte('next_review_date', new Date().toISOString());

      if (error) throw error;

      return schedulesData?.map(s => s.spaced_repetition_questions).flat().filter(Boolean) || [];
    } catch (error) {
      console.error('Failed to fetch cards due today:', error);
      return [];
    }
  };

  const recordAttempt = async (questionId: string, selectedIndex: number, responseTime: number): Promise<boolean> => {
    if (!userId) return false;

    try {
      const schedule = schedules.find(s => s.question_id === questionId);
      if (!schedule) return false;

      const question = questions.find(q => q.id === questionId);
      if (!question) return false;

      const isCorrect = selectedIndex === question.correct_answer_index;
      const qualityRating = getQualityRatingFromCorrectness(isCorrect, responseTime);

      const { data: attemptData, error: attemptError } = await supabase
        .from('spaced_repetition_attempts')
        .insert([{
          user_id: userId,
          question_id: questionId,
          selected_answer_index: selectedIndex,
          is_correct: isCorrect,
          response_time_ms: responseTime,
          quality_rating: qualityRating,
        }])
        .select()
        .single();

      if (attemptError) throw attemptError;

      const nextReview = calculateNextReview(schedule, qualityRating);

      const { error: updateError } = await supabase
        .from('spaced_repetition_schedules')
        .update({
          ease_factor: nextReview.easeFactor,
          interval_days: nextReview.interval,
          repetitions: nextReview.repetitions,
          next_review_date: nextReview.nextReviewDate.toISOString(),
          last_reviewed_at: new Date().toISOString(),
          last_quality_rating: qualityRating,
        })
        .eq('id', schedule.id);

      if (updateError) throw updateError;

      updateStreakData(isCorrect);
      checkForAchievements();

      return true;
    } catch (error) {
      console.error('Failed to record attempt:', error);
      return false;
    }
  };

  const updateStreakData = async (isCorrect: boolean) => {
    if (!userId || !isCorrect) return;

    try {
      let currentStreak = streak?.current_streak_days || 0;
      const today = new Date().toDateString();
      const lastPractice = streak?.last_practice_date ? new Date(streak.last_practice_date).toDateString() : null;

      if (lastPractice !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastPractice === yesterday.toDateString()) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }

      const longest = Math.max(currentStreak, streak?.longest_streak_days || 0);

      const { data, error } = await supabase
        .from('user_streaks')
        .upsert([{
          user_id: userId,
          current_streak_days: currentStreak,
          longest_streak_days: longest,
          last_practice_date: today,
          total_cards_learned: (streak?.total_cards_learned || 0),
          total_cards_mastered: (streak?.total_cards_mastered || 0),
        }], { onConflict: 'user_id' })
        .select()
        .single();

      if (!error && data) {
        setStreak(data);
      }
    } catch (error) {
      console.error('Failed to update streak:', error);
    }
  };

  const checkForAchievements = async () => {
    if (!userId || !streak) return;

    const totalAttempts = await supabase
      .from('spaced_repetition_attempts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .then(res => res.count || 0);

    const achievementType = getAchievementUnlocked(
      streak.total_cards_mastered,
      streak.current_streak_days,
      totalAttempts
    );

    if (achievementType && !achievements.find(a => a.achievement_type === achievementType)) {
      try {
        const { data, error } = await supabase
          .from('user_achievements')
          .insert([{
            user_id: userId,
            achievement_type: achievementType,
            achievement_name: achievementType,
            earned_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (!error) {
          setAchievements([...achievements, data]);
        }
      } catch (error) {
        console.error('Failed to create achievement:', error);
      }
    }
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
        deleteSet,
        fetchSet,
        fetchCardsDueToday,
        recordAttempt,
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