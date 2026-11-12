/**
 * Pure Learning System skill-state transitions (DEC-20261102-15…17).
 *
 * ordinary_since_pass: counts valid ordinary attempts while not flagged weak.
 * Weakness may only (re)arm once that counter reaches 20, then rolling accuracy applies.
 * After remediation pass, counter resets to 0 so another 20 ordinary are required.
 */

import {
  evaluateRemediationFocus,
  ORDINARY_ATTEMPTS_BEFORE_REARM,
  REMEDIATION_FOCUS_SIZE,
  type RemediationLoopOutcome,
} from './remediation';
import { evaluateSkillWeakness, type ValidSkillAttempt } from './weakness';

export interface LsSkillState {
  skillId: string;
  potentialWeakness: boolean;
  /** Failed remediation loops completed (0–2) */
  remediationLoop: number;
  remediationPaused: boolean;
  teacherInterventionOpen: boolean;
  ordinarySincePass: number;
  teacherPin: boolean;
}

export function emptySkillState(skillId: string): LsSkillState {
  return {
    skillId,
    potentialWeakness: false,
    remediationLoop: 0,
    remediationPaused: false,
    teacherInterventionOpen: false,
    ordinarySincePass: 0,
    teacherPin: false,
  };
}

export interface RemediationSetOutcomeApplied {
  state: LsSkillState;
  outcome: RemediationLoopOutcome;
  /** Open a new intervention episode (notify once) */
  openIntervention: boolean;
}

/**
 * Apply remediation set focus results (six focus items).
 */
export function applyRemediationSetOutcome(params: {
  state: LsSkillState;
  focusCorrectCount: number;
  focusSize?: number;
}): RemediationSetOutcomeApplied {
  const result = evaluateRemediationFocus({
    focusCorrectCount: params.focusCorrectCount,
    focusSize: params.focusSize ?? REMEDIATION_FOCUS_SIZE,
    failedLoopsBefore: params.state.remediationLoop,
  });

  if (result.outcome === 'pass') {
    return {
      outcome: 'pass',
      openIntervention: false,
      state: {
        ...params.state,
        potentialWeakness: false,
        remediationLoop: 0,
        remediationPaused: false,
        teacherInterventionOpen: false,
        ordinarySincePass: 0,
      },
    };
  }

  if (result.outcome === 'fail_continue') {
    return {
      outcome: 'fail_continue',
      openIntervention: false,
      state: {
        ...params.state,
        potentialWeakness: true,
        remediationLoop: result.nextLoop,
      },
    };
  }

  return {
    outcome: 'fail_intervene',
    openIntervention: true,
    state: {
      ...params.state,
      potentialWeakness: true,
      remediationLoop: result.nextLoop,
      remediationPaused: true,
      teacherInterventionOpen: true,
    },
  };
}

/**
 * After an ordinary / first_mix set: bump counters and refresh weakness for non-paused skills.
 */
export function applyOrdinarySetToSkillStates(params: {
  states: Record<string, LsSkillState>;
  ordinaryValidCountBySkill: Record<string, number>;
  allAttemptsNewestLast: ValidSkillAttempt[];
}): Record<string, LsSkillState> {
  const skillIds = new Set<string>([
    ...Object.keys(params.states),
    ...Object.keys(params.ordinaryValidCountBySkill),
  ]);

  const next: Record<string, LsSkillState> = { ...params.states };

  for (const skillId of skillIds) {
    const prev = next[skillId] ?? emptySkillState(skillId);
    const added = params.ordinaryValidCountBySkill[skillId] ?? 0;

    if (prev.remediationPaused || prev.teacherInterventionOpen) {
      // Dense remedi frozen; keep flags until teacher follow-up
      next[skillId] = prev;
      continue;
    }

    if (prev.potentialWeakness) {
      // Stay weak until remediation pass clears it
      next[skillId] = prev;
      continue;
    }

    const ordinarySincePass = prev.ordinarySincePass + added;
    let potentialWeakness = false;

    if (ordinarySincePass >= ORDINARY_ATTEMPTS_BEFORE_REARM) {
      const snap = evaluateSkillWeakness(params.allAttemptsNewestLast, skillId);
      potentialWeakness = snap.isPotentialWeakness;
    }

    next[skillId] = {
      ...prev,
      ordinarySincePass: potentialWeakness ? 0 : ordinarySincePass,
      potentialWeakness,
      remediationLoop: potentialWeakness ? prev.remediationLoop : 0,
    };
  }

  return next;
}

/** Clear intervention gate so auto remediation can run again (DEC-20261102-17). */
export function applyTeacherFollowedUp(state: LsSkillState): LsSkillState {
  return {
    ...state,
    remediationPaused: false,
    teacherInterventionOpen: false,
    remediationLoop: 0,
  };
}

/**
 * One remediation pin per student (DEC-20261102-15).
 * `skillId` null clears every pin. Returns only rows that changed.
 */
export function applyRemediationPin(params: {
  states: Record<string, LsSkillState>;
  skillId: string | null;
}): LsSkillState[] {
  const changed: LsSkillState[] = [];
  for (const state of Object.values(params.states)) {
    if (state.teacherPin && state.skillId !== params.skillId) {
      changed.push({ ...state, teacherPin: false });
    }
  }
  if (!params.skillId) return changed;

  const current = params.states[params.skillId] ?? emptySkillState(params.skillId);
  if (!current.teacherPin) {
    changed.push({ ...current, teacherPin: true });
  }
  return changed;
}

/**
 * Correct count for remediation focus block.
 * Prefers leading N items when they are all the target skill (compose order).
 */
export function countRemediationFocusCorrect(params: {
  orderedResults: { skillId: string; correct: boolean }[];
  targetSkillId: string;
  focusSize?: number;
}): number {
  const focusSize = params.focusSize ?? REMEDIATION_FOCUS_SIZE;
  const leading = params.orderedResults.slice(0, focusSize);
  const useLeading =
    leading.length > 0 && leading.every((r) => r.skillId === params.targetSkillId);
  const block = useLeading
    ? leading
    : params.orderedResults
        .filter((r) => r.skillId === params.targetSkillId)
        .slice(0, focusSize);
  return block.filter((r) => r.correct).length;
}
