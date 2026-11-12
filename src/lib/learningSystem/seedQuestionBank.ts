/**
 * Temporary MCQ pool from Phase 1 seed skill examples (Notion banks deferred).
 * Expands each skill × curriculum year × variants so compose rules can fill size-10 sets.
 */

import type { GrammarMicroSkill } from './types';
import type { LsQuestionCandidate } from './eligibility';

/** Variants per skill+year so remediation (6 same skill) can pack without Notion. */
export const SEED_VARIANTS_PER_YEAR = 6;

export interface LsPracticeQuestion extends LsQuestionCandidate {
  stem: string;
  options: string[];
  correctIndex: number;
  /** True only for the temporary repeated example. Notion SRS rows are false. */
  isSeedScaffold: boolean;
}

export interface CurriculumYearLink {
  skill_id: string;
  year_level: number;
}

/**
 * Build a practiceable candidate pool from active skills + curriculum year links.
 * Skills without stem/options are skipped. Untaught filtering happens at compose time.
 */
export function buildSeedQuestionPool(params: {
  skills: GrammarMicroSkill[];
  yearLinks: CurriculumYearLink[];
  /** When true (default), every item is due — SM-2 bridge later */
  markAllDue?: boolean;
  variantsPerYear?: number;
}): LsPracticeQuestion[] {
  const variants = params.variantsPerYear ?? SEED_VARIANTS_PER_YEAR;
  const markAllDue = params.markAllDue !== false;
  const yearsBySkill = new Map<string, number[]>();

  for (const link of params.yearLinks) {
    const list = yearsBySkill.get(link.skill_id) ?? [];
    if (!list.includes(link.year_level)) list.push(link.year_level);
    yearsBySkill.set(link.skill_id, list);
  }

  const out: LsPracticeQuestion[] = [];

  for (const skill of params.skills) {
    if (!skill.example_stem || !skill.example_options?.length) continue;
    if (skill.example_correct_index == null) continue;
    if (skill.example_correct_index < 0 || skill.example_correct_index >= skill.example_options.length) {
      continue;
    }

    const years = yearsBySkill.get(skill.id);
    const yearLevels = years && years.length > 0 ? years : [2]; // fallback P.2 placement

    for (const yearLevel of yearLevels) {
      for (let v = 0; v < variants; v++) {
        out.push({
          id: `seed:${skill.id}:y${yearLevel}:v${v}`,
          skillId: skill.id,
          yearLevel,
          isDue: markAllDue,
          stem: skill.example_stem,
          options: [...skill.example_options],
          correctIndex: skill.example_correct_index,
          isSeedScaffold: true,
        });
      }
    }
  }

  return out;
}

export function indexPracticeQuestions(
  questions: LsPracticeQuestion[]
): Map<string, LsPracticeQuestion> {
  return new Map(questions.map((q) => [q.id, q]));
}
