// ============================================================
// Assessment Service — Supabase Data Layer
// ============================================================
// Handles all Supabase CRUD operations for the Handwriting
// Assessment System. Manages sessions, results, and storage.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import {
  AssessmentSession,
  SessionStatus,
  GripResult,
  PressureResult,
  HandwritingResult,
  FullAssessmentResult,
  DbSessionRow,
} from '@/components/assessment/shared/types';

// Table name constant — cast via `as any` since assessment_sessions
// is not in the auto-generated Supabase types yet
const TABLE = 'assessment_sessions' as any;
const STORAGE_BUCKET = 'assessment-snapshots';

// ─── Row ↔ Model Mapping ────────────────────────────────────

/** Convert a raw DB row (snake_case) to an AssessmentSession (camelCase) */
export function mapRowToSession(row: DbSessionRow): AssessmentSession {
  return {
    id: row.id,
    studentName: row.student_name,
    sessionCode: row.session_code,
    status: row.status as SessionStatus,
    writingPrompt: row.writing_prompt ?? undefined,
    createdAt: row.created_at,
    gripCompletedAt: row.grip_completed_at ?? undefined,
    writingCompletedAt: row.writing_completed_at ?? undefined,
    analysisCompletedAt: row.analysis_completed_at ?? undefined,
  };
}

/** Build a FullAssessmentResult from a complete DB row */
export function mapRowToFullResult(row: DbSessionRow): FullAssessmentResult {
  const gripResult: GripResult | null =
    row.grip_type != null
      ? {
          gripType: row.grip_type as any,
          confidence: row.grip_confidence ?? 0,
          thumbPosition: row.grip_thumb_position
            ? JSON.parse(row.grip_thumb_position)
            : { angle: 0, isWrapped: false, label: 'Unknown' },
          fingerFlexion: { index: 0, middle: 0, ring: 0, pinky: 0 },
          snapshotUrl: row.grip_snapshot_url ?? undefined,
          analyzedAt: row.grip_completed_at ?? new Date().toISOString(),
        }
      : null;

  const pressureResult: PressureResult | null =
    row.avg_pressure != null
      ? {
          avgPressure: row.avg_pressure,
          maxPressure: row.max_pressure ?? 0,
          pressureVariance: row.pressure_variance ?? 0,
          fatigueIndex: row.fatigue_index ?? 1.0,
          pressureZone: (row.pressure_zone as any) ?? 'MODERATE',
          rawData: Array.isArray(row.pressure_data) ? (row.pressure_data as any[]) : [],
        }
      : null;

  const handwritingResult: HandwritingResult | null =
    row.letter_clarity != null
      ? {
          letterClarity: row.letter_clarity,
          sizeConsistency: row.size_consistency ?? 0,
          lineAdherence: row.line_adherence ?? 0,
          letterFormation: row.letter_formation ?? 0,
          spacing: row.spacing ?? 0,
          problemLetters: Array.isArray(row.problem_letters) ? (row.problem_letters as string[]) : [],
          suggestions: row.ai_suggestions ? [row.ai_suggestions] : [],
          analyzedAt: row.analysis_completed_at ?? new Date().toISOString(),
        }
      : null;

  const createdAt = new Date(row.created_at);
  const lastTimestamp = row.analysis_completed_at ?? row.writing_completed_at ?? row.grip_completed_at ?? row.created_at;
  const durationSeconds = Math.round((new Date(lastTimestamp).getTime() - createdAt.getTime()) / 1000);

  return {
    sessionId: row.id,
    studentName: row.student_name,
    gripResult,
    pressureResult,
    handwritingResult,
    metadata: {
      totalDurationSeconds: Math.max(0, durationSeconds),
      writingPrompt: row.writing_prompt ?? '',
      reportGeneratedAt: new Date().toISOString(),
    },
  };
}

// ─── Session Management ──────────────────────────────────────

/**
 * Create a new assessment session.
 * Calls the DB function `generate_session_code()` for a unique 6-digit code.
 */
export async function createSession(
  studentName: string
): Promise<AssessmentSession> {
  // 1. Generate a unique session code via the DB function
  const { data: codeData, error: codeError } = await supabase.rpc(
    'generate_session_code' as any
  );

  if (codeError) {
    throw new Error(`Failed to generate session code: ${codeError.message}`);
  }

  const sessionCode = codeData as string;

  // 2. Insert the session row
  const { data, error } = await (supabase
    .from(TABLE)
    .insert({
      session_code: sessionCode,
      student_name: studentName,
      status: SessionStatus.IN_PROGRESS,
    })
    .select()
    .single() as any);

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return mapRowToSession(data as DbSessionRow);
}

/**
 * Look up a session by its 6-digit pairing code.
 * Only returns active (non-complete) sessions.
 */
export async function findSessionByCode(
  code: string
): Promise<AssessmentSession | null> {
  const { data, error } = await (supabase
    .from(TABLE)
    .select('*')
    .eq('session_code', code.trim())
    .neq('status', SessionStatus.COMPLETE)
    .maybeSingle() as any);

  if (error) {
    throw new Error(`Failed to find session: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToSession(data as DbSessionRow);
}

/**
 * Fetch a single session by UUID.
 */
export async function getSession(
  sessionId: string
): Promise<AssessmentSession | null> {
  const { data, error } = await (supabase
    .from(TABLE)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle() as any);

  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToSession(data as DbSessionRow);
}

/**
 * Update the status of a session.
 * This triggers Realtime updates to the paired device.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
): Promise<void> {
  const { error } = await (supabase
    .from(TABLE)
    .update({ status })
    .eq('id', sessionId) as any);

  if (error) {
    throw new Error(`Failed to update session status: ${error.message}`);
  }
}

// ─── Result Updates ──────────────────────────────────────────

/**
 * Store grip analysis results into the session row.
 * Sets grip columns + grip_completed_at + status → grip_done.
 */
export async function updateGripResult(
  sessionId: string,
  result: GripResult
): Promise<void> {
  const { error } = await (supabase
    .from(TABLE)
    .update({
      grip_type: result.gripType,
      grip_confidence: result.confidence,
      grip_snapshot_url: result.snapshotUrl ?? null,
      grip_thumb_position: JSON.stringify(result.thumbPosition),
      grip_completed_at: new Date().toISOString(),
      status: SessionStatus.GRIP_DONE,
    })
    .eq('id', sessionId) as any);

  if (error) {
    throw new Error(`Failed to update grip result: ${error.message}`);
  }
}

/**
 * Store pressure analysis results into the session row.
 * Sets pressure columns + writing_completed_at + status → writing_done.
 */
export async function updatePressureResult(
  sessionId: string,
  result: PressureResult
): Promise<void> {
  const { error } = await (supabase
    .from(TABLE)
    .update({
      avg_pressure: result.avgPressure,
      max_pressure: result.maxPressure,
      pressure_variance: result.pressureVariance,
      fatigue_index: result.fatigueIndex,
      pressure_zone: result.pressureZone,
      pressure_data: result.rawData,
      writing_completed_at: new Date().toISOString(),
      status: SessionStatus.WRITING_DONE,
    })
    .eq('id', sessionId) as any);

  if (error) {
    throw new Error(`Failed to update pressure result: ${error.message}`);
  }
}

/**
 * Store handwriting analysis results into the session row.
 * Sets handwriting columns + analysis_completed_at.
 * Does NOT change status — caller should call completeSession() separately.
 */
export async function updateHandwritingResult(
  sessionId: string,
  result: HandwritingResult
): Promise<void> {
  const { error } = await (supabase
    .from(TABLE)
    .update({
      letter_clarity: result.letterClarity,
      size_consistency: result.sizeConsistency,
      line_adherence: result.lineAdherence,
      letter_formation: result.letterFormation,
      spacing: result.spacing,
      problem_letters: result.problemLetters,
      ai_suggestions: result.suggestions.join('\n'),
      analysis_completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId) as any);

  if (error) {
    throw new Error(`Failed to update handwriting result: ${error.message}`);
  }
}

/**
 * Mark a session as complete.
 */
export async function completeSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, SessionStatus.COMPLETE);
}

// ─── Report Retrieval ────────────────────────────────────────

/**
 * Fetch the complete assessment result for a session.
 * Returns all grip + pressure + handwriting data as a unified object.
 */
export async function getFullAssessmentResult(
  sessionId: string
): Promise<FullAssessmentResult | null> {
  const { data, error } = await (supabase
    .from(TABLE)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle() as any);

  if (error) {
    throw new Error(`Failed to get assessment result: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToFullResult(data as DbSessionRow);
}

// ─── Snapshot Storage ────────────────────────────────────────

/**
 * Upload a grip snapshot image to Supabase Storage.
 * @returns Public URL of the uploaded image, or null on failure.
 */
export async function uploadGripSnapshot(
  sessionId: string,
  imageBlob: Blob
): Promise<string | null> {
  const path = `${sessionId}/grip_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, imageBlob, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('[assessmentService] Failed to upload grip snapshot:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Upload a writing canvas image to Supabase Storage.
 * Converts a data URL to a Blob before uploading.
 * @returns Public URL of the uploaded image, or null on failure.
 */
export async function uploadWritingImage(
  sessionId: string,
  imageDataUrl: string
): Promise<string | null> {
  // Convert data URL to Blob
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  const path = `${sessionId}/writing_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('[assessmentService] Failed to upload writing image:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
