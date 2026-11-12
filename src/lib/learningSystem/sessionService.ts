/**
 * Learning System session builder: load eligibility context, compose a set, persist set row.
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchGradeTaughtChecklist } from './checklistService';
import {
  fetchNotionMicroSkills,
  fetchNotionProofreadingItems,
  fetchNotionSrsQuestions,
  groupProofreadingBank,
} from './notionCatalog';
import { hongKongDateIso } from './curriculumProgress';
import { gradeKeyToYearLevel } from './eligibility';
import { parseLearningSystemGradeKey } from './gradeKey';
import { selectLsSetMode } from './modeSelection';
import {
  composeConceptCheck,
  conceptCheckRng,
  type LsProofreadingQuestion,
} from './proofreadingConceptCheck';
import {
  composeFirstMixSet,
  composeOrdinaryReviewSet,
  composeRemediationSet,
  type LsSetMode,
  type SetCompositionResult,
} from './setComposition';
import { indexPracticeQuestions, type LsPracticeQuestion } from './seedQuestionBank';
import { evaluateSkillWeakness, pickRemediationTargetSkill } from './weakness';
import type { LearningSystemGradeKey } from './types';

export type LsSessionQuestion = LsPracticeQuestion | LsProofreadingQuestion;

export interface BuiltLsSession {
  setId: string;
  mode: LsSetMode;
  targetSkillId: string | null;
  gradeKey: LearningSystemGradeKey;
  composition: SetCompositionResult;
  questions: LsSessionQuestion[];
  /** Present while the first-visit proofreading sets are still running. */
  conceptProgress?: { setIndex: number; setCount: number };
}

/** Completed practice sets. The first-visit concept check does not count. */
export async function countCompletedLsSets(userId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('learning_system_sets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .in('mode', ['first_mix', 'ordinary_review', 'remediation']);
  if (error) throw error;
  return count ?? 0;
}

export async function countCompletedConceptChecks(userId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('learning_system_sets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('mode', 'concept_check');
  if (error) throw error;
  return count ?? 0;
}

export interface SkillStateFlagsRow {
  skillId: string;
  potentialWeakness: boolean;
  remediationPaused: boolean;
  teacherInterventionOpen: boolean;
  teacherPin: boolean;
}

export async function fetchSkillStateFlags(userId: string): Promise<{
  bySkill: Record<string, SkillStateFlagsRow>;
  pinnedSkillId: string | null;
  weaknessSkillIds: string[];
}> {
  const { data, error } = await (supabase as any)
    .from('learning_system_skill_states')
    .select(
      'skill_id, potential_weakness, remediation_paused, teacher_intervention_open, teacher_pin'
    )
    .eq('user_id', userId);
  if (error) throw error;

  const rows = (data || []) as Array<{
    skill_id: string;
    potential_weakness: boolean;
    remediation_paused: boolean;
    teacher_intervention_open: boolean;
    teacher_pin: boolean;
  }>;

  const bySkill: Record<string, SkillStateFlagsRow> = {};
  let pinnedSkillId: string | null = null;
  const weaknessSkillIds: string[] = [];

  for (const row of rows) {
    bySkill[row.skill_id] = {
      skillId: row.skill_id,
      potentialWeakness: row.potential_weakness,
      remediationPaused: row.remediation_paused,
      teacherInterventionOpen: row.teacher_intervention_open,
      teacherPin: row.teacher_pin,
    };
    if (row.teacher_pin) pinnedSkillId = row.skill_id;
    if (row.potential_weakness) weaknessSkillIds.push(row.skill_id);
  }

  return { bySkill, pinnedSkillId, weaknessSkillIds };
}

/** Valid ordinary attempts newest-last for weakness evaluation. */
export async function fetchValidOrdinaryAttempts(
  userId: string
): Promise<{ skillId: string; isCorrect: boolean; answeredAt: string }[]> {
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
    }));
}

function resolveRemediationTarget(params: {
  pinnedSkillId: string | null;
  weaknessSkillIds: string[];
  attempts: { skillId: string; isCorrect: boolean; answeredAt: string }[];
}): string | null {
  const skillIds = new Set<string>([
    ...params.weaknessSkillIds,
    ...params.attempts.map((a) => a.skillId),
  ]);
  if (params.pinnedSkillId) skillIds.add(params.pinnedSkillId);

  const snapshots = [...skillIds].map((skillId) =>
    evaluateSkillWeakness(params.attempts, skillId)
  );
  return pickRemediationTargetSkill({
    snapshots,
    pinnedSkillId: params.pinnedSkillId,
  });
}

/**
 * Compose and persist an in-progress Learning System set for the student.
 */
export async function startLearningSystemSession(params: {
  userId: string;
  className?: string | null;
  /** Staff override when student class is missing */
  gradeKeyOverride?: LearningSystemGradeKey | null;
  assignmentId?: string | null;
  rng?: () => number;
}): Promise<BuiltLsSession> {
  const gradeKey =
    params.gradeKeyOverride ?? parseLearningSystemGradeKey(params.className ?? null);
  if (!gradeKey) {
    throw new Error(
      'Could not derive grade from class name. Ask a teacher to set your class (e.g. 3A) or choose a grade.'
    );
  }

  const studentYearLevel = gradeKeyToYearLevel(gradeKey);
  if (studentYearLevel == null) {
    throw new Error(`Unsupported grade key: ${gradeKey}`);
  }

  if (!params.assignmentId) {
    const conceptChecksDone = await countCompletedConceptChecks(params.userId);
    const [curriculumSkills, proofreadingItems] = await Promise.all([
      fetchNotionMicroSkills(),
      fetchNotionProofreadingItems(),
    ]);
    const plan = composeConceptCheck({
      skills: curriculumSkills,
      gradeKey,
      studentYear: studentYearLevel,
      isoDate: hongKongDateIso(),
      setIndex: conceptChecksDone,
      rng: conceptCheckRng(params.userId),
      questionBank: groupProofreadingBank(proofreadingItems),
    });
    if (conceptChecksDone < plan.setCount) {
      if (plan.questions.length === 0) {
        throw new Error(
          plan.gaps[0] ||
            'No proofreading items are available for the units taught so far.'
        );
      }
      const { data: setRow, error: setError } = await (supabase as any)
        .from('learning_system_sets')
        .insert({
          user_id: params.userId,
          mode: 'concept_check',
          target_skill_id: null,
          grade_key: gradeKey,
          question_count: plan.questions.length,
          status: 'in_progress',
          assignment_id: null,
        })
        .select('id')
        .single();
      if (setError) throw setError;
      return {
        setId: setRow.id as string,
        mode: 'concept_check',
        targetSkillId: null,
        gradeKey,
        composition: {
          mode: 'concept_check',
          questions: plan.questions.map((q) => ({
            id: q.id,
            skillId: q.skillId,
            yearLevel: q.yearLevel,
          })),
          gaps: plan.gaps,
          ok: plan.gaps.length === 0 && plan.questions.length > 0,
        },
        questions: plan.questions,
        conceptProgress: { setIndex: plan.setIndex, setCount: plan.setCount },
      };
    }
  }

  const [pool, checklist, completedSetCount, stateFlags, attempts] = await Promise.all([
    fetchNotionSrsQuestions(),
    fetchGradeTaughtChecklist(gradeKey),
    countCompletedLsSets(params.userId),
    fetchSkillStateFlags(params.userId),
    fetchValidOrdinaryAttempts(params.userId),
  ]);

  const taughtSkillIds = checklist.filter((r) => r.taught).map((r) => r.skill_id);
  if (taughtSkillIds.length === 0) {
    throw new Error(
      `No skills are marked taught for ${gradeKey}. A teacher must update the taught checklist first.`
    );
  }

  const byId = indexPracticeQuestions(pool);

  const remediationTargetSkillId = resolveRemediationTarget({
    pinnedSkillId: stateFlags.pinnedSkillId,
    weaknessSkillIds: stateFlags.weaknessSkillIds,
    attempts,
  });

  // Prefer pin; else weakness target that still evaluates as potential weakness
  let targetForMode: string | null = stateFlags.pinnedSkillId;
  if (
    !targetForMode &&
    remediationTargetSkillId &&
    (stateFlags.bySkill[remediationTargetSkillId]?.potentialWeakness ||
      evaluateSkillWeakness(attempts, remediationTargetSkillId).isPotentialWeakness)
  ) {
    targetForMode = remediationTargetSkillId;
  }

  // Pause / intervention are per-skill (DEC-20261102-17)
  const targetFlags = targetForMode ? stateFlags.bySkill[targetForMode] : undefined;
  const modePick = selectLsSetMode({
    completedSetCount,
    remediationTargetSkillId: targetForMode,
    remediationPaused: targetFlags?.remediationPaused ?? false,
    teacherInterventionOpen: targetFlags?.teacherInterventionOpen ?? false,
  });

  const composeArgs = {
    candidates: pool,
    taughtSkillIds,
    studentYearLevel,
    rng: params.rng,
  };

  let composition: SetCompositionResult;
  if (modePick.mode === 'remediation' && modePick.targetSkillId) {
    composition = composeRemediationSet({
      ...composeArgs,
      targetSkillId: modePick.targetSkillId,
    });
  } else if (modePick.mode === 'first_mix') {
    composition = composeFirstMixSet(composeArgs);
  } else {
    composition = composeOrdinaryReviewSet(composeArgs);
  }

  const questions = composition.questions
    .map((c) => byId.get(c.id))
    .filter((q): q is LsPracticeQuestion => Boolean(q));

  const { data: setRow, error: setError } = await (supabase as any)
    .from('learning_system_sets')
    .insert({
      user_id: params.userId,
      mode: composition.mode,
      target_skill_id: modePick.targetSkillId,
      grade_key: gradeKey,
      question_count: questions.length,
      status: 'in_progress',
      assignment_id: params.assignmentId ?? null,
    })
    .select('id')
    .single();

  if (setError) throw setError;

  return {
    setId: setRow.id as string,
    mode: composition.mode,
    targetSkillId: modePick.targetSkillId,
    gradeKey,
    composition,
    questions,
  };
}

export async function completeLearningSystemSet(setId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('learning_system_sets')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', setId);
  if (error) throw error;
}
