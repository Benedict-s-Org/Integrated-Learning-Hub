/**
 * Decide Learning System set mode from student state.
 * Dense remediation only when allowed and a target skill is known.
 */

import { isDenseRemediationAllowed } from './remediation';
import type { LsSetMode } from './setComposition';

export interface ModeSelectionInput {
  completedSetCount: number;
  remediationTargetSkillId: string | null;
  remediationPaused: boolean;
  teacherInterventionOpen: boolean;
}

export interface ModeSelectionResult {
  mode: LsSetMode;
  targetSkillId: string | null;
}

export function selectLsSetMode(input: ModeSelectionInput): ModeSelectionResult {
  const denseOk = isDenseRemediationAllowed({
    remediationPaused: input.remediationPaused,
    teacherInterventionOpen: input.teacherInterventionOpen,
  });

  if (denseOk && input.remediationTargetSkillId) {
    return {
      mode: 'remediation',
      targetSkillId: input.remediationTargetSkillId,
    };
  }

  if (input.completedSetCount <= 0) {
    return { mode: 'first_mix', targetSkillId: null };
  }

  return { mode: 'ordinary_review', targetSkillId: null };
}
