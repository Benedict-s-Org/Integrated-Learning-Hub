// ============================================================
// HandwritingAnalyzer — Handwriting Analysis Orchestrator
// ============================================================
// Coordinates the handwriting analysis pipeline:
// 1. Receives canvas image from WritingCanvas
// 2. Sends to Gemini Vision via geminiClient
// 3. Combines with pressure data
// 4. Returns structured HandwritingResult
// ============================================================

import { HandwritingResult, PressureResult } from '../shared/types';
// import { analyzeHandwritingImage } from './geminiClient';

/**
 * Run the full handwriting analysis pipeline.
 *
 * TODO Phase 4:
 * - Pre-process the canvas image (crop, enhance contrast)
 * - Send to Gemini Vision for letter-level analysis
 * - Cross-reference with pressure data for correlations
 *   (e.g., do problem letters correlate with high pressure?)
 * - Return combined HandwritingResult
 *
 * @param canvasDataUrl - PNG data URL from WritingCanvas
 * @param writingPrompt - The prompt text the student was writing
 * @param pressureResult - Pressure data for cross-analysis
 * @returns Structured handwriting analysis
 */
export async function analyzeHandwriting(
  _canvasDataUrl: string,
  _writingPrompt: string,
  _pressureResult?: PressureResult
): Promise<HandwritingResult> {
  // TODO: Phase 4 implementation
  // 1. Call analyzeHandwritingImage from geminiClient
  // 2. Optionally correlate with pressure data
  // 3. Return result

  console.warn('[HandwritingAnalyzer] analyzeHandwriting not yet implemented');

  return {
    letterClarity: 0,
    sizeConsistency: 0,
    lineAdherence: 0,
    letterFormation: 0,
    spacing: 0,
    problemLetters: [],
    suggestions: [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Pre-process the canvas image before sending to Gemini.
 *
 * TODO Phase 4:
 * - Crop whitespace around the writing
 * - Increase contrast
 * - Convert to optimised PNG for API upload
 * - Possibly resize to reduce token usage
 */
export function preprocessImage(_dataUrl: string): string {
  // TODO: Implement image preprocessing
  return _dataUrl;
}

/**
 * Correlate handwriting issues with pressure data.
 *
 * TODO Phase 4:
 * - Map problem letters to their position on the canvas
 * - Check if those positions have abnormal pressure readings
 * - Add pressure-related insights to the analysis
 */
export function correlatePressureWithWriting(
  _handwritingResult: HandwritingResult,
  _pressureResult: PressureResult
): string[] {
  // TODO: Generate correlation insights
  // e.g., "Letter 'b' shows excessive pressure (0.8) — may indicate motor difficulty"
  return [];
}
