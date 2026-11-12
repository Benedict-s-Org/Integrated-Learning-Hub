/**
 * First-visit Proofreading concept check.
 * Each text micro-skill has a bank of 10 sentences. The first visit draws one at random.
 * The drawn items are shuffled, then grouped into sets of 10. A set mixes grades.
 * Picture skills (id contains `_im_`) stay out.
 * The draw count rounds half-up to the nearest 10.
 * Rounding down drops the earliest lower-grade skills first.
 * Rounding up repeats current-grade skills, latest unit first.
 */

import type { GrammarMicroSkill } from './types';
import { chapterUnitRank, currentProgressUnit } from './curriculumProgress';
import type { LearningSystemGradeKey } from './types';

export interface ProofreadingPair {
  sentence: string;
  error: string;
  corrected: string;
}

export interface CurriculumTextSkill {
  id: string;
  year: number;
  unitRank: number;
  pairs: ProofreadingPair[];
}

export interface LsProofreadingQuestion {
  kind: 'proofreading';
  id: string;
  skillId: string;
  yearLevel: number;
  sentence: string;
  error: string;
  corrected: string;
  errorWordIndex: number;
}

export const CONCEPT_CHECK_SET_SIZE = 10;

export interface ConceptCheckPlan {
  /** The current set of 10. Empty once every set is complete. */
  questions: LsProofreadingQuestion[];
  /** Every drawn item, in set order. */
  allQuestions: LsProofreadingQuestion[];
  gaps: string[];
  textCount: number;
  targetCount: number;
  setIndex: number;
  setCount: number;
  droppedIds: string[];
  repeatedIds: string[];
}

/** Stable draw for one student so later sets continue the same sample. */
export function conceptCheckRng(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normToken(value: string): string {
  return value.replace(/[^\w']/g, '').toLowerCase();
}

function errorTokenCount(sentence: string, error: string): number {
  const target = normToken(error);
  return sentence.split(/\s+/).filter(Boolean).filter((token) => {
    return token.toLowerCase() === error.toLowerCase() || normToken(token) === target;
  }).length;
}

/**
 * The sentences already written for one skill.
 * A later 10-item bank is separate. Do not invent extra sentences here:
 * an added phrase can create a second error.
 */
export function expandProofreadingBank(pairs: ProofreadingPair[]): ProofreadingPair[] {
  const out: ProofreadingPair[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    if (seen.has(pair.sentence)) continue;
    if (errorTokenCount(pair.sentence, pair.error) !== 1) continue;
    seen.add(pair.sentence);
    out.push(pair);
  }
  return out;
}

/** Half-up to the nearest 10. 63 → 60, 65 → 70. Counts of 1–4 stay as they are. */
export function roundProofreadingCount(count: number): number {
  if (count <= 0) return 0;
  const rounded = Math.round(count / 10) * 10;
  return rounded === 0 ? count : rounded;
}

export function proofreadingWordIndex(sentence: string, error: string): number {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const norm = (value: string) => value.replace(/[^\w']/g, '').toLowerCase();
  const target = norm(error);
  return tokens.findIndex(
    (token) => token.toLowerCase() === error.toLowerCase() || norm(token) === target
  );
}

function parsePairs(measures: string, boundary: string | null): ProofreadingPair[] {
  const wrongCorrect = [...measures.matchAll(/Wrong word (.+?)\. Correct word (.+?)\./g)];
  const sentences = (boundary ?? '')
    .split(/Proofreading:\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const count = Math.min(wrongCorrect.length, sentences.length);
  const pairs: ProofreadingPair[] = [];
  for (let i = 0; i < count; i++) {
    pairs.push({
      sentence: sentences[i],
      error: wrongCorrect[i][1],
      corrected: wrongCorrect[i][2],
    });
  }
  return pairs;
}

export function parseCurriculumTextSkill(
  row: Pick<GrammarMicroSkill, 'id' | 'measures' | 'boundary' | 'chapter_ref' | 'branch'>
): CurriculumTextSkill | null {
  if (row.branch === 'Picture' || row.id.includes('_im_')) return null;
  const placed = chapterUnitRank(row.chapter_ref);
  if (!placed) return null;
  const pairs = parsePairs(row.measures, row.boundary);
  if (pairs.length === 0) return null;
  return { id: row.id, year: placed.year, unitRank: placed.rank, pairs };
}

function shuffleQuestions(questions: LsProofreadingQuestion[], rng: () => number): void {
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
}

function byFoundation(a: CurriculumTextSkill, b: CurriculumTextSkill): number {
  return a.year - b.year || a.unitRank - b.unitRank || a.id.localeCompare(b.id);
}

function byLatest(a: CurriculumTextSkill, b: CurriculumTextSkill): number {
  return b.year - a.year || b.unitRank - a.unitRank || b.id.localeCompare(a.id);
}

export function composeConceptCheck(params: {
  skills: Array<Pick<GrammarMicroSkill, 'id' | 'measures' | 'boundary' | 'chapter_ref' | 'branch'>>;
  gradeKey: LearningSystemGradeKey;
  studentYear: number;
  isoDate: string;
  /** Zero-based set. Later visits continue the same draw. */
  setIndex?: number;
  rng?: () => number;
  /** Sentences from the Notion proofreading database. Skills with no rows use the skill list sentence. */
  questionBank?: ReadonlyMap<string, ProofreadingPair[]>;
}): ConceptCheckPlan {
  const progress = currentProgressUnit(params.gradeKey, params.isoDate);
  const inRange: CurriculumTextSkill[] = [];
  const gaps: string[] = [];

  for (const row of params.skills) {
    if (row.branch === 'Picture' || row.id.includes('_im_')) continue;
    const skill = parseCurriculumTextSkill(row);
    if (!skill) {
      gaps.push(`No proofreading sentence for ${row.id}.`);
      continue;
    }
    const priorYear = skill.year < params.studentYear;
    const taughtThisYear = progress != null && skill.year === params.studentYear && skill.unitRank <= progress.rank;
    if (priorYear || taughtThisYear) inRange.push(skill);
  }

  inRange.sort(byFoundation);
  const textCount = inRange.length;
  const targetCount = roundProofreadingCount(textCount);
  const dropCount = Math.max(0, textCount - targetCount);
  const dropped = inRange.slice(0, dropCount);
  const kept = inRange.slice(dropCount);
  const extraCount = Math.max(0, targetCount - kept.length);
  const sameGrade = kept.filter((skill) => skill.year === params.studentYear).sort(byLatest);
  const repeatPool = (sameGrade.length > 0 ? sameGrade : [...kept].sort(byLatest));
  const repeated: CurriculumTextSkill[] = [];
  for (let i = 0; i < extraCount; i++) {
    repeated.push(repeatPool[i % repeatPool.length]);
  }

  const rng = params.rng ?? Math.random;
  const questions: LsProofreadingQuestion[] = [];
  const seen = new Map<string, number>();
  for (const skill of [...kept, ...repeated]) {
    const copyIndex = seen.get(skill.id) ?? 0;
    seen.set(skill.id, copyIndex + 1);
    const fromDatabase = params.questionBank?.get(skill.id) ?? [];
    const bank = fromDatabase.length > 0 ? fromDatabase : expandProofreadingBank(skill.pairs);
    if (bank.length === 0) {
      gaps.push(`No single-error proofreading sentence for ${skill.id}.`);
      continue;
    }
    const draw = Math.floor(rng() * bank.length);
    const bankIndex = (draw + copyIndex) % bank.length;
    const pair = bank[bankIndex];
    const errorWordIndex = proofreadingWordIndex(pair.sentence, pair.error);
    if (errorWordIndex < 0) {
      gaps.push(`Error word "${pair.error}" is not in the sentence for ${skill.id}.`);
      continue;
    }
    questions.push({
      kind: 'proofreading',
      id: `concept:${skill.id}:b${bankIndex}:c${copyIndex}`,
      skillId: skill.id,
      yearLevel: skill.year,
      sentence: pair.sentence,
      error: pair.error,
      corrected: pair.corrected,
      errorWordIndex,
    });
  }

  shuffleQuestions(questions, rng);

  const setCount = Math.ceil(questions.length / CONCEPT_CHECK_SET_SIZE);
  const setIndex = params.setIndex ?? 0;
  const start = setIndex * CONCEPT_CHECK_SET_SIZE;
  return {
    questions: questions.slice(start, start + CONCEPT_CHECK_SET_SIZE),
    allQuestions: questions,
    gaps,
    textCount,
    targetCount,
    setIndex,
    setCount,
    droppedIds: dropped.map((skill) => skill.id),
    repeatedIds: repeated.map((skill) => skill.id),
  };
}
