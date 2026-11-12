/**
 * Load valid Learning System SRS attempts for charts.
 * Proofreading rows are excluded.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  buildSkillLinePoints,
  buildTwoSetBars,
  type ChartAttempt,
  type LineBatchPoint,
  type TwoSetBar,
} from './charts';

export interface LsSkillLineSeries {
  skillId: string;
  name: string;
  points: LineBatchPoint[];
  pendingInBatch: number;
}

export interface LsChartModel {
  series: LsSkillLineSeries[];
  bars: TwoSetBar[];
  /** The 20 attempts behind each bar, same order as `bars`. */
  barWindows: ChartAttempt[][];
  latestSet: { correct: number; total: number } | null;
}

export interface LsTeacherSkillFlag {
  skillId: string;
  name: string;
  potentialWeakness: boolean;
  remediationLoop: number;
  remediationPaused: boolean;
  teacherInterventionOpen: boolean;
  teacherPin: boolean;
}

export async function loadLearningSystemChartModel(userId: string): Promise<LsChartModel> {
  const { data, error } = await (supabase as any)
    .from('learning_system_attempts')
    .select('skill_id, is_correct, answered_at, set_id, channel, is_valid, is_demonstration')
    .eq('user_id', userId)
    .eq('channel', 'srs')
    .eq('is_valid', true)
    .eq('is_demonstration', false)
    .order('answered_at', { ascending: true });
  if (error) throw error;

  const rows = ((data || []) as Array<{
    skill_id: string | null;
    is_correct: boolean | null;
    answered_at: string;
    set_id: string | null;
  }>).filter((r) => r.skill_id && r.is_correct != null);

  const skillIds = [...new Set(rows.map((r) => r.skill_id as string))];
  const names = await fetchSkillNames(skillIds);

  const bySkill = new Map<string, ChartAttempt[]>();
  const setsInOrder: { id: string; attempts: ChartAttempt[] }[] = [];
  const setIndex = new Map<string, number>();

  for (const row of rows) {
    const attempt: ChartAttempt = {
      skillId: row.skill_id as string,
      isCorrect: Boolean(row.is_correct),
      answeredAt: row.answered_at,
    };
    const list = bySkill.get(attempt.skillId) ?? [];
    list.push(attempt);
    bySkill.set(attempt.skillId, list);

    if (!row.set_id) continue;
    let idx = setIndex.get(row.set_id);
    if (idx == null) {
      idx = setsInOrder.length;
      setIndex.set(row.set_id, idx);
      setsInOrder.push({ id: row.set_id, attempts: [] });
    }
    setsInOrder[idx].attempts.push(attempt);
  }

  const series: LsSkillLineSeries[] = [...bySkill.entries()]
    .map(([skillId, attempts]) => {
      const built = buildSkillLinePoints(attempts);
      return {
        skillId,
        name: names[skillId] || skillId,
        points: built.points,
        pendingInBatch: built.pendingInBatch,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const setGroups = setsInOrder.map((s) => s.attempts);
  const bars = buildTwoSetBars(setGroups);
  const barWindows: ChartAttempt[][] = [];
  const pairCount = Math.floor(setGroups.filter((s) => s.length > 0).length / 2);
  const completed = setGroups.filter((s) => s.length > 0);
  for (let i = 0; i < pairCount; i++) {
    barWindows.push([...completed[i * 2], ...completed[i * 2 + 1]]);
  }

  const last = setsInOrder[setsInOrder.length - 1];
  const latestSet = last
    ? {
        correct: last.attempts.filter((a) => a.isCorrect).length,
        total: last.attempts.length,
      }
    : null;

  return { series, bars, barWindows, latestSet };
}

export async function loadTeacherSkillFlags(userId: string): Promise<LsTeacherSkillFlag[]> {
  const { data, error } = await (supabase as any)
    .from('learning_system_skill_states')
    .select(
      'skill_id, potential_weakness, remediation_loop, remediation_paused, teacher_intervention_open, teacher_pin'
    )
    .eq('user_id', userId);
  if (error) throw error;
  const rows = (data || []) as Array<{
    skill_id: string;
    potential_weakness: boolean;
    remediation_loop: number;
    remediation_paused: boolean;
    teacher_intervention_open: boolean;
    teacher_pin: boolean;
  }>;
  const names = await fetchSkillNames(rows.map((r) => r.skill_id));
  return rows
    .map((r) => ({
      skillId: r.skill_id,
      name: names[r.skill_id] || r.skill_id,
      potentialWeakness: r.potential_weakness,
      remediationLoop: r.remediation_loop,
      remediationPaused: r.remediation_paused,
      teacherInterventionOpen: r.teacher_intervention_open,
      teacherPin: r.teacher_pin,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchSkillNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await (supabase as any)
    .from('grammar_micro_skills')
    .select('id, name')
    .in('id', ids);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data || []) as { id: string; name: string }[]) {
    map[row.id] = row.name;
  }
  return map;
}
