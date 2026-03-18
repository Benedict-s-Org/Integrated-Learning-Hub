export interface SpellingWordSchedule {
  id?: string;
  user_id: string;
  word: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_reviewed_at?: string;
  last_quality_rating?: number;
}

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

/**
 * Standard SM-2 Algorithm Implementation
 * 
 * Interval Sequence:
 * I(1) = 1 day
 * I(2) = 6 days
 * I(n) = I(n-1) * EF
 * 
 * Ease Factor update:
 * EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 * q: quality of response (0-5)
 */
export function calculateStandardNextReview(
  schedule: { ease_factor: number; interval_days: number; repetitions: number },
  qualityRating: number
): SM2Result {
  let { ease_factor: easeFactor, interval_days: interval, repetitions } = schedule;

  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  // q in [0, 5]
  const q = Math.max(0, Math.min(5, qualityRating));
  
  if (q >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    
    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // Minimum ease factor
    repetitions += 1;
  } else {
    // Incorrect response - reset repetitions but keep EF (or slightly reduce)
    repetitions = 0;
    interval = 1;
    // Some implementations keep EF, others penalize. We'll follow standard SM-2 which primarily resets interval.
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  nextReviewDate.setHours(0, 0, 0, 0); // Start of the day

  return {
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    interval,
    repetitions,
    nextReviewDate
  };
}

export function initializeSpellingSchedule(word: string, userId: string): Partial<SpellingWordSchedule> {
  return {
    user_id: userId,
    word: word.trim(),
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_date: new Date().toISOString(),
  };
}

/**
 * Maps simple correctness and time to a 0-5 quality rating.
 * 5: perfect response, no hesitation
 * 4: correct response after a hesitation
 * 3: correct response recalled with serious difficulty
 * 2: incorrect response; where the correct one seemed easy to recall
 * 1: incorrect response; the correct one remembered
 * 0: complete blackout.
 */
export function getStandardQualityRating(
  isCorrect: boolean,
  responseTimeMs: number
): number {
  if (!isCorrect) {
    if (responseTimeMs > 20000) return 0;
    if (responseTimeMs > 10000) return 1;
    return 2;
  }

  if (responseTimeMs < 3000) return 5;
  if (responseTimeMs < 8000) return 4;
  return 3;
}
