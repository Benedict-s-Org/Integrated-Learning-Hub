/**
 * Persist Learning System attempts (DEC-20261102-11).
 * First pre-reveal answer → is_valid=true; post-reveal / retry → is_valid=false.
 */

import { supabase } from '@/integrations/supabase/client';

export interface RecordLsAttemptInput {
  userId: string;
  setId: string;
  skillId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  isValid: boolean;
  isRemediation: boolean;
  /** Seed scaffold items still count for validity when isValid=true */
  isDemonstration?: boolean;
  responseTimeMs?: number | null;
  channel?: 'srs' | 'proofreading';
  detectionCorrect?: boolean | null;
  correctionCorrect?: boolean | null;
}

export async function recordLearningSystemAttempt(
  input: RecordLsAttemptInput
): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('learning_system_attempts')
    .insert({
      user_id: input.userId,
      set_id: input.setId,
      channel: input.channel ?? 'srs',
      skill_id: input.skillId,
      notion_page_id: null,
      question_version: input.questionId,
      is_valid: input.isValid,
      is_remediation: input.isRemediation,
      is_demonstration: input.isDemonstration ?? false,
      selected_answer: input.selectedAnswer,
      is_correct: input.isCorrect,
      detection_correct: input.detectionCorrect ?? null,
      correction_correct: input.correctionCorrect ?? null,
      response_time_ms: input.responseTimeMs ?? null,
      metadata: { question_id: input.questionId },
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
