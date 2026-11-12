/** Learning System Phase 1 types. Grade keys match essay-marking PrimaryGrade. */

export type LearningSystemGradeKey = 'P.1' | 'P.2' | 'P.3' | 'P.4' | 'P.5' | 'P.6';

export type GrammarMicroSkillStatus = 'draft' | 'review' | 'active' | 'retired';

export interface GrammarMicroSkill {
  id: string;
  name: string;
  measures: string;
  boundary: string | null;
  chapter_ref: string | null;
  concept: string | null;
  branch: string | null;
  longman_refs: string[];
  example_stem: string | null;
  example_options: string[] | null;
  example_correct_index: number | null;
  variation_tags: string[];
  status: GrammarMicroSkillStatus;
  round1_in_scope: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GrammarSkillCurriculumLink {
  id: string;
  skill_id: string;
  stage_code: string;
  year_level: number;
  excel_learning_item: string;
  classification: string | null;
  notes: string | null;
}

export interface GradeTaughtChecklistRow {
  grade_key: LearningSystemGradeKey;
  skill_id: string;
  taught: boolean;
  taught_by: string | null;
  taught_at: string | null;
  updated_at: string;
}
