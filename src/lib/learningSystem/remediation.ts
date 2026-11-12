/** Remediation loop rules (Master Spec §10 + DEC-20261102-16/17). */

export const REMEDIATION_FOCUS_SIZE = 6;
export const REMEDIATION_PASS_MIN_CORRECT = 5;
export const REMEDIATION_MAX_LOOPS = 2;
export const ORDINARY_ATTEMPTS_BEFORE_REARM = 20;

export type RemediationLoopOutcome = 'pass' | 'fail_continue' | 'fail_intervene';

export interface RemediationLoopResult {
  correctInFocus: number;
  focusSize: number;
  passed: boolean;
  outcome: RemediationLoopOutcome;
  nextLoop: number;
}

/**
 * Evaluate the six focus items of a remediation set (not the 4 due fill).
 * `loopBefore` is 0 or 1 going into this check (attempts so far failed).
 */
export function evaluateRemediationFocus(params: {
  focusCorrectCount: number;
  focusSize?: number;
  /** Completed failed loops before this set (0 = first loop) */
  failedLoopsBefore: number;
}): RemediationLoopResult {
  const focusSize = params.focusSize ?? REMEDIATION_FOCUS_SIZE;
  const correctInFocus = params.focusCorrectCount;
  const passed = correctInFocus >= REMEDIATION_PASS_MIN_CORRECT;
  if (passed) {
    return {
      correctInFocus,
      focusSize,
      passed: true,
      outcome: 'pass',
      nextLoop: 0,
    };
  }
  const failedLoopsAfter = params.failedLoopsBefore + 1;
  if (failedLoopsAfter >= REMEDIATION_MAX_LOOPS) {
    return {
      correctInFocus,
      focusSize,
      passed: false,
      outcome: 'fail_intervene',
      nextLoop: failedLoopsAfter,
    };
  }
  return {
    correctInFocus,
    focusSize,
    passed: false,
    outcome: 'fail_continue',
    nextLoop: failedLoopsAfter,
  };
}

/**
 * After pass: clear weakness; re-arm only after 20 new ordinary valid attempts (DEC-20261102-16).
 */
export function shouldRearmWeaknessAfterPass(ordinaryAttemptsSincePass: number): boolean {
  return ordinaryAttemptsSincePass >= ORDINARY_ATTEMPTS_BEFORE_REARM;
}

/**
 * After two failed loops: dense remediation paused; student uses ordinary sets until teacher follow-up.
 */
export function isDenseRemediationAllowed(state: {
  remediationPaused: boolean;
  teacherInterventionOpen: boolean;
}): boolean {
  if (state.remediationPaused) return false;
  if (state.teacherInterventionOpen) return false;
  return true;
}
