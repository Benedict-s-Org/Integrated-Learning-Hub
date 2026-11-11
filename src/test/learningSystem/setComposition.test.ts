import { describe, it, expect } from 'vitest';
import {
  filterByTaughtSkills,
  type LsQuestionCandidate,
} from '../../lib/learningSystem/eligibility';
import {
  composeFirstMixSet,
  composeOrdinaryReviewSet,
  composeRemediationSet,
} from '../../lib/learningSystem/setComposition';

const rng = () => 0.1;

function q(
  id: string,
  skillId: string,
  yearLevel: number,
  isDue = false
): LsQuestionCandidate {
  return { id, skillId, yearLevel, isDue };
}

describe('filterByTaughtSkills', () => {
  it('never includes untaught skills even if due', () => {
    const pool = [
      q('a', 'skill_taught', 3, true),
      q('b', 'skill_untaught', 3, true),
    ];
    const out = filterByTaughtSkills(pool, ['skill_taught']);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });
});

describe('composeFirstMixSet', () => {
  it('builds 6 current-grade + 4 prior-grade from taught only', () => {
    const taught = ['cur', 'prior'];
    const candidates: LsQuestionCandidate[] = [];
    for (let i = 0; i < 8; i++) candidates.push(q(`c${i}`, 'cur', 3));
    for (let i = 0; i < 6; i++) candidates.push(q(`p${i}`, 'prior', 2));
    candidates.push(q('future', 'cur', 4));
    candidates.push(q('untaught', 'other', 2));

    const result = composeFirstMixSet({
      candidates,
      taughtSkillIds: taught,
      studentYearLevel: 3,
      rng,
    });
    expect(result.ok).toBe(true);
    expect(result.questions).toHaveLength(10);
    expect(result.questions.filter((x) => x.yearLevel === 3)).toHaveLength(6);
    expect(result.questions.filter((x) => x.yearLevel === 2)).toHaveLength(4);
    expect(result.questions.every((x) => taught.includes(x.skillId))).toBe(true);
  });

  it('reports gap instead of filling with untaught', () => {
    const result = composeFirstMixSet({
      candidates: [q('c0', 'cur', 3)],
      taughtSkillIds: ['cur'],
      studentYearLevel: 3,
      rng,
    });
    expect(result.ok).toBe(false);
    expect(result.gaps.length).toBeGreaterThan(0);
  });
});

describe('composeOrdinaryReviewSet', () => {
  it('only takes due taught items', () => {
    const result = composeOrdinaryReviewSet({
      candidates: [
        q('d1', 's1', 3, true),
        q('d2', 's1', 3, true),
        q('notdue', 's1', 3, false),
        q('untaught', 'x', 3, true),
      ],
      taughtSkillIds: ['s1'],
      studentYearLevel: 3,
      limit: 2,
      rng,
    });
    expect(result.ok).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.every((x) => x.isDue && x.skillId === 's1')).toBe(true);
  });
});

describe('composeRemediationSet', () => {
  it('uses six items of the same target skill', () => {
    const candidates: LsQuestionCandidate[] = [];
    for (let i = 0; i < 8; i++) candidates.push(q(`t${i}`, 'target', 3, false));
    for (let i = 0; i < 6; i++) candidates.push(q(`o${i}`, 'other', 3, true));

    const result = composeRemediationSet({
      candidates,
      taughtSkillIds: ['target', 'other'],
      studentYearLevel: 3,
      targetSkillId: 'target',
      rng,
    });
    expect(result.ok).toBe(true);
    const focus = result.questions.slice(0, 6);
    expect(focus.every((x) => x.skillId === 'target')).toBe(true);
    expect(result.questions.slice(6).every((x) => x.isDue)).toBe(true);
  });

  it('refuses untaught target skill', () => {
    const result = composeRemediationSet({
      candidates: [q('t0', 'target', 3)],
      taughtSkillIds: ['other'],
      studentYearLevel: 3,
      targetSkillId: 'target',
      rng,
    });
    expect(result.ok).toBe(false);
  });
});
