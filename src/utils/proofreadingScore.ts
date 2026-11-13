/**
 * Proofreading item score (DEC-20261102-18, extended DEC-20261113-01).
 * Correction credit requires the student found the error word first.
 * Match is trimmed, case-insensitive, and exact against any comma-separated alternative.
 */

export interface ProofreadingItemScore {
  detectionCorrect: boolean;
  /** True only when the error word was found and the correction matches exactly. */
  correctionCorrect: boolean;
  isCorrect: boolean;
}

/** Split a Notion Corrected value into acceptable answers (comma = OR). */
export function parseProofreadingCorrectionAlternatives(expectedCorrection: string): string[] {
  return expectedCorrection
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Human-readable alternatives for feedback, e.g. "is / was". */
export function formatProofreadingCorrectionAlternatives(expectedCorrection: string): string {
  const parts = parseProofreadingCorrectionAlternatives(expectedCorrection);
  return parts.length > 0 ? parts.join(' / ') : expectedCorrection.trim();
}

/** Case-insensitive trimmed exact match against any comma-separated alternative. */
export function matchesProofreadingCorrection(
  userCorrection: string | undefined,
  expectedCorrection: string
): boolean {
  const typed = (userCorrection ?? '').trim().toLowerCase();
  if (typed.length === 0) return false;
  return parseProofreadingCorrectionAlternatives(expectedCorrection).some(
    (alt) => alt.toLowerCase() === typed
  );
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
  const textMatches = matchesProofreadingCorrection(
    params.userCorrection,
    params.expectedCorrection
  );
  const correctionCorrect = detectionCorrect && textMatches;

  return {
    detectionCorrect,
    correctionCorrect,
    isCorrect: correctionCorrect,
  };
}
