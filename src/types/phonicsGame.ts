export type GameLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type GameMode = 'sound_match' | 'speed_round' | 'pattern_hunt' | 'sound_sort';

export interface PhonicsGameProgress {
    id: string;
    user_id: string;
    xp_total: number;
    level: GameLevel;
    games_played: number;
    total_correct: number;
    total_attempted: number;
    best_streak: number;
    sounds_mastered: string[];
}

export interface PhonicsGameSession {
    id: string;
    user_id: string;
    game_mode: GameMode;
    score: number;
    xp_earned: number;
    correct_count: number;
    total_questions: number;
    accuracy: number;
    duration_seconds: number;
    best_streak: number;
    played_at: string;
}

export interface PhonicsBadge {
    id: string;
    badge_key: string;
    badge_name: string;
    description: string;
    icon_name: string;
    unlock_condition: Record<string, any>;
    tier: GameLevel;
}

export interface PhonicsUserBadge {
    id: string;
    user_id: string;
    badge_id: string;
    earned_at: string;
    badge?: PhonicsBadge; // Joined data
}

// Level thresholds
export const LEVEL_THRESHOLDS: Record<GameLevel, number> = {
    bronze: 0,
    silver: 100,
    gold: 300,
    platinum: 600,
    diamond: 1000
};

// XP Rewards
export const XP_REWARDS = {
    PER_CORRECT_ANSWER: 10,
    PERFECT_ROUND_BONUS: 50,
    STREAK_BONUS_MULTIPLIER: 0.5, // streak * 0.5 additional XP
    DAILY_FIRST_GAME: 20
};

export const LEVEL_COLORS: Record<GameLevel, string> = {
    bronze: 'bg-amber-600',
    silver: 'bg-slate-400',
    gold: 'bg-yellow-500',
    platinum: 'bg-cyan-400',
    diamond: 'bg-purple-500'
};

export const LEVEL_LABELS: Record<GameLevel, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond'
};
