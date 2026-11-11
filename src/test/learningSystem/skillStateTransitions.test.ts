import { describe, it, expect } from 'vitest';
import {
  applyOrdinarySetToSkillStates,
  applyRemediationPin,
  applyRemediationSetOutcome,
  applyTeacherFollowedUp,
  countRemediationFocusCorrect,
  emptySkillState,
} from '../../lib/learningSystem/skillStateTransitions';
import type { ValidSkillAttempt } from '../../lib/learningSystem/weakness';

function attempts(skillId: string, correctFlags: boolean[]): ValidSkillAttempt[] {
  return correctFlags.map((isCorrect, i) => ({
    skillId,
    isCorrect,
    answeredAt: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`,
    isValid: true,
    isRemediation: false,
  }));
}

describe('applyRemediationSetOutcome', () => {
  it('pass clears weakness and resets loop', () => {
    const prev = {
      ...emptySkillState('s1'),
      potentialWeakness: true,
      remediationLoop: 1,
    };
    const r = applyRemediationSetOutcome({ state: prev, focusCorrectCount: 5 });
    expect(r.outcome).toBe('pass');
    expect(r.state.potentialWeakness).toBe(false);
    expect(r.state.remediationLoop).toBe(0);
    expect(r.state.ordinarySincePass).toBe(0);
    expect(r.openIntervention).toBe(false);
  });

  it('first fail continues; second fail opens intervention', () => {
    const first = applyRemediationSetOutcome({
      state: { ...emptySkillState('s1'), potentialWeakness: true, remediationLoop: 0 },
      focusCorrectCount: 4,
    });
    expect(first.outcome).toBe('fail_continue');
    expect(first.state.remediationLoop).toBe(1);
    expect(first.openIntervention).toBe(false);

    const second = applyRemediationSetOutcome({
      state: first.state,
      focusCorrectCount: 3,
    });
    expect(second.outcome).toBe('fail_intervene');
    expect(second.state.remediationPaused).toBe(true);
    expect(second.state.teacherInterventionOpen).toBe(true);
    expect(second.openIntervention).toBe(true);
  });
});

describe('applyOrdinarySetToSkillStates', () => {
  it('does not arm weakness before 20 ordinary valids', () => {
    const hist = attempts('s1', Array(19).fill(false));
    const next = applyOrdinarySetToSkillStates({
      states: {},
      ordinaryValidCountBySkill: { s1: 19 },
      allAttemptsNewestLast: hist,
    });
    expect(next.s1.potentialWeakness).toBe(false);
    expect(next.s1.ordinarySincePass).toBe(19);
  });

  it('arms weakness at 20 with accuracy under 80%', () => {
    // 15/20 correct = 75% → weak
    const flags = [...Array(15).fill(true), ...Array(5).fill(false)];
    const hist = attempts('s1', flags);
    const next = applyOrdinarySetToSkillStates({
      states: { s1: { ...emptySkillState('s1'), ordinarySincePass: 15 } },
      ordinaryValidCountBySkill: { s1: 5 },
      allAttemptsNewestLast: hist,
    });
    expect(next.s1.ordinarySincePass).toBe(0);
    expect(next.s1.potentialWeakness).toBe(true);
  });

  it('does not clear existing weakness on ordinary sets', () => {
    const next = applyOrdinarySetToSkillStates({
      states: { s1: { ...emptySkillState('s1'), potentialWeakness: true } },
      ordinaryValidCountBySkill: { s1: 3 },
      allAttemptsNewestLast: attempts('s1', Array(20).fill(true)),
    });
    expect(next.s1.potentialWeakness).toBe(true);
  });
});

describe('applyRemediationPin', () => {
  it('keeps a single pin and can clear it', () => {
    const states = {
      a: { ...emptySkillState('a'), teacherPin: true, potentialWeakness: true },
      b: { ...emptySkillState('b'), potentialWeakness: true },
    };
    const pinned = applyRemediationPin({ states, skillId: 'b' });
    expect(pinned.find((s) => s.skillId === 'a')?.teacherPin).toBe(false);
    expect(pinned.find((s) => s.skillId === 'b')?.teacherPin).toBe(true);
    expect(pinned.find((s) => s.skillId === 'b')?.potentialWeakness).toBe(true);

    const cleared = applyRemediationPin({
      states: {
        a: { ...states.a, teacherPin: false },
        b: { ...states.b, teacherPin: true },
      },
      skillId: null,
    });
    expect(cleared).toEqual([{ ...states.b, teacherPin: false }]);
  });
});

describe('applyTeacherFollowedUp', () => {
  it('clears pause and intervention gate', () => {
    const next = applyTeacherFollowedUp({
      ...emptySkillState('s1'),
      potentialWeakness: true,
      remediationPaused: true,
      teacherInterventionOpen: true,
      remediationLoop: 2,
    });
    expect(next.remediationPaused).toBe(false);
    expect(next.teacherInterventionOpen).toBe(false);
    expect(next.remediationLoop).toBe(0);
    expect(next.potentialWeakness).toBe(true);
  });
});

describe('countRemediationFocusCorrect', () => {
  it('uses leading block when all target skill', () => {
    const n = countRemediationFocusCorrect({
      targetSkillId: 's1',
      orderedResults: [
        { skillId: 's1', correct: true },
        { skillId: 's1', correct: true },
        { skillId: 's1', correct: false },
        { skillId: 's1', correct: true },
        { skillId: 's1', correct: true },
        { skillId: 's1', correct: true },
        { skillId: 'other', correct: false },
      ],
    });
    expect(n).toBe(5);
  });
});
