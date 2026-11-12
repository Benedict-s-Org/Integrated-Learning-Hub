import { supabase } from '@/integrations/supabase/client';
import { fetchNotionMicroSkills } from './notionCatalog';
import type { LearningSystemGradeKey } from './types';

export async function assignLearningSystemPractice(params: {
  studentIds: string[];
  assignedBy: string;
  title: string;
  gradeKey: LearningSystemGradeKey | null;
  dueDate: string | null;
  rewardCoins?: number;
  notes?: string | null;
}): Promise<{ inserted: number }> {
  if (params.studentIds.length === 0) {
    throw new Error('Select at least one student.');
  }

  const rows = params.studentIds.map((userId) => ({
    user_id: userId,
    assigned_by: params.assignedBy,
    title: params.title.trim() || 'Learning System practice',
    grade_key: params.gradeKey,
    due_date: params.dueDate,
    reward_coins: params.rewardCoins ?? 5,
    notes: params.notes ?? null,
    completed: false,
  }));

  const { data, error } = await (supabase as any)
    .from('learning_system_assignments')
    .insert(rows)
    .select('id');

  if (error) throw error;
  return { inserted: (data || []).length };
}

export async function markLearningSystemAssignmentComplete(
  assignmentId: string
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('mark_assignment_complete', {
    p_assignment_id: assignmentId,
    p_assignment_type: 'learning_system',
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchStudentsForAssignment(): Promise<
  { id: string; display_name: string | null; username: string; class: string | null }[]
> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, username, class, role')
    .order('display_name');
  if (error) throw error;
  return ((data || []) as any[])
    .filter((u) => !u.role || u.role === 'user')
    .map((u) => ({
      id: u.id,
      display_name: u.display_name,
      username: u.username,
      class: u.class ?? null,
    }));
}

/** Post-set tips for missed skills (DEC-20261102-19) — not shown during scored answering. */
export async function fetchTipsForMissedSkills(
  skillIds: string[]
): Promise<{ skillId: string; name: string; tip: string }[]> {
  const unique = [...new Set(skillIds)];
  if (unique.length === 0) return [];

  const wanted = new Set(unique);
  const skills = await fetchNotionMicroSkills();
  return skills
    .filter((skill) => wanted.has(skill.id))
    .map((skill) => ({
      skillId: skill.id,
      name: skill.name,
      tip: skill.measures + (skill.boundary ? ` Boundary: ${skill.boundary}` : ''),
    }));
}
