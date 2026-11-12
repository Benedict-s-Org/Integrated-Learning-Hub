/**
 * Persist Learning System skill states + interventions after sets / teacher follow-up.
 */

import { supabase } from '@/integrations/supabase/client';
import { REMEDIATION_FOCUS_SIZE } from './remediation';
import type { LsSetMode } from './setComposition';
import {
  applyOrdinarySetToSkillStates,
  applyRemediationPin,
  applyRemediationSetOutcome,
  applyTeacherFollowedUp,
  countRemediationFocusCorrect,
  emptySkillState,
  type LsSkillState,
} from './skillStateTransitions';
import type { ValidSkillAttempt } from './weakness';

function rowToState(row: {
  skill_id: string;
  potential_weakness: boolean;
  remediation_loop: number;
  remediation_paused: boolean;
  teacher_intervention_open: boolean;
  ordinary_since_pass: number;
  teacher_pin: boolean;
}): LsSkillState {
  return {
    skillId: row.skill_id,
    potentialWeakness: row.potential_weakness,
    remediationLoop: row.remediation_loop,
    remediationPaused: row.remediation_paused,
    teacherInterventionOpen: row.teacher_intervention_open,
    ordinarySincePass: row.ordinary_since_pass,
    teacherPin: row.teacher_pin,
  };
}

export async function fetchSkillStatesMap(
  userId: string
): Promise<Record<string, LsSkillState>> {
  const { data, error } = await (supabase as any)
    .from('learning_system_skill_states')
    .select(
      'skill_id, potential_weakness, remediation_loop, remediation_paused, teacher_intervention_open, ordinary_since_pass, teacher_pin'
    )
    .eq('user_id', userId);
  if (error) throw error;
  const map: Record<string, LsSkillState> = {};
  for (const row of data || []) {
    const s = rowToState(row);
    map[s.skillId] = s;
  }
  return map;
}

async function upsertSkillState(userId: string, state: LsSkillState): Promise<void> {
  const { error } = await (supabase as any).from('learning_system_skill_states').upsert(
    {
      user_id: userId,
      skill_id: state.skillId,
      potential_weakness: state.potentialWeakness,
      remediation_loop: state.remediationLoop,
      remediation_paused: state.remediationPaused,
      teacher_intervention_open: state.teacherInterventionOpen,
      ordinary_since_pass: state.ordinarySincePass,
      teacher_pin: state.teacherPin,
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,skill_id' }
  );
  if (error) throw error;
}

/** Pin one skill for the next remediation set, or clear the pin. Staff-only in the UI. */
export async function setTeacherRemediationPin(params: {
  studentUserId: string;
  skillId: string | null;
}): Promise<void> {
  const states = await fetchSkillStatesMap(params.studentUserId);
  const changed = applyRemediationPin({ states, skillId: params.skillId });
  for (const state of changed) {
    await upsertSkillState(params.studentUserId, state);
  }
}

/**
 * Open intervention once per episode. If an open row exists, do not insert another
 * and do not bump notify_sent_at (DEC-20261102-17 notify once).
 */
export async function ensureInterventionOpen(params: {
  userId: string;
  skillId: string;
}): Promise<{ created: boolean }> {
  const { data: existing, error: findErr } = await (supabase as any)
    .from('learning_system_interventions')
    .select('id, notify_sent_at')
    .eq('user_id', params.userId)
    .eq('skill_id', params.skillId)
    .eq('status', 'open')
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) {
    if (!existing.notify_sent_at) {
      await (supabase as any)
        .from('learning_system_interventions')
        .update({ notify_sent_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return { created: false };
  }

  const { error } = await (supabase as any).from('learning_system_interventions').insert({
    user_id: params.userId,
    skill_id: params.skillId,
    status: 'open',
    notify_sent_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { created: true };
}

export async function fetchValidOrdinaryAttemptsNewestLast(
  userId: string
): Promise<ValidSkillAttempt[]> {
  const { data, error } = await (supabase as any)
    .from('learning_system_attempts')
    .select('skill_id, is_correct, answered_at, is_valid, is_remediation, is_demonstration')
    .eq('user_id', userId)
    .eq('channel', 'srs')
    .eq('is_valid', true)
    .eq('is_remediation', false)
    .eq('is_demonstration', false)
    .order('answered_at', { ascending: true });
  if (error) throw error;
  return ((data || []) as Array<{
    skill_id: string | null;
    is_correct: boolean | null;
    answered_at: string;
  }>)
    .filter((r) => r.skill_id && r.is_correct != null)
    .map((r) => ({
      skillId: r.skill_id as string,
      isCorrect: Boolean(r.is_correct),
      answeredAt: r.answered_at,
      isValid: true,
      isRemediation: false,
    }));
}

export interface FinalizeSetInput {
  userId: string;
  setId: string;
  mode: LsSetMode;
  targetSkillId: string | null;
  /** Valid first answers in set order */
  orderedResults: { skillId: string; correct: boolean }[];
}

export interface FinalizeSetResult {
  remediationOutcome?: RemediationLoopOutcomeLabel;
}

export type RemediationLoopOutcomeLabel = 'pass' | 'fail_continue' | 'fail_intervene';

/**
 * Mark set completed and apply skill-state transitions.
 */
export async function finalizeLearningSystemSet(
  input: FinalizeSetInput
): Promise<FinalizeSetResult> {
  const { error: setErr } = await (supabase as any)
    .from('learning_system_sets')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.setId);
  if (setErr) throw setErr;

  // Concept check is a one-time map. It does not arm weakness or remediation.
  if (input.mode === 'concept_check') {
    return {};
  }

  const states = await fetchSkillStatesMap(input.userId);
  const out: FinalizeSetResult = {};

  if (input.mode === 'remediation' && input.targetSkillId) {
    const prev = states[input.targetSkillId] ?? emptySkillState(input.targetSkillId);
    const focusCorrect = countRemediationFocusCorrect({
      orderedResults: input.orderedResults,
      targetSkillId: input.targetSkillId,
      focusSize: REMEDIATION_FOCUS_SIZE,
    });
    const applied = applyRemediationSetOutcome({
      state: prev,
      focusCorrectCount: focusCorrect,
    });
    await upsertSkillState(input.userId, applied.state);
    out.remediationOutcome = applied.outcome;
    if (applied.openIntervention) {
      await ensureInterventionOpen({
        userId: input.userId,
        skillId: input.targetSkillId,
      });
    }
    return out;
  }

  // first_mix / ordinary_review
  const ordinaryValidCountBySkill: Record<string, number> = {};
  for (const r of input.orderedResults) {
    ordinaryValidCountBySkill[r.skillId] = (ordinaryValidCountBySkill[r.skillId] ?? 0) + 1;
  }
  const attempts = await fetchValidOrdinaryAttemptsNewestLast(input.userId);
  const nextStates = applyOrdinarySetToSkillStates({
    states,
    ordinaryValidCountBySkill,
    allAttemptsNewestLast: attempts,
  });

  const changedIds = new Set([
    ...Object.keys(ordinaryValidCountBySkill),
    ...Object.keys(states),
  ]);
  for (const skillId of changedIds) {
    const s = nextStates[skillId];
    if (!s) continue;
    const prev = states[skillId];
    if (
      prev &&
      prev.potentialWeakness === s.potentialWeakness &&
      prev.ordinarySincePass === s.ordinarySincePass &&
      prev.remediationLoop === s.remediationLoop &&
      prev.remediationPaused === s.remediationPaused &&
      prev.teacherInterventionOpen === s.teacherInterventionOpen
    ) {
      continue;
    }
    await upsertSkillState(input.userId, s);
  }

  return out;
}

export interface OpenInterventionRow {
  id: string;
  user_id: string;
  skill_id: string;
  opened_at: string;
  notify_sent_at: string | null;
  status: string;
  student_name?: string;
  skill_name?: string;
}

export async function listOpenInterventions(): Promise<OpenInterventionRow[]> {
  const { data, error } = await (supabase as any)
    .from('learning_system_interventions')
    .select('id, user_id, skill_id, opened_at, notify_sent_at, status')
    .eq('status', 'open')
    .order('opened_at', { ascending: false });
  if (error) throw error;
  const rows = (data || []) as OpenInterventionRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const skillIds = [...new Set(rows.map((r) => r.skill_id))];

  const [{ data: users }, { data: skills }] = await Promise.all([
    (supabase as any).from('users').select('id, display_name, username').in('id', userIds),
    (supabase as any).from('grammar_micro_skills').select('id, name').in('id', skillIds),
  ]);

  const userMap = new Map(
    ((users || []) as { id: string; display_name: string | null; username: string }[]).map(
      (u) => [u.id, u.display_name || u.username || u.id]
    )
  );
  const skillMap = new Map(
    ((skills || []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
  );

  return rows.map((r) => ({
    ...r,
    student_name: userMap.get(r.user_id),
    skill_name: skillMap.get(r.skill_id),
  }));
}

/**
 * Teacher followed up — unlock dense remediation for that student/skill.
 */
export async function markTeacherFollowedUp(params: {
  interventionId: string;
  teacherUserId: string;
}): Promise<void> {
  const { data: row, error: findErr } = await (supabase as any)
    .from('learning_system_interventions')
    .select('id, user_id, skill_id, status')
    .eq('id', params.interventionId)
    .single();
  if (findErr) throw findErr;
  if (!row || row.status !== 'open') {
    throw new Error('Intervention is not open.');
  }

  const states = await fetchSkillStatesMap(row.user_id);
  const prev = states[row.skill_id] ?? emptySkillState(row.skill_id);
  const next = applyTeacherFollowedUp(prev);
  await upsertSkillState(row.user_id, next);

  const { error } = await (supabase as any)
    .from('learning_system_interventions')
    .update({
      status: 'followed_up',
      followed_up_at: new Date().toISOString(),
      followed_up_by: params.teacherUserId,
    })
    .eq('id', params.interventionId);
  if (error) throw error;
}
