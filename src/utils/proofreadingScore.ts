/**
 * Proofreading item score (DEC-20261102-18).
 * Correction credit requires the student found the error word first.
 * Match is trimmed, case-insensitive, and exact.
 */

export interface ProofreadingItemScore {
  detectionCorrect: boolean;
  /** True only when the error word was found and the correction matches exactly. */
  correctionCorrect: boolean;
  isCorrect: boolean;
}

export function scoreProofreadingItem(params: {
  userWordIndex?: number;
  userCorrection?: string;
  expectedWordIndex: number;
  expectedCorrection: string;
  isNotSure?: boolean;
  isIncomplete?: boolean;
}): ProofreadingItemScore {
  if (params.isNotSure || params.isIncomplete) {
    return { detectionCorrect: false, correctionCorrect: false, isCorrect: false };
  }
  if (params.userWordIndex === undefined) {
    return { detectionCorrect: false, correctionCorrect: false, isCorrect: false };
  }

  const detectionCorrect = params.userWordIndex === params.expectedWordIndex;
  const typed = (params.userCorrection ?? '').trim().toLowerCase();
  const expected = params.expectedCorrection.trim().toLowerCase();
  const textMatches = typed.length > 0 && typed === expected;
  const correctionCorrect = detectionCorrect && textMatches;

  return {
    detectionCorrect,
    correctionCorrect,
    isCorrect: correctionCorrect,
  };
}
