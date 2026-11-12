import { supabase } from '@/integrations/supabase/client';
import type { GradeTaughtChecklistRow, LearningSystemGradeKey } from './types';

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
