import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { currentProgressUnit, hongKongDateIso } from '../../lib/learningSystem/curriculumProgress';
import {
  composeConceptCheck,
  conceptCheckRng,
  expandProofreadingBank,
  roundProofreadingCount,
} from '../../lib/learningSystem/proofreadingConceptCheck';

function curriculumRows() {
  const sql = readFileSync(
    'supabase/migrations/20261108120000_school_curriculum_micro_skills_2026_27.sql',
    'utf8'
  );
  const head = sql.split('ON CONFLICT')[0];
  const rows = [];
  const re =
    /\(\s*'((?:p|ms)[^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'/g;
  for (const match of head.matchAll(re)) {
    const unescape = (value: string) => value.replace(/''/g, "'");
    rows.push({
      id: match[1],
      measures: unescape(match[3]),
      boundary: unescape(match[4]),
      chapter_ref: unescape(match[5]),
      branch: unescape(match[7]),
    });
  }
  return rows;
}

describe('roundProofreadingCount', () => {
  it('rounds half up to the nearest ten', () => {
    expect(roundProofreadingCount(63)).toBe(60);
    expect(roundProofreadingCount(65)).toBe(70);
    expect(roundProofreadingCount(64)).toBe(60);
    expect(roundProofreadingCount(66)).toBe(70);
    expect(roundProofreadingCount(60)).toBe(60);
    expect(roundProofreadingCount(5)).toBe(10);
  });

  it('keeps a count that would otherwise round to zero', () => {
    expect(roundProofreadingCount(4)).toBe(4);
    expect(roundProofreadingCount(0)).toBe(0);
  });
});

describe('currentProgressUnit', () => {
  it('places a P.4 class on A4 on 12 November 2026', () => {
    const unit = currentProgressUnit('P.4', '2026-11-12');
    expect(unit?.code).toBe('A4');
    expect(unit?.rank).toBe(4);
  });

  it('stays on A3 during the term-test gap before cycles 6–10', () => {
    expect(currentProgressUnit('P.4', '2026-11-02')?.code).toBe('A3');
  });

  it('has not started P.4 before the school year', () => {
    expect(currentProgressUnit('P.4', '2026-09-03')).toBeNull();
  });
});

describe('hongKongDateIso', () => {
  it('uses the Hong Kong calendar date', () => {
    expect(hongKongDateIso(new Date('2026-11-11T20:00:00Z'))).toBe('2026-11-12');
  });
});

describe('expandProofreadingBank', () => {
  it('keeps the authored sentence and does not add a second error', () => {
    const bank = expandProofreadingBank([
      { sentence: 'She likes I.', error: 'I', corrected: 'me' },
    ]);
    expect(bank).toEqual([{ sentence: 'She likes I.', error: 'I', corrected: 'me' }]);
  });
});

describe('composeConceptCheck', () => {
  const rows = curriculumRows();

  it('gives a P.4 student six sets of ten before regular practice', () => {
    const plan = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
      rng: conceptCheckRng('p4-student'),
    });
    expect(plan.gaps).toEqual([]);
    expect(plan.textCount).toBe(63);
    expect(plan.targetCount).toBe(60);
    expect(plan.allQuestions).toHaveLength(60);
    expect(plan.setCount).toBe(6);
    expect(plan.questions).toHaveLength(10);
    expect(new Set(plan.allQuestions.map((q) => q.skillId)).size).toBe(60);
    expect(plan.repeatedIds).toEqual([]);
    expect(plan.droppedIds).toEqual([
      'p1_2627bk1_be_is_form',
      'p1_2627bk1_wh_who_person',
      'p1_2627bk2_inf_verb_after_to_bare',
    ]);
    expect(plan.allQuestions.some((q) => q.skillId === 'p4_A4_superlative_most')).toBe(true);
    expect(plan.allQuestions.some((q) => q.skillId === 'p4_A5_which')).toBe(false);
    expect(plan.allQuestions.some((q) => q.skillId.includes('_im_'))).toBe(false);
    expect(plan.allQuestions.every((q) => q.errorWordIndex >= 0)).toBe(true);
    expect(new Set(plan.questions.map((q) => q.yearLevel)).size).toBeGreaterThan(1);
    const byYear = [...plan.allQuestions].sort((a, b) => a.yearLevel - b.yearLevel || a.skillId.localeCompare(b.skillId));
    expect(plan.allQuestions.map((q) => q.skillId)).not.toEqual(byYear.map((q) => q.skillId));

    const last = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
      setIndex: 5,
      rng: conceptCheckRng('p4-student'),
    });
    expect(last.questions).toHaveLength(10);
    expect(last.questions.map((q) => q.id)).toEqual(
      plan.allQuestions.slice(50).map((q) => q.id)
    );
    const done = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
      setIndex: 6,
      rng: conceptCheckRng('p4-student'),
    });
    expect(done.questions).toHaveLength(0);
  });

  it('uses a Notion proofreading row when that skill has one', () => {
    const plan = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
      rng: () => 0,
      questionBank: new Map([
        ['p2_2627bk11_pronoun_object', [{ sentence: 'They saw I.', error: 'I', corrected: 'me' }]],
      ]),
    });
    const item = plan.allQuestions.find((q) => q.skillId === 'p2_2627bk11_pronoun_object');
    expect(item?.sentence).toBe('They saw I.');
    expect(item?.corrected).toBe('me');
  });

  it('uses an authored sentence with one wrong word', () => {
    const plan = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
      rng: () => 0,
    });
    const item = plan.allQuestions.find((q) => q.skillId === 'p2_2627bk11_pronoun_object');
    expect(item?.sentence).toBe('She likes I.');
    expect(item?.error).toBe('I');
    expect(item?.corrected).toBe('me');
    expect(plan.allQuestions.every((q) => !/yesterday morning|last night|every Monday/.test(q.sentence))).toBe(true);
  });

  it('repeats current-grade skills when the count rounds up', () => {
    const plan = composeConceptCheck({
      skills: rows,
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
    });
    const extra = {
      id: 'p4_A4_extra_a',
      measures: 'Wrong word cat. Correct word cats.',
      boundary: 'Proofreading: I see two cat.',
      chapter_ref: 'P.4 A4',
      branch: 'Text',
    };
    const extraB = {
      id: 'p4_A4_extra_b',
      measures: 'Wrong word dog. Correct word dogs.',
      boundary: 'Proofreading: I see two dog.',
      chapter_ref: 'P.4 A4',
      branch: 'Text',
    };
    const rounded = composeConceptCheck({
      skills: [...rows, extra, extraB],
      gradeKey: 'P.4',
      studentYear: 4,
      isoDate: '2026-11-12',
    });
    expect(plan.textCount).toBe(63);
    expect(rounded.textCount).toBe(65);
    expect(rounded.targetCount).toBe(70);
    expect(rounded.droppedIds).toEqual([]);
    expect(rounded.allQuestions).toHaveLength(70);
    expect(rounded.setCount).toBe(7);
    expect(rounded.repeatedIds.length).toBe(5);
    expect(rounded.repeatedIds.every((id) => id.startsWith('p4_'))).toBe(true);
  });
});
