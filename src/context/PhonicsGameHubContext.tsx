import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
    PhonicsGameProgress,
    PhonicsGameSession,
    PhonicsUserBadge,
    PhonicsBadge,
    GameLevel,
    GameMode,
    LEVEL_THRESHOLDS,
    XP_REWARDS
} from '../types/phonicsGame';

interface PhonicsGameHubContextType {
    progress: PhonicsGameProgress | null;
    badges: PhonicsUserBadge[];
    allBadges: PhonicsBadge[];
    loading: boolean;

    fetchProgress: () => Promise<void>;
    recordSession: (sessionData: Omit<PhonicsGameSession, 'id' | 'user_id' | 'played_at' | 'xp_earned'>) => Promise<{ xpEarned: number; leveledUp: boolean; newBadges: PhonicsBadge[] }>;
    getLeaderboard: () => Promise<any[]>;
}

const PhonicsGameHubContext = createContext<PhonicsGameHubContextType | undefined>(undefined);

export const PhonicsGameHubProvider = ({ children, userId }: { children: React.ReactNode; userId?: string }) => {
    const [progress, setProgress] = useState<PhonicsGameProgress | null>(null);
    const [badges, setBadges] = useState<PhonicsUserBadge[]>([]);
    const [allBadges, setAllBadges] = useState<PhonicsBadge[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProgress = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch User Progress
            const { data: progressData, error: progressError } = await (supabase as any)
                .from('phonics_game_progress')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle(); // Use maybeSingle to handle no rows gracefully

            if (progressError) throw progressError;

            // Initialize if new user
            if (!progressData) {
                const { data: newProgress, error: initError } = await (supabase as any)
                    .from('phonics_game_progress')
                    .insert({ user_id: userId })
                    .select()
                    .single();

                if (initError) throw initError;
                setProgress(newProgress as PhonicsGameProgress);
            } else {
                setProgress(progressData as PhonicsGameProgress);
            }

            // 2. Fetch User Badges
            const { data: userBadgesData, error: userBadgesError } = await (supabase as any)
                .from('phonics_user_badges')
                .select('*, badge:phonics_badges(*)')
                .eq('user_id', userId);

            if (userBadgesError) throw userBadgesError;
            setBadges(userBadgesData as unknown as PhonicsUserBadge[]);

            // 3. Fetch All Badges Definitions
            const { data: allBadgesData, error: allBadgesError } = await (supabase as any)
                .from('phonics_badges')
                .select('*');

            if (allBadgesError) throw allBadgesError;
            setAllBadges(allBadgesData as PhonicsBadge[]);

        } catch (error) {
            console.error('Error fetching game hub data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) fetchProgress();
    }, [userId, fetchProgress]);


    const calculateLevel = (xp: number): GameLevel => {
        if (xp >= LEVEL_THRESHOLDS.diamond) return 'diamond';
        if (xp >= LEVEL_THRESHOLDS.platinum) return 'platinum';
        if (xp >= LEVEL_THRESHOLDS.gold) return 'gold';
        if (xp >= LEVEL_THRESHOLDS.silver) return 'silver';
        return 'bronze';
    };

    const recordSession = async (sessionData: Omit<PhonicsGameSession, 'id' | 'user_id' | 'played_at' | 'xp_earned'>) => {
        if (!userId || !progress) return { xpEarned: 0, leveledUp: false, newBadges: [] };

        // 1. Calculate XP Earned
        let xpEarned = sessionData.correct_count * XP_REWARDS.PER_CORRECT_ANSWER;
        if (sessionData.accuracy === 100) xpEarned += XP_REWARDS.PERFECT_ROUND_BONUS;
        if (sessionData.best_streak >= 5) xpEarned += Math.floor(sessionData.best_streak * XP_REWARDS.STREAK_BONUS_MULTIPLIER);

        // 2. Update Progress (XP, Level, Stats)
        const newTotalXp = (progress.xp_total || 0) + xpEarned;
        const newLevel = calculateLevel(newTotalXp);
        const leveledUp = newLevel !== progress.level;

        const { data: updatedProgress, error: updateError } = await (supabase as any)
            .from('phonics_game_progress')
            .update({
                xp_total: newTotalXp,
                level: newLevel,
                games_played: (progress.games_played || 0) + 1,
                total_correct: (progress.total_correct || 0) + sessionData.correct_count,
                total_attempted: (progress.total_attempted || 0) + sessionData.total_questions,
                best_streak: Math.max(progress.best_streak || 0, sessionData.best_streak),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (updateError) throw updateError;
        setProgress(updatedProgress as PhonicsGameProgress);

        // 3. Log Session
        const { error: sessionError } = await (supabase as any)
            .from('phonics_game_sessions')
            .insert({
                user_id: userId,
                ...sessionData,
                xp_earned: xpEarned
            });

        if (sessionError) throw sessionError;

        // 4. Check for New Badges
        const newBadges: PhonicsBadge[] = [];
        const earnedBadgeIds = new Set(badges.map(b => b.badge_id));

        for (const badge of allBadges) {
            if (earnedBadgeIds.has(badge.id)) continue;

            let unlocked = false;
            const condition = badge.unlock_condition;

            // Simple condition checks (expand as needed)
            if (condition.type === 'games_played' && (updatedProgress.games_played >= condition.threshold)) unlocked = true;
            if (condition.type === 'xp' && (updatedProgress.xp_total >= condition.threshold)) unlocked = true;
            if (condition.type === 'streak' && (sessionData.best_streak >= condition.threshold)) unlocked = true;
            if (condition.type === 'accuracy' && (sessionData.accuracy >= condition.threshold)) unlocked = true;

            if (unlocked) {
                const { error: badgeError } = await (supabase as any)
                    .from('phonics_user_badges')
                    .insert({ user_id: userId, badge_id: badge.id });

                if (!badgeError) {
                    newBadges.push(badge);
                }
            }
        }

        // Refresh local badges if any earned
        if (newBadges.length > 0) {
            const { data: userBadgesData } = await (supabase as any)
                .from('phonics_user_badges')
                .select('*, badge:phonics_badges(*)')
                .eq('user_id', userId);
            setBadges(userBadgesData as unknown as PhonicsUserBadge[]);
        }

        return { xpEarned, leveledUp, newBadges };
    };

    const getLeaderboard = async () => {
        // Basic leaderboard implementation - can be refined to be weekly or improved logic
        const { data, error } = await (supabase as any)
            .from('phonics_game_progress')
            .select('username:users(username), xp_total, level')
            .order('xp_total', { ascending: false })
            .limit(10);

        if (error) {
            console.error("Leaderboard fetch error:", error);
            return [];
        }
        return data;
    }

    return (
        <PhonicsGameHubContext.Provider value={{
            progress,
            badges,
            allBadges,
            loading,
            fetchProgress,
            recordSession,
            getLeaderboard
        }}>
            {children}
        </PhonicsGameHubContext.Provider>
    );
};

export const usePhonicsGameHub = () => {
    const context = useContext(PhonicsGameHubContext);
    if (context === undefined) {
        throw new Error('usePhonicsGameHub must be used within a PhonicsGameHubProvider');
    }
    return context;
};
