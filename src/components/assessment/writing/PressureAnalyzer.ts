// ============================================================
// PressureAnalyzer — Handwriting Pressure Analysis Engine
// ============================================================
// All functions are pure (no side effects).
// Inputs:  PressureSample[]  (from WritingCanvas)
// Outputs: PressureResult, bilingual summary string,
//          downsampled time series, histogram distribution
// ============================================================

import { PressureResult, PressureSample, PressureZone } from '../shared/types';
import {
  PRESSURE_THRESHOLDS,
  classifyPressureZone,
  FATIGUE_THRESHOLD,
} from '../shared/constants';

// ─── Minimum sample gate ──────────────────────────────────────
const MIN_SAMPLES_FOR_ANALYSIS = 50;

// ─── Zero result helper ───────────────────────────────────────
function zeroPressureResult(
  samples: PressureSample[],
  extras: Partial<PressureResult> = {},
): PressureResult {
  return {
    avgPressure: 0,
    maxPressure: 0,
    pressureVariance: 0,
    fatigueIndex: null,
    pressureZone: PressureZone.LIGHT,
    rawData: samples,
    ...extras,
  };
}

// ─── 1. analyzePressure ───────────────────────────────────────

/**
 * Computes aggregate pressure statistics from a writing session.
 *
 * @returns PressureResult — fully typed aggregate statistics
 */
export function analyzePressure(samples: PressureSample[]): PressureResult {
  // ── Edge case: empty or single point ─────────────────────
  if (samples.length <= 1) {
    return zeroPressureResult(samples, { insufficientData: true });
  }

  const pressures = samples.map((s) => s.pressure);

  // ── All-zero pressure detection ───────────────────────────
  // Occurs when the device does not report pressure (non-Pencil input)
  const allZero = pressures.every((p) => p === 0);
  if (allZero) {
    return zeroPressureResult(samples, {
      noPressureDetected: true,
      insufficientData: samples.length < MIN_SAMPLES_FOR_ANALYSIS,
    });
  }

  // ── Core statistics ───────────────────────────────────────
  const n = pressures.length;
  const avgPressure = pressures.reduce((a, b) => a + b, 0) / n;
  const maxPressure = Math.max(...pressures);

  // Population standard deviation (variance of the writing session)
  const squaredDiffs = pressures.map((p) => (p - avgPressure) ** 2);
  const pressureVariance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);

  // ── Pressure zone ─────────────────────────────────────────
  const pressureZone = classifyPressureZone(avgPressure);

  // ── Fatigue index ─────────────────────────────────────────
  // Threshold 1.15 is an initial heuristic estimate.
  // TODO: Validate with real student data. Consider referencing OT literature
  // on writing fatigue in children (e.g. Smits-Engelsman et al., 2006).
  let fatigueIndex: number | null = null;
  const insufficientData = samples.length < MIN_SAMPLES_FOR_ANALYSIS;

  if (!insufficientData) {
    const third = Math.floor(n / 3);
    const firstThird = pressures.slice(0, third);
    const lastThird = pressures.slice(n - third);

    const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

    // Guard division-by-zero when first-third is all zero
    fatigueIndex = avgFirst > 0 ? avgLast / avgFirst : null;
  }

  return {
    avgPressure,
    maxPressure,
    pressureVariance,
    fatigueIndex,
    pressureZone,
    rawData: samples,
    insufficientData: insufficientData || undefined,
  };
}

// ─── 2. getPressureSummary ────────────────────────────────────

/**
 * Generates a bilingual (English / Traditional Chinese) parent-facing
 * summary of the student's pressure profile. English first, then Chinese.
 */
export function getPressureSummary(result: PressureResult): string {
  const { pressureZone, fatigueIndex, insufficientData, noPressureDetected } = result;

  // ── No pressure device ────────────────────────────────────
  if (noPressureDetected) {
    return (
      'No pressure data was detected. Please ensure your child is writing with an Apple Pencil.\n\n' +
      '未偵測到壓力數據。請確認使用 Apple Pencil 書寫。'
    );
  }

  // ── Zone summary ──────────────────────────────────────────
  let en = '';
  let zh = '';

  if (pressureZone === PressureZone.LIGHT) {
    en =
      'Your child uses a light touch when writing. While this is gentle on the hand, very light pressure can ' +
      'sometimes make letters appear faint or inconsistent. Encourage your child to write with a little more ' +
      'firmness so that letters are clear and even.';
    zh =
      '你嘅小朋友寫字時力度偏輕。雖然輕力對手部友好，但力度太輕有時會令筆跡模糊或不均勻。' +
      '建議鼓勵小朋友稍微加大力度，令筆跡更清晰穩定。';
  } else if (pressureZone === PressureZone.MODERATE) {
    en =
      'Good news! Your child writes with a healthy amount of pressure — not too light, not too heavy. ' +
      'This is the ideal range for efficient handwriting and helps prevent hand fatigue during longer writing tasks.';
    zh =
      '好消息！你嘅小朋友寫字力度適中——既唔太輕，又唔太重。' +
      '呢個係理想的書寫力度，有助提升書寫效率，並減少長時間寫字帶來的手部疲勞。';
  } else {
    // EXCESSIVE
    en =
      'Your child presses quite hard on the pencil while writing. Heavy pressure can cause hand fatigue, ' +
      'affect pencil control, and may lead to discomfort over time. Consider practising relaxed grip exercises ' +
      'before writing sessions to help reduce tension.';
    zh =
      '你嘅小朋友寫字時壓力偏重。用力過猛容易令手部疲勞、影響筆桿控制，長期下去可能引起不適。' +
      '建議在書寫前做些放鬆手部的練習，幫助減輕緊張感。';
  }

  // ── Fatigue appendage ─────────────────────────────────────
  if (fatigueIndex !== null && fatigueIndex > FATIGUE_THRESHOLD) {
    en += 
      "\n\nSigns of fatigue detected: your child's pressure increased noticeably toward the end of the writing " +
      "session. This often happens as fine motor muscles tire.";
    zh +=
      '\n\n偵測到疲勞跡象：你嘅小朋友喺書寫後段壓力明顯增加。建議縮短書寫時間，並定時休息。';
  }

  // ── Insufficient data appendage ───────────────────────────
  if (insufficientData) {
    en +=
      '\n\nNote: The writing sample was very short, so these results may not fully represent your child\'s ' +
      'typical handwriting pressure. A longer sample will provide more accurate analysis.';
    zh +=
      '\n\n注意：書寫樣本較短，分析結果未必能完全反映小朋友平時的書寫力度。' +
      '建議提供更長的書寫樣本以獲得更準確的評估。';
  }

  return `${en}\n\n${zh}`;
}

// ─── 3. getPressureTimeSeries ─────────────────────────────────

/**
 * Returns a downsampled time series (max 200 points) for charting.
 * Time values are seconds elapsed from the first sample.
 */
export function getPressureTimeSeries(
  samples: PressureSample[],
): { time: number; pressure: number }[] {
  if (samples.length === 0) return [];

  const MAX_POINTS = 200;
  const t0 = samples[0].time;

  if (samples.length <= MAX_POINTS) {
    return samples.map((s) => ({
      time: (s.time - t0) / 1000,
      pressure: s.pressure,
    }));
  }

  // Downsample by picking evenly-spaced indices
  const step = samples.length / MAX_POINTS;
  const result: { time: number; pressure: number }[] = [];

  for (let i = 0; i < MAX_POINTS; i++) {
    const idx = Math.min(Math.round(i * step), samples.length - 1);
    result.push({
      time: (samples[idx].time - t0) / 1000,
      pressure: samples[idx].pressure,
    });
  }

  return result;
}

// ─── 4. getPressureDistribution ──────────────────────────────

const HISTOGRAM_BUCKETS = [
  { label: '0.0–0.2', min: 0.0, max: 0.2 },
  { label: '0.2–0.4', min: 0.2, max: 0.4 },
  { label: '0.4–0.6', min: 0.4, max: 0.6 },
  { label: '0.6–0.8', min: 0.6, max: 0.8 },
  { label: '0.8–1.0', min: 0.8, max: 1.0 },
] as const;

/**
 * Computes a histogram of pressure values divided into 5 equal buckets (0–1).
 */
export function getPressureDistribution(
  samples: PressureSample[],
): { bucket: string; count: number }[] {
  const counts = HISTOGRAM_BUCKETS.map((b) => ({ bucket: b.label, count: 0 }));

  for (const sample of samples) {
    const p = Math.min(1, Math.max(0, sample.pressure));
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
      const { min, max } = HISTOGRAM_BUCKETS[i];
      // Last bucket is inclusive on both ends
      if (p >= min && (p < max || (i === HISTOGRAM_BUCKETS.length - 1 && p === max))) {
        counts[i].count++;
        break;
      }
    }
  }

  return counts;
}
