/** Taught-checklist eligibility for Learning System question pools. */

export interface LsQuestionCandidate {
  id: string;
  skillId: string;
  /** Primary curriculum year (1–6) this item counts as for mix rules */
  yearLevel: number;
  /** Due under SM-2 / schedule for ordinary + remediation fill */
  isDue?: boolean;
}

export function gradeKeyToYearLevel(gradeKey: string): number | null {
  const m = gradeKey.trim().match(/^P\.?([1-6])$/i);
  return m ? Number(m[1]) : null;
}

/**
 * Only questions whose skill is on the grade taught checklist may be served.
 * Untaught skills never appear — even if due.
 */
export function filterByTaughtSkills(
  candidates: LsQuestionCandidate[],
  taughtSkillIds: ReadonlySet<string> | readonly string[]
): LsQuestionCandidate[] {
  const taught = taughtSkillIds instanceof Set ? taughtSkillIds : new Set(taughtSkillIds);
  return candidates.filter((q) => taught.has(q.skillId));
}

export function partitionByYear(
  candidates: LsQuestionCandidate[],
  studentYearLevel: number
): { currentGrade: LsQuestionCandidate[]; priorGrade: LsQuestionCandidate[] } {
  const currentGrade: LsQuestionCandidate[] = [];
  const priorGrade: LsQuestionCandidate[] = [];
  for (const q of candidates) {
    if (q.yearLevel === studentYearLevel) currentGrade.push(q);
    else if (q.yearLevel < studentYearLevel) priorGrade.push(q);
    // yearLevel > studentYear: out of scope for this student (future content)
  }
  return { currentGrade, priorGrade };
}
