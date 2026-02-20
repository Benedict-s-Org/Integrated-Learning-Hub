import { SpacedRepetitionSchedule } from '../types';

const SM2_CONSTANTS = {
  MIN_EASE: 1.3,
  STARTING_EASE: 2.5,
  EASY_BONUS: 0.15,
  GOOD_BONUS: 0,
  HARD_PENALTY: -0.2,
};

export interface SM2Response {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

export function calculateNextReview(
  schedule: SpacedRepetitionSchedule,
  qualityRating: number
): SM2Response {
  let { ease_factor: easeFactor, interval_days: interval, repetitions } = schedule;

  const qualityAdjustment = getQualityAdjustment(qualityRating);
  easeFactor = Math.max(
    SM2_CONSTANTS.MIN_EASE,
    easeFactor + qualityAdjustment
  );

  if (qualityRating < 3) {
    interval = 0;
    repetitions = 0;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  const nextReviewDate = new Date();

  // If the interval is 1, we want to ensure it's actually due *tomorrow*, not just exactly 24 hours from now which could still count as "today" depending on timezones and rounding.
  if (interval === 1) {
    nextReviewDate.setDate(nextReviewDate.getDate() + 1);
    nextReviewDate.setHours(0, 0, 0, 0); // Start of tomorrow
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  }

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate,
  };
}

function getQualityAdjustment(qualityRating: number): number {
  if (qualityRating === 5) return SM2_CONSTANTS.EASY_BONUS;
  if (qualityRating === 4) return SM2_CONSTANTS.GOOD_BONUS;
  if (qualityRating === 3) return SM2_CONSTANTS.GOOD_BONUS;
  if (qualityRating === 2) return SM2_CONSTANTS.HARD_PENALTY;
  return SM2_CONSTANTS.HARD_PENALTY - 0.1;
}

export function getQualityRatingFromCorrectness(
  isCorrect: boolean,
  responseTimeMs?: number
): number {
  if (!isCorrect) return 1;

  if (!responseTimeMs) return 4;

  if (responseTimeMs < 5000) return 5;
  if (responseTimeMs < 10000) return 4;
  return 3;
}

export function initializeSchedule(questionId: string, userId: string): Partial<SpacedRepetitionSchedule> {
  const now = new Date();
  return {
    question_id: questionId,
    user_id: userId,
    ease_factor: SM2_CONSTANTS.STARTING_EASE,
    interval_days: 1,
    repetitions: 0,
    next_review_date: now.toISOString(),
  };
}

export function getCardsDueToday(schedules: SpacedRepetitionSchedule[]): SpacedRepetitionSchedule[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return schedules.filter((schedule) => {
    const reviewDate = new Date(schedule.next_review_date);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate <= now;
  });
}

export function calculateMasteredStatus(schedule: SpacedRepetitionSchedule): 'mastered' | 'learning' | 'struggling' {
  if (schedule.ease_factor >= 3.0 && schedule.interval_days >= 21) {
    return 'mastered';
  }
  if (schedule.repetitions === 0 || schedule.ease_factor < 2.0) {
    return 'struggling';
  }
  return 'learning';
}

export function getAchievementUnlocked(
  totalCardsMastered: number,
  currentStreak: number,
  totalAttempts: number
): string | null {
  if (totalCardsMastered === 10) return 'first_ten_mastered';
  if (totalCardsMastered === 50) return 'fifty_mastered';
  if (totalCardsMastered === 100) return 'hundred_mastered';
  if (currentStreak === 7) return 'week_streak';
  if (currentStreak === 30) return 'month_streak';
  if (totalAttempts === 1000) return 'thousand_attempts';
  return null;
}

export const ACHIEVEMENTS = {
  first_ten_mastered: {
    name: 'Getting Started',
    description: 'Master your first 10 cards',
    icon: 'Zap',
  },
  fifty_mastered: {
    name: 'Making Progress',
    description: 'Master 50 cards',
    icon: 'TrendingUp',
  },
  hundred_mastered: {
    name: 'Milestone Master',
    description: 'Master 100 cards',
    icon: 'Trophy',
  },
  week_streak: {
    name: 'Week Warrior',
    description: 'Practice for 7 consecutive days',
    icon: 'Flame',
  },
  month_streak: {
    name: 'Month Master',
    description: 'Practice for 30 consecutive days',
    icon: 'Crown',
  },
  thousand_attempts: {
    name: 'Dedicated Learner',
    description: 'Complete 1000 card attempts',
    icon: 'Award',
  },
};