import { describe, it, expect } from 'vitest';
import { selectLsSetMode } from '../../lib/learningSystem/modeSelection';
import { buildSeedQuestionPool } from '../../lib/learningSystem/seedQuestionBank';
import type { GrammarMicroSkill } from '../../lib/learningSystem/types';

describe('selectLsSetMode', () => {
  it('uses first_mix when no completed sets and no remediation', () => {
    const r = selectLsSetMode({
      completedSetCount: 0,
      remediationTargetSkillId: null,
      remediationPaused: false,
      teacherInterventionOpen: false,
    });
    expect(r.mode).toBe('first_mix');
  });

  it('uses ordinary_review after first completed set', () => {
    const r = selectLsSetMode({
      completedSetCount: 1,
      remediationTargetSkillId: null,
      remediationPaused: false,
      teacherInterventionOpen: false,
    });
    expect(r.mode).toBe('ordinary_review');
  });

  it('prefers remediation when allowed and target set', () => {
    const r = selectLsSetMode({
      completedSetCount: 5,
      remediationTargetSkillId: 'ms_x',
      remediationPaused: false,
      teacherInterventionOpen: false,
    });
    expect(r.mode).toBe('remediation');
    expect(r.targetSkillId).toBe('ms_x');
  });

  it('skips remediation when paused', () => {
    const r = selectLsSetMode({
      completedSetCount: 5,
      remediationTargetSkillId: 'ms_x',
      remediationPaused: true,
      teacherInterventionOpen: false,
    });
    expect(r.mode).toBe('ordinary_review');
  });
});

describe('buildSeedQuestionPool', () => {
  const skill = (id: string, yearLinks = [2]): GrammarMicroSkill =>
    ({
      id,
      name: id,
      measures: 'm',
      boundary: null,
      chapter_ref: null,
      concept: null,
      branch: null,
      longman_refs: [],
      example_stem: `${id} ___ .`,
      example_options: ['a', 'b', 'c', 'd'],
      example_correct_index: 0,
      variation_tags: [],
      status: 'active',
      round1_in_scope: true,
    }) as GrammarMicroSkill;

  it('expands skills into year×variant candidates', () => {
    const pool = buildSeedQuestionPool({
      skills: [skill('s1'), skill('s2')],
      yearLinks: [
        { skill_id: 's1', year_level: 3 },
        { skill_id: 's1', year_level: 2 },
        { skill_id: 's2', year_level: 2 },
      ],
      variantsPerYear: 2,
    });
    expect(pool).toHaveLength(6); // s1:2y×2 + s2:1y×2
    expect(pool.every((q) => q.isDue && q.isSeedScaffold)).toBe(true);
    expect(pool.filter((q) => q.skillId === 's1' && q.yearLevel === 3)).toHaveLength(2);
  });
});
