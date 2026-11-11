import { supabase } from '@/integrations/supabase/client';
import type { GrammarMicroSkill, GradeTaughtChecklistRow, LearningSystemGradeKey } from './types';

/** School-list rows, including drafts. The taught checklist still loads active rows only. */
export async function fetchSchoolCurriculumSkills(): Promise<GrammarMicroSkill[]> {
  const { data, error } = await (supabase as any)
    .from('grammar_micro_skills')
    .select('*')
    .like('id', 'p%')
    .neq('status', 'retired')
    .order('id', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeSkill);
}

export async function fetchActiveGrammarSkills(): Promise<GrammarMicroSkill[]> {
  const { data, error } = await (supabase as any)
    .from('grammar_micro_skills')
    .select('*')
    .eq('status', 'active')
    .order('chapter_ref', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeSkill);
}

export async function fetchGradeTaughtChecklist(
  gradeKey: LearningSystemGradeKey
): Promise<GradeTaughtChecklistRow[]> {
  const { data, error } = await (supabase as any)
    .from('grade_taught_checklists')
    .select('*')
    .eq('grade_key', gradeKey);

  if (error) throw error;
  return (data || []) as GradeTaughtChecklistRow[];
}

export async function setSkillTaught(params: {
  gradeKey: LearningSystemGradeKey;
  skillId: string;
  taught: boolean;
  userId: string;
}): Promise<void> {
  const payload = {
    grade_key: params.gradeKey,
    skill_id: params.skillId,
    taught: params.taught,
    taught_by: params.taught ? params.userId : null,
    taught_at: params.taught ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (supabase as any)
    .from('grade_taught_checklists')
    .upsert(payload, { onConflict: 'grade_key,skill_id' });

  if (error) throw error;
}

function normalizeSkill(row: any): GrammarMicroSkill {
  return {
    id: row.id,
    name: row.name,
    measures: row.measures,
    boundary: row.boundary ?? null,
    chapter_ref: row.chapter_ref ?? null,
    concept: row.concept ?? null,
    branch: row.branch ?? null,
    longman_refs: Array.isArray(row.longman_refs) ? row.longman_refs : [],
    example_stem: row.example_stem ?? null,
    example_options: Array.isArray(row.example_options) ? row.example_options : null,
    example_correct_index: row.example_correct_index ?? null,
    variation_tags: Array.isArray(row.variation_tags) ? row.variation_tags : [],
    status: row.status,
    round1_in_scope: Boolean(row.round1_in_scope),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
