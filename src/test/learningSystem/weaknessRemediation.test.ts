import { describe, it, expect } from 'vitest';
import {
  evaluateSkillWeakness,
  pickRemediationTargetSkill,
  WEAKNESS_WINDOW,
} from '../../lib/learningSystem/weakness';
import {
  evaluateRemediationFocus,
  shouldRearmWeaknessAfterPass,
  isDenseRemediationAllowed,
  ORDINARY_ATTEMPTS_BEFORE_REARM,
} from '../../lib/learningSystem/remediation';

function attempts(skillId: string, correctPattern: boolean[]): Parameters<
  typeof evaluateSkillWeakness
>[0] {
  return correctPattern.map((isCorrect, i) => ({
    skillId,
    isCorrect,
    answeredAt: i,
    isValid: true,
  }));
}

describe('evaluateSkillWeakness', () => {
  it('does not trigger before 20 valid attempts', () => {
    const pattern = Array.from({ length: 19 }, () => false);
    const snap = evaluateSkillWeakness(attempts('s1', pattern), 's1');
    expect(snap.sampleSize).toBe(19);
    expect(snap.accumulating).toBe(true);
    expect(snap.isPotentialWeakness).toBe(false);
  });

  it('triggers at 15/20 (<80%) and not at 16/20', () => {
    // 15 correct of 20 = 75% → weakness
    const low = [
      ...Array.from({ length: 15 }, () => true),
      ...Array.from({ length: 5 }, () => false),
    ];
    expect(evaluateSkillWeakness(attempts('s1', low), 's1').isPotentialWeakness).toBe(true);

    // 16/20 = 80% → no trigger
    const edge = [
      ...Array.from({ length: 16 }, () => true),
      ...Array.from({ length: 4 }, () => false),
    ];
    expect(evaluateSkillWeakness(attempts('s1', edge), 's1').isPotentialWeakness).toBe(false);
  });

  it('uses last window only', () => {
    const oldBad = Array.from({ length: WEAKNESS_WINDOW }, () => false);
    const recentGood = Array.from({ length: WEAKNESS_WINDOW }, () => true);
    const snap = evaluateSkillWeakness(attempts('s1', [...oldBad, ...recentGood]), 's1');
    expect(snap.correctCount).toBe(20);
    expect(snap.isPotentialWeakness).toBe(false);
  });
});

describe('pickRemediationTargetSkill', () => {
  it('prefers teacher pin', () => {
    const snapshots = [
      {
        skillId: 'low',
        sampleSize: 20,
        correctCount: 10,
        accuracy: 0.5,
        isPotentialWeakness: true,
        accumulating: false,
      },
      {
        skillId: 'pinned',
        sampleSize: 20,
        correctCount: 15,
        accuracy: 0.75,
        isPotentialWeakness: true,
        accumulating: false,
      },
    ];
    expect(pickRemediationTargetSkill({ snapshots, pinnedSkillId: 'pinned' })).toBe('pinned');
  });

  it('else picks lowest accuracy', () => {
    const snapshots = [
      {
        skillId: 'b',
        sampleSize: 20,
        correctCount: 14,
        accuracy: 0.7,
        isPotentialWeakness: true,
        accumulating: false,
      },
      {
        skillId: 'a',
        sampleSize: 20,
        correctCount: 10,
        accuracy: 0.5,
        isPotentialWeakness: true,
        accumulating: false,
      },
    ];
    expect(pickRemediationTargetSkill({ snapshots })).toBe('a');
  });
});

describe('evaluateRemediationFocus', () => {
  it('passes at 5/6 and fails at 4/6', () => {
    expect(evaluateRemediationFocus({ focusCorrectCount: 5, failedLoopsBefore: 0 }).passed).toBe(
      true
    );
    expect(evaluateRemediationFocus({ focusCorrectCount: 4, failedLoopsBefore: 0 }).outcome).toBe(
      'fail_continue'
    );
  });

  it('opens intervention after two failed loops', () => {
    const second = evaluateRemediationFocus({ focusCorrectCount: 4, failedLoopsBefore: 1 });
    expect(second.outcome).toBe('fail_intervene');
  });
});

describe('post-pass rearm and pause', () => {
  it('requires 20 ordinary attempts before rearm', () => {
    expect(shouldRearmWeaknessAfterPass(19)).toBe(false);
    expect(shouldRearmWeaknessAfterPass(ORDINARY_ATTEMPTS_BEFORE_REARM)).toBe(true);
  });

  it('blocks dense remediation when paused or intervention open', () => {
    expect(isDenseRemediationAllowed({ remediationPaused: true, teacherInterventionOpen: false })).toBe(
      false
    );
    expect(
      isDenseRemediationAllowed({ remediationPaused: false, teacherInterventionOpen: true })
    ).toBe(false);
    expect(
      isDenseRemediationAllowed({ remediationPaused: false, teacherInterventionOpen: false })
    ).toBe(true);
  });
});
