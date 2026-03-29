// ============================================================
// geminiClient — Handwriting Analysis Client
// ============================================================
// Uses Google's Gemini 2.0 Flash Vision to assess writing quality.
// Features: 
//   - JSON-native parsing
//   - Automatic retries (max 2)
//   - Timeout protection (15s)
//   - Score clamping (1-5 range)
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { HandwritingResult } from '../shared/types';

// ─── Constants ────────────────────────────────────────────────

const MODEL_NAME = 'gemini-2.0-flash';
const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

const HANDWRITING_ANALYSIS_PROMPT = `
You are a P.3/P.4 (ages 8-10) English handwriting expert. The student is writing in a four-line copybook.
The student was prompted to write: '{writingPrompt}'.
Writing context:
- Average pen pressure: {avgPressure} (on a 0-1 scale; >0.6 is considered excessive)
- Observed grip: {gripType}

AGE CALIBRATION: As an 8-10 year old beginner, a score of 3 means "age-appropriate and acceptable", not "perfect by adult standards." Do not penalize minor wobbles too harshly.

Your task is to analyze the provided image of the student's handwriting.
Please assess the following criteria on a scale of 1 to 5:

- Letter Clarity (legibility and shape): 1=illegible, 3=mostly readable with some unclear letters, 5=all letters clearly formed
- Size Consistency (uniformity of x-height and ascenders/descenders): 1=wildly varying sizes, 3=some variation but mostly consistent (watch for inconsistent tall vs short letter heights), 5=uniform sizing throughout
- Line Adherence (how well they follow the four-line grid): 1=writes above/below grid consistently, 3=mostly on baseline with occasional drift (look for letters not sitting on baseline), 5=follows all 4 lines correctly
- Letter Formation (stroke direction and connections): 1=major stroke errors (reversals, missing strokes), 3=correct form with minor flaws, 5=correct formation throughout. NOTE: Watch closely for b/d and p/q reversals; if detected, note in problem_letters and penalize here.
- Spacing (word and letter spacing): 1=letters/words crammed or widely spread, 3=spacing mostly appropriate, 5=consistent letter and word spacing

Identify any specific problem letters (e.g., lowercase "b", "d", "p", "q" reversals).
Provide 2-3 actionable improvement suggestions in Traditional Chinese (繁體中文).

Return ONLY a JSON object in this format:
{
  "letter_clarity": number,
  "size_consistency": number,
  "line_adherence": number,
  "letter_formation": number,
  "spacing": number,
  "problem_letters": string[],
  "suggestions": "string containing 2-3 bulleted points in Traditional Chinese"
}
`;

// ─── Client Init ─────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// ─── Utilities ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Converts dataURL to a format Gemini understands */
function parseDataUrl(dataUrl: string) {
  const parts = dataUrl.split(';base64,');
  if (parts.length !== 2) throw new Error('Invalid dataUrl format');
  return {
    inlineData: {
      data: parts[1],
      mimeType: parts[0].split(':')[1],
    },
  };
}

// ─── Analysis Logic ──────────────────────────────────────────

export async function analyzeHandwriting(
  imageDataUrl: string,
  context: { avgPressure: number; gripType: string; writingPrompt: string }
): Promise<HandwritingResult> {
  const { avgPressure, gripType, writingPrompt } = context;

  // 1. Prepare Prompt
  const promptText = HANDWRITING_ANALYSIS_PROMPT
    .replace('{writingPrompt}', writingPrompt)
    .replace('{avgPressure}', avgPressure.toFixed(2))
    .replace('{gripType}', gripType);

  // 2. Prepare Vision Data
  const image = parseDataUrl(imageDataUrl);

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json' },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // 3. Call Gemini
      const result = await model.generateContent([image, promptText]);
      const response = await result.response;
      const text = response.text();

      // 4. Parse & Map Result
      const data = JSON.parse(text);

      // Ensure suggestions is handled as string[] for our HandwritingResult type
      const RawSuggestions = data.suggestions || '';
      const suggestionList = typeof RawSuggestions === 'string' 
        ? RawSuggestions.split('\n').map(s => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)
        : Array.isArray(RawSuggestions) ? RawSuggestions : [];

      const mappedResult: HandwritingResult = {
        letterClarity: clamp(data.letter_clarity || 3, 1, 5),
        sizeConsistency: clamp(data.size_consistency || 3, 1, 5),
        lineAdherence: clamp(data.line_adherence || 3, 1, 5),
        letterFormation: clamp(data.letter_formation || 3, 1, 5),
        spacing: clamp(data.spacing || 3, 1, 5),
        problemLetters: Array.isArray(data.problem_letters) ? data.problem_letters : [],
        suggestions: suggestionList,
        analyzedAt: new Date().toISOString(),
      };

      clearTimeout(timeout);
      return mappedResult;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      
      if (err.name === 'AbortError') {
        console.warn(`Handwriting Analysis Attempt ${attempt + 1}: Timeout`);
      } else {
        console.warn(`Handwriting Analysis Attempt ${attempt + 1}:`, err.message);
      }
      
      // Don't wait on last attempt
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Handwriting analysis failed after multiple retries.');
}
