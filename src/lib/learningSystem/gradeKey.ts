import type { LearningSystemGradeKey } from './types';

/**
 * Derive Learning System grade key from users.class (DEC-20261102-12).
 * Aligned with essay-marking `parseGradeFromClassName` → P.1–P.6.
 * Returns null if unparseable — callers must not guess.
 */
export function parseLearningSystemGradeKey(
  className?: string | null
): LearningSystemGradeKey | null {
  if (!className) return null;
  const trimmed = className.trim();
  const match = trimmed.match(/^(?:P\.?|Primary\s*)?([1-6])(?:[A-Za-z]|\b)/i);
  if (match) {
    return `P.${match[1]}` as LearningSystemGradeKey;
  }
  return null;
}

export function isLearningSystemGradeKey(value: string): value is LearningSystemGradeKey {
  return ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6'].includes(value);
}
