/** Potential Weakness from last N valid SRS attempts per skill (Master Spec §10). */

export const WEAKNESS_WINDOW = 20;
export const WEAKNESS_ACCURACY_THRESHOLD = 0.8; // trigger strictly below 80%

export interface ValidSkillAttempt {
  skillId: string;
  isCorrect: boolean;
  /** ISO or epoch; used only for ordering when provided */
  answeredAt?: string | number;
  isRemediation?: boolean;
  isValid?: boolean;
}

export interface SkillWeaknessSnapshot {
  skillId: string;
  sampleSize: number;
  correctCount: number;
  accuracy: number | null;
  /** true only when sampleSize >= 20 and accuracy < 0.8 */
  isPotentialWeakness: boolean;
  /** evidence still accumulating */
  accumulating: boolean;
}

/**
 * Last `window` valid non-demo attempts for one skill (newest last in input → take end).
 * Pass attempts already filtered to is_valid === true for that skill when possible.
 */
export function evaluateSkillWeakness(
  attemptsNewestLast: ValidSkillAttempt[],
  skillId: string,
  window = WEAKNESS_WINDOW
): SkillWeaknessSnapshot {
  const forSkill = attemptsNewestLast.filter(
    (a) =>
      a.skillId === skillId &&
      a.isValid !== false &&
      !a.isRemediation // ordinary window by default; remediation excluded from re-eval path
  );
  const slice = forSkill.slice(-window);
  const sampleSize = slice.length;
  const correctCount = slice.filter((a) => a.isCorrect).length;
  if (sampleSize < window) {
    return {
      skillId,
      sampleSize,
      correctCount,
      accuracy: sampleSize === 0 ? null : correctCount / sampleSize,
      isPotentialWeakness: false,
      accumulating: true,
    };
  }
  const accuracy = correctCount / sampleSize;
  return {
    skillId,
    sampleSize,
    correctCount,
    accuracy,
    isPotentialWeakness: accuracy < WEAKNESS_ACCURACY_THRESHOLD,
    accumulating: false,
  };
}

/**
 * Pick remediation target among weakness skills.
 * DEC-20261102-15: teacher pin first; else lowest accuracy; ties → stable skill id.
 */
export function pickRemediationTargetSkill(params: {
  snapshots: SkillWeaknessSnapshot[];
  pinnedSkillId?: string | null;
}): string | null {
  if (params.pinnedSkillId) {
    const pinned = params.snapshots.find(
      (s) => s.skillId === params.pinnedSkillId && s.isPotentialWeakness
    );
    if (pinned) return pinned.skillId;
    // Pin can force target even if not currently weakness? Spec: teacher pin/lock target.
    return params.pinnedSkillId;
  }
  const weak = params.snapshots
    .filter((s) => s.isPotentialWeakness && s.accuracy !== null)
    .sort((a, b) => {
      const acc = (a.accuracy ?? 1) - (b.accuracy ?? 1);
      if (acc !== 0) return acc;
      return a.skillId.localeCompare(b.skillId);
    });
  return weak[0]?.skillId ?? null;
}
