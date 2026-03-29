// ============================================================
// Handwriting Assessment System — Constants & Configuration
// ============================================================

import { GripType, PressureZone } from './types';

// ─── Pressure Thresholds ─────────────────────────────────────
// Normalised pressure values (0–1) from Apple Pencil / pointer events

export const PRESSURE_THRESHOLDS = {
  /** Below this value → LIGHT pressure zone */
  LIGHT_MAX: 0.25,
  /** Above LIGHT_MAX and below this → MODERATE zone */
  MODERATE_MAX: 0.6,
  // Above MODERATE_MAX → EXCESSIVE zone
} as const;

/** Map a normalised pressure value to its zone classification */
export function classifyPressureZone(pressure: number): PressureZone {
  if (pressure < PRESSURE_THRESHOLDS.LIGHT_MAX) return PressureZone.LIGHT;
  if (pressure <= PRESSURE_THRESHOLDS.MODERATE_MAX) return PressureZone.MODERATE;
  return PressureZone.EXCESSIVE;
}

// ─── Fatigue Detection ───────────────────────────────────────

/** If fatigue index exceeds this, the student shows fatigue-related
 *  pressure increase (last third avg / first third avg). */
export const FATIGUE_THRESHOLD = 1.15;

// ─── Grip Types (display helpers) ────────────────────────────

export const GRIP_TYPE_LABELS: Record<GripType, string> = {
  [GripType.DYNAMIC_TRIPOD]: 'Dynamic Tripod (Ideal)',
  [GripType.QUADRUPOD]: 'Quadrupod Grip',
  [GripType.FIST]: 'Fist / Palmar Grip',
  [GripType.THUMB_WRAP]: 'Thumb Wrap Grip',
  [GripType.OTHER]: 'Other / Unclassified',
};

export const GRIP_TYPE_DESCRIPTIONS: Record<GripType, string> = {
  [GripType.DYNAMIC_TRIPOD]:
    'Thumb, index, and middle finger hold the pencil with dynamic movement from the fingers. This is the most efficient grip for writing.',
  [GripType.QUADRUPOD]:
    'Similar to tripod but uses four fingers (thumb, index, middle, ring). Generally functional but may cause fatigue.',
  [GripType.FIST]:
    'The entire hand wraps around the pencil. Common in younger children but limits fine motor control.',
  [GripType.THUMB_WRAP]:
    'The thumb wraps over the fingers instead of opposing them. Can cause excessive pressure and fatigue.',
  [GripType.OTHER]:
    'A grip pattern that does not clearly match any standard classification.',
};

// ─── Pressure Zone Colours ───────────────────────────────────

export const PRESSURE_ZONE_COLOURS: Record<PressureZone, string> = {
  [PressureZone.LIGHT]: '#22c55e',     // green-500
  [PressureZone.MODERATE]: '#f59e0b',  // amber-500
  [PressureZone.EXCESSIVE]: '#ef4444', // red-500
};

export const PRESSURE_ZONE_LABELS: Record<PressureZone, string> = {
  [PressureZone.LIGHT]: 'Light Pressure',
  [PressureZone.MODERATE]: 'Moderate Pressure',
  [PressureZone.EXCESSIVE]: 'Excessive Pressure',
};

// ─── Standard Writing Prompts ────────────────────────────────
// Age-appropriate sentences for P.3 / P.4 students.
// Each prompt targets common problematic letters (b/d, p/q, etc.)

export const WRITING_PROMPTS = [
  {
    id: 'prompt-1',
    text: 'The quick brown fox jumps over the lazy dog.',
    description: 'Pangram — tests all 26 letters',
    targetLetters: 'all',
  },
  {
    id: 'prompt-2',
    text: 'bad dog dug a big deep pond',
    description: 'Targets b/d confusion and descenders',
    targetLetters: 'b, d, g, p',
  },
  {
    id: 'prompt-3',
    text: 'pack my box with five dozen jugs',
    description: 'Pangram — shorter alternative',
    targetLetters: 'all',
  },
  {
    id: 'prompt-4',
    text: 'big blue bird by the bright bridge',
    description: 'Targets b/d differentiation with alliteration',
    targetLetters: 'b, d',
  },
  {
    id: 'prompt-5',
    text: 'pat put the purple pup in the pen',
    description: 'Targets p/q confusion and ascenders',
    targetLetters: 'p, t, u',
  },
] as const;

export type WritingPrompt = (typeof WRITING_PROMPTS)[number];

// ─── Session Configuration ───────────────────────────────────

/** Length of the session code used to pair devices */
export const SESSION_CODE_LENGTH = 6;

/** Characters used to generate session codes (no ambiguous chars) */
export const SESSION_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** How often (ms) to poll / listen for Supabase Realtime updates */
export const REALTIME_POLL_INTERVAL_MS = 1000;

/** Maximum time (ms) to wait for the other device to connect */
export const DEVICE_PAIR_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── MediaPipe Hands Configuration ───────────────────────────

export const MEDIAPIPE_CONFIG = {
  /** Maximum number of hands to detect */
  maxNumHands: 1,
  /** Minimum detection confidence */
  minDetectionConfidence: 0.7,
  /** Minimum tracking confidence */
  minTrackingConfidence: 0.5,
  /** Model complexity (0 = lite, 1 = full) */
  modelComplexity: 1,
} as const;

// ─── Writing Canvas Configuration ────────────────────────────

export const CANVAS_CONFIG = {
  /** Stroke colour for student writing */
  strokeColour: '#1e293b', // slate-800
  /** Minimum stroke width (at zero pressure) */
  minStrokeWidth: 1,
  /** Maximum stroke width (at full pressure) */
  maxStrokeWidth: 8,
  /** Four-line grid: spacing between lines in px */
  gridLineSpacing: 40,
  /** Four-line grid: colour of solid lines */
  gridSolidLineColour: '#94a3b8', // slate-400
  /** Four-line grid: colour of dashed midline */
  gridDashedLineColour: '#cbd5e1', // slate-300
} as const;

// ─── Handwriting Score Labels ────────────────────────────────

export const SCORE_LABELS: Record<number, string> = {
  1: 'Needs significant improvement',
  2: 'Below expectations',
  3: 'Meets basic expectations',
  4: 'Good',
  5: 'Excellent',
};
