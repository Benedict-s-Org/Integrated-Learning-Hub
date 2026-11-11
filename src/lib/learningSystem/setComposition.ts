import {
  filterByTaughtSkills,
  partitionByYear,
  type LsQuestionCandidate,
} from './eligibility';

export type LsSetMode = 'first_mix' | 'ordinary_review' | 'remediation' | 'concept_check';

export const LS_SET_SIZE = 10;
export const LS_FIRST_MIX_CURRENT = 6;
export const LS_FIRST_MIX_PRIOR = 4;
export const LS_REMEDIATION_FOCUS = 6;
export const LS_REMEDIATION_DUE_FILL = 4;

export interface SetCompositionResult {
  mode: LsSetMode;
  questions: LsQuestionCandidate[];
  /** Human-readable gaps when pool cannot fill the set without breaking rules */
  gaps: string[];
  ok: boolean;
}

function takeUnique(
  source: LsQuestionCandidate[],
  count: number,
  used: Set<string>
): LsQuestionCandidate[] {
  const out: LsQuestionCandidate[] = [];
  for (const q of source) {
    if (out.length >= count) break;
    if (used.has(q.id)) continue;
    used.add(q.id);
    out.push(q);
  }
  return out;
}

function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * First use / no weakness: 6 current-grade taught + 4 prior-grade taught.
 * Never fills gaps with untaught skills.
 */
export function composeFirstMixSet(params: {
  candidates: LsQuestionCandidate[];
  taughtSkillIds: ReadonlySet<string> | readonly string[];
  studentYearLevel: number;
  rng?: () => number;
}): SetCompositionResult {
  const eligible = filterByTaughtSkills(params.candidates, params.taughtSkillIds);
  const { currentGrade, priorGrade } = partitionByYear(eligible, params.studentYearLevel);
  const rng = params.rng ?? Math.random;
  const currentPool = shuffleInPlace([...currentGrade], rng);
  const priorPool = shuffleInPlace([...priorGrade], rng);
  const used = new Set<string>();
  const current = takeUnique(currentPool, LS_FIRST_MIX_CURRENT, used);
  const prior = takeUnique(priorPool, LS_FIRST_MIX_PRIOR, used);
  const gaps: string[] = [];
  if (current.length < LS_FIRST_MIX_CURRENT) {
    gaps.push(
      `Need ${LS_FIRST_MIX_CURRENT} current-grade (Y${params.studentYearLevel}) taught items; got ${current.length}.`
    );
  }
  if (prior.length < LS_FIRST_MIX_PRIOR) {
    gaps.push(
      `Need ${LS_FIRST_MIX_PRIOR} prior-grade taught items; got ${prior.length}.`
    );
  }
  const questions = [...current, ...prior];
  return {
    mode: 'first_mix',
    questions,
    gaps,
    ok: gaps.length === 0 && questions.length === LS_SET_SIZE,
  };
}

/**
 * Ordinary review: due items among taught-eligible only (up to 10).
 * Does not force six-same-skill remediation packing.
 */
export function composeOrdinaryReviewSet(params: {
  candidates: LsQuestionCandidate[];
  taughtSkillIds: ReadonlySet<string> | readonly string[];
  studentYearLevel: number;
  limit?: number;
  rng?: () => number;
}): SetCompositionResult {
  const limit = params.limit ?? LS_SET_SIZE;
  const eligible = filterByTaughtSkills(params.candidates, params.taughtSkillIds).filter(
    (q) => q.yearLevel <= params.studentYearLevel
  );
  const due = eligible.filter((q) => q.isDue);
  const rng = params.rng ?? Math.random;
  const pool = shuffleInPlace([...due], rng);
  const used = new Set<string>();
  const questions = takeUnique(pool, limit, used);
  const gaps: string[] = [];
  if (questions.length < limit) {
    gaps.push(
      `Need ${limit} due taught-eligible items; got ${questions.length}. Do not fill with untaught.`
    );
  }
  return {
    mode: 'ordinary_review',
    questions,
    gaps,
    ok: gaps.length === 0 && questions.length === limit,
  };
}

/**
 * Remediation: 6 same target skill + 4 due (other eligible), all taught.
 */
export function composeRemediationSet(params: {
  candidates: LsQuestionCandidate[];
  taughtSkillIds: ReadonlySet<string> | readonly string[];
  studentYearLevel: number;
  targetSkillId: string;
  rng?: () => number;
}): SetCompositionResult {
  const taught = new Set(
    params.taughtSkillIds instanceof Set
      ? params.taughtSkillIds
      : params.taughtSkillIds
  );
  const gaps: string[] = [];
  if (!taught.has(params.targetSkillId)) {
    return {
      mode: 'remediation',
      questions: [],
      gaps: [`Target skill ${params.targetSkillId} is not marked taught for this grade.`],
      ok: false,
    };
  }

  const eligible = filterByTaughtSkills(params.candidates, taught).filter(
    (q) => q.yearLevel <= params.studentYearLevel
  );
  const rng = params.rng ?? Math.random;
  const focusPool = shuffleInPlace(
    eligible.filter((q) => q.skillId === params.targetSkillId),
    rng
  );
  const dueOther = shuffleInPlace(
    eligible.filter((q) => q.skillId !== params.targetSkillId && q.isDue),
    rng
  );

  const used = new Set<string>();
  const focus = takeUnique(focusPool, LS_REMEDIATION_FOCUS, used);
  const fill = takeUnique(dueOther, LS_REMEDIATION_DUE_FILL, used);

  if (focus.length < LS_REMEDIATION_FOCUS) {
    gaps.push(
      `Need ${LS_REMEDIATION_FOCUS} items for skill ${params.targetSkillId}; got ${focus.length}.`
    );
  }
  if (fill.length < LS_REMEDIATION_DUE_FILL) {
    gaps.push(
      `Need ${LS_REMEDIATION_DUE_FILL} due fill items; got ${fill.length}.`
    );
  }

  const questions = [...focus, ...fill];
  return {
    mode: 'remediation',
    questions,
    gaps,
    ok: gaps.length === 0 && questions.length === LS_SET_SIZE,
  };
}
