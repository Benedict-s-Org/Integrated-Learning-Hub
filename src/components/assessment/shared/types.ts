// ============================================================
// Handwriting Assessment System — Shared TypeScript Types
// ============================================================
// This file defines all interfaces and enums used across
// the grip analysis, writing/pressure analysis, and
// Gemini Vision handwriting analysis modules.
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

/** Classification of pencil grip types detected by MediaPipe Hands */
export enum GripType {
  /** Ideal grip: thumb + index + middle finger (tripod) */
  DYNAMIC_TRIPOD = 'DYNAMIC_TRIPOD',
  /** Four-finger grip: thumb + index + middle + ring */
  QUADRUPOD = 'QUADRUPOD',
  /** Fist/palmar grip — entire hand wraps around the pencil */
  FIST = 'FIST',
  /** Thumb wraps over fingers instead of opposing */
  THUMB_WRAP = 'THUMB_WRAP',
  /** Any grip pattern that doesn't match the above */
  OTHER = 'OTHER',
}

/** Pressure zones based on normalised pressure values (0–1) */
export enum PressureZone {
  /** Normalised pressure < 0.25 */
  LIGHT = 'LIGHT',
  /** Normalised pressure 0.25 – 0.6 */
  MODERATE = 'MODERATE',
  /** Normalised pressure > 0.6 */
  EXCESSIVE = 'EXCESSIVE',
}

/** Overall session status lifecycle — values match DB CHECK constraint */
export enum SessionStatus {
  /** Session created, in progress */
  IN_PROGRESS = 'in_progress',
  /** Grip analysis done (iPhone finished) */
  GRIP_DONE = 'grip_done',
  /** Writing task done (iPad finished) */
  WRITING_DONE = 'writing_done',
  /** Full assessment complete */
  COMPLETE = 'complete',
}

/** Which device role this hook instance represents */
export type DeviceRole = 'grip' | 'writing';

// ─── Session ─────────────────────────────────────────────────

/** Represents a single assessment session shared between iPhone & iPad */
export interface AssessmentSession {
  /** UUID primary key */
  id: string;
  /** Display name of the student being assessed */
  studentName: string;
  /** 6-digit numeric code used to pair devices */
  sessionCode: string;
  /** Current lifecycle status */
  status: SessionStatus;
  /** Writing prompt for this session */
  writingPrompt?: string;
  /** ISO-8601 timestamp of session creation */
  createdAt: string;
  /** Grip analysis completed timestamp */
  gripCompletedAt?: string;
  /** Writing task completed timestamp */
  writingCompletedAt?: string;
  /** AI analysis completed timestamp */
  analysisCompletedAt?: string;
}

/** Raw row shape from the assessment_sessions DB table (snake_case) */
export interface DbSessionRow {
  id: string;
  session_code: string;
  student_name: string;
  status: string;
  grip_type: string | null;
  grip_confidence: number | null;
  grip_snapshot_url: string | null;
  grip_thumb_position: string | null;
  grip_completed_at: string | null;
  avg_pressure: number | null;
  max_pressure: number | null;
  pressure_variance: number | null;
  fatigue_index: number | null;
  pressure_zone: string | null;
  pressure_data: unknown | null;
  writing_completed_at: string | null;
  letter_clarity: number | null;
  size_consistency: number | null;
  line_adherence: number | null;
  letter_formation: number | null;
  spacing: number | null;
  problem_letters: unknown | null;
  handwriting_sample_url: string | null;
  ai_suggestions: string | null;
  analysis_completed_at: string | null;
  teacher_notes: string | null;
  writing_prompt: string | null;
  created_at: string;
}

// ─── Grip Analysis (iPhone) ──────────────────────────────────

/** Result from the MediaPipe Hands grip classification */
export interface GripResult {
  /** Classified grip type */
  gripType: GripType;
  /** Model confidence score (0–1) */
  confidence: number;
  /** Relative thumb position descriptor from landmark analysis */
  thumbPosition: ThumbPosition;
  /** Per-finger flexion angles (degrees) */
  fingerFlexion: FingerFlexion;
  /** URL to the captured camera snapshot stored in Supabase Storage */
  snapshotUrl?: string;
  /** Timestamp of analysis */
  analyzedAt: string;
}

/** Thumb positioning relative to the pencil */
export interface ThumbPosition {
  /** Angle between thumb tip and index finger MCP (degrees) */
  angle: number;
  /** Whether the thumb is wrapped over (problematic) */
  isWrapped: boolean;
  /** Descriptive label */
  label: string;
}

/** Flexion angles for each finger (index → pinky) */
export interface FingerFlexion {
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

// ─── Pressure & Writing Analysis (iPad) ──────────────────────

/** Aggregated pressure statistics from the writing canvas */
export interface PressureResult {
  /** Mean normalised pressure across the writing task (0–1) */
  avgPressure: number;
  /** Peak normalised pressure recorded */
  maxPressure: number;
  /** Variance of pressure — higher = more inconsistent */
  pressureVariance: number;
  /** Fatigue index: ratio of last-third avg pressure to first-third avg.
   *  Values > 1.15 indicate fatigue-related pressure increase.
   *  null when insufficient data (< 50 samples). */
  fatigueIndex: number | null;
  /** Categorised pressure zone */
  pressureZone: PressureZone;
  /** Raw pressure samples: array of { time (ms), pressure (0–1) } */
  rawData: PressureSample[];
  /** True when sample count is too low for reliable analysis (< 50) */
  insufficientData?: boolean;
  /** True when all pressure values are 0 (no pressure-capable device) */
  noPressureDetected?: boolean;
}

/** A single pressure reading at a point in time */
export interface PressureSample {
  /** Milliseconds elapsed since writing started */
  time: number;
  /** Normalised pressure value (0–1) */
  pressure: number;
  /** Canvas X coordinate */
  x: number;
  /** Canvas Y coordinate */
  y: number;
}

// ─── Handwriting Analysis (Gemini Vision) ────────────────────

/** Structured result from the Gemini Flash Vision handwriting analysis */
export interface HandwritingResult {
  /** How clearly each letter is formed (1 = illegible, 5 = excellent) */
  letterClarity: number;
  /** Consistency of letter sizing (1 = highly varied, 5 = uniform) */
  sizeConsistency: number;
  /** How well writing stays on/between the guide lines (1–5) */
  lineAdherence: number;
  /** Quality of individual letter formation / stroke order (1–5) */
  letterFormation: number;
  /** Consistency of spacing between letters and words (1–5) */
  spacing: number;
  /** List of specific letters the student struggles with */
  problemLetters: string[];
  /** AI-generated improvement suggestions (localised to HK context) */
  suggestions: string[];
  /** Optional raw response from Gemini for debugging */
  rawResponse?: string;
  /** Timestamp of analysis */
  analyzedAt: string;
}

// ─── Full Combined Report ────────────────────────────────────

/** Final combined assessment result joining all three modules */
export interface FullAssessmentResult {
  /** Reference to the parent session */
  sessionId: string;
  /** Student display name */
  studentName: string;
  /** Grip analysis results (from iPhone) */
  gripResult: GripResult | null;
  /** Pressure/writing analysis results (from iPad) */
  pressureResult: PressureResult | null;
  /** AI handwriting analysis results (Gemini Vision) */
  handwritingResult: HandwritingResult | null;
  /** Overall assessment metadata */
  metadata: AssessmentMetadata;
}

/** Metadata about the assessment run */
export interface AssessmentMetadata {
  /** Duration of the full session in seconds */
  totalDurationSeconds: number;
  /** Which writing prompt was used */
  writingPrompt: string;
  /** Device info for the grip station (iPhone) */
  gripDeviceInfo?: string;
  /** Device info for the writing station (iPad) */
  writingDeviceInfo?: string;
  /** ISO-8601 timestamp when the report was generated */
  reportGeneratedAt: string;
}
