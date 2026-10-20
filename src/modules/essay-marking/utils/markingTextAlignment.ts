import { MarkingFinding } from '../types';

export interface AlignedTextToken {
  type: 'text';
  text: string;
}

export interface AlignedFindingToken {
  type: 'finding';
  finding: MarkingFinding;
  originalText: string;
  replacementText: string;
  startIndex: number;
  endIndex: number;
  isRejected: boolean;
  isAccepted: boolean;
  isEdited: boolean;
}

export type AlignedLineToken = AlignedTextToken | AlignedFindingToken;

export interface AlignedMarkingLine {
  lineIndex: number;
  rawText: string;
  isEmpty: boolean;
  tokens: AlignedLineToken[];
}

export interface ParagraphStructure {
  paragraphs: Array<Array<{ text: string; rawLineIndex: number }>>;
}

export interface WordDiffChunk {
  type: 'equal' | 'diff';
  originalText: string;
  replacementText: string;
}

/**
 * Splits text into alternating words and whitespace/punctuation tokens.
 */
export function tokenizeWordsAndSeparators(text: string): string[] {
  if (!text) return [];
  const tokens = text.match(/[\w']+|[^\w\s]+|\s+/g);
  return tokens || [text];
}

/**
 * Computes word-level diff between original finding quote and replacement suggestion.
 * Preserves unchanged words as 'equal' so only the minimal changed words are marked as 'diff'.
 *
 * Example:
 * original: "he save", replacement: "he saved"
 * -> [
 *      { type: 'equal', originalText: 'he ', replacementText: 'he ' },
 *      { type: 'diff', originalText: 'save', replacementText: 'saved' }
 *    ]
 */
export function computeWordLevelDiff(
  originalText: string,
  replacementText: string
): WordDiffChunk[] {
  if (!originalText && !replacementText) return [];
  if (originalText === replacementText) {
    return [{ type: 'equal', originalText, replacementText }];
  }

  const origTokens = tokenizeWordsAndSeparators(originalText);
  const replTokens = tokenizeWordsAndSeparators(replacementText);

  const n = origTokens.length;
  const m = replTokens.length;

  // DP table for LCS on word tokens
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (origTokens[i - 1] === replTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to assemble aligned chunks
  let i = n;
  let j = m;
  const rawChunks: Array<{ type: 'equal' | 'diff'; orig: string[]; repl: string[] }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origTokens[i - 1] === replTokens[j - 1]) {
      rawChunks.push({
        type: 'equal',
        orig: [origTokens[i - 1]],
        repl: [replTokens[j - 1]],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawChunks.push({
        type: 'diff',
        orig: [],
        repl: [replTokens[j - 1]],
      });
      j--;
    } else {
      rawChunks.push({
        type: 'diff',
        orig: [origTokens[i - 1]],
        repl: [],
      });
      i--;
    }
  }

  rawChunks.reverse();

  // Merge adjacent chunks of the same type
  const mergedChunks: WordDiffChunk[] = [];
  for (const chunk of rawChunks) {
    const last = mergedChunks[mergedChunks.length - 1];
    const origStr = chunk.orig.join('');
    const replStr = chunk.repl.join('');

    if (last && last.type === chunk.type) {
      last.originalText += origStr;
      last.replacementText += replStr;
    } else {
      mergedChunks.push({
        type: chunk.type,
        originalText: origStr,
        replacementText: replStr,
      });
    }
  }

  // Shift matching trailing or leading whitespace out of diff chunks into equal chunks
  const refinedChunks: WordDiffChunk[] = [];
  for (let k = 0; k < mergedChunks.length; k++) {
    const chunk = mergedChunks[k];
    if (chunk.type === 'diff') {
      let orig = chunk.originalText;
      let repl = chunk.replacementText;

      // Extract leading matching spaces
      const leadingSpaceMatch = orig.match(/^\s+/);
      const replLeadingSpaceMatch = repl.match(/^\s+/);
      if (
        leadingSpaceMatch &&
        replLeadingSpaceMatch &&
        leadingSpaceMatch[0] === replLeadingSpaceMatch[0]
      ) {
        const space = leadingSpaceMatch[0];
        refinedChunks.push({
          type: 'equal',
          originalText: space,
          replacementText: space,
        });
        orig = orig.slice(space.length);
        repl = repl.slice(space.length);
      }

      // Extract trailing matching spaces
      let trailingSpace = '';
      const trailingSpaceMatch = orig.match(/\s+$/);
      const replTrailingSpaceMatch = repl.match(/\s+$/);
      if (
        trailingSpaceMatch &&
        replTrailingSpaceMatch &&
        trailingSpaceMatch[0] === replTrailingSpaceMatch[0]
      ) {
        trailingSpace = trailingSpaceMatch[0];
        orig = orig.slice(0, orig.length - trailingSpace.length);
        repl = repl.slice(0, repl.length - trailingSpace.length);
      }

      if (orig.length > 0 || repl.length > 0) {
        refinedChunks.push({
          type: 'diff',
          originalText: orig,
          replacementText: repl,
        });
      }

      if (trailingSpace.length > 0) {
        refinedChunks.push({
          type: 'equal',
          originalText: trailingSpace,
          replacementText: trailingSpace,
        });
      }
    } else {
      refinedChunks.push(chunk);
    }
  }

  // Re-merge adjacent equal chunks
  const finalChunks: WordDiffChunk[] = [];
  for (const c of refinedChunks) {
    const last = finalChunks[finalChunks.length - 1];
    if (last && last.type === c.type) {
      last.originalText += c.originalText;
      last.replacementText += c.replacementText;
    } else if (c.originalText.length > 0 || c.replacementText.length > 0) {
      finalChunks.push(c);
    }
  }

  return finalChunks;
}

/**
 * Builds paragraph structure identical to the bridge's parseTranscriptParagraphs logic.
 * Empty lines define paragraph breaks.
 */
export function buildTranscriptParagraphStructure(rawLines: string[]): ParagraphStructure {
  const paragraphs: Array<Array<{ text: string; rawLineIndex: number }>> = [];
  let currentParagraph: Array<{ text: string; rawLineIndex: number }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.trim().length === 0) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
    } else {
      currentParagraph.push({ text: line, rawLineIndex: i });
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  return { paragraphs };
}

interface TargetLocation {
  rawLineIndex: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Locates all character occurrences of substring in str
 */
function findAllOccurrences(str: string, substr: string): number[] {
  if (!substr) return [];
  const indices: number[] = [];
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    indices.push(pos);
    pos += 1;
  }
  return indices;
}

/**
 * Resolves reliable target line and character range for a finding.
 * Strictly adheres to alignment rules:
 * - Prioritize paragraphIndex & lineIndex
 * - Fall back to lineIndex
 * - Fall back to single unambiguous line match
 * - If ambiguous across multiple lines or not found, return null (unmatched)
 */
export function resolveFindingLocation(
  finding: MarkingFinding,
  rawLines: string[],
  structure: ParagraphStructure,
  usedSpansByLine: Map<number, Array<{ start: number; end: number }>>
): TargetLocation | null {
  const quote = finding.originalText;
  if (!quote) return null;

  let candidateRawLine: number | null = null;

  // 1. Check paragraphIndex & lineIndex
  if (
    typeof finding.paragraphIndex === 'number' &&
    typeof finding.lineIndex === 'number' &&
    structure.paragraphs[finding.paragraphIndex] &&
    structure.paragraphs[finding.paragraphIndex][finding.lineIndex]
  ) {
    const paraLine = structure.paragraphs[finding.paragraphIndex][finding.lineIndex];
    if (paraLine.text.includes(quote)) {
      candidateRawLine = paraLine.rawLineIndex;
    }
  }

  // 2. Check lineIndex directly if candidate not yet found
  if (candidateRawLine === null && typeof finding.lineIndex === 'number') {
    if (rawLines[finding.lineIndex]?.includes(quote)) {
      candidateRawLine = finding.lineIndex;
    } else if (finding.lineIndex > 0 && rawLines[finding.lineIndex - 1]?.includes(quote)) {
      // 1-indexed fallback if model output was 1-indexed
      candidateRawLine = finding.lineIndex - 1;
    }
  }

  // 3. Fallback: Check if quote appears in exactly one line in the entire essay
  if (candidateRawLine === null) {
    const matchingLines: number[] = [];
    rawLines.forEach((lineText, idx) => {
      if (lineText.includes(quote)) {
        matchingLines.push(idx);
      }
    });

    if (matchingLines.length === 1) {
      // Unambiguous unique match
      candidateRawLine = matchingLines[0];
    } else {
      // 0 or >1 matches: ambiguous or absent, do not guess!
      return null;
    }
  }

  const targetLineText = rawLines[candidateRawLine];
  if (!targetLineText) return null;

  const occurrences = findAllOccurrences(targetLineText, quote);
  if (occurrences.length === 0) return null;

  const usedSpans = usedSpansByLine.get(candidateRawLine) || [];

  // Determine which occurrence to use
  let selectedStart: number | null = null;

  if (
    typeof finding.occurrenceIndex === 'number' &&
    occurrences[finding.occurrenceIndex] !== undefined
  ) {
    const occStart = occurrences[finding.occurrenceIndex];
    const occEnd = occStart + quote.length;
    // Check if overlaps with already used span
    const overlaps = usedSpans.some((s) => occStart < s.end && occEnd > s.start);
    if (!overlaps) {
      selectedStart = occStart;
    }
  }

  // If not matched by occurrenceIndex or overlap occurred, find first non-overlapping occurrence
  if (selectedStart === null) {
    for (const occ of occurrences) {
      const occEnd = occ + quote.length;
      const overlaps = usedSpans.some((s) => occ < s.end && occEnd > s.start);
      if (!overlaps) {
        selectedStart = occ;
        break;
      }
    }
  }

  if (selectedStart === null) {
    // All occurrences on target line overlap with other findings
    return null;
  }

  return {
    rawLineIndex: candidateRawLine,
    startIndex: selectedStart,
    endIndex: selectedStart + quote.length,
  };
}

/**
 * Aligns student transcript lines with findings for inline marking view.
 * Applies minimal word-level diffing so only the actual changed words are highlighted,
 * leaving surrounding correct words as normal text.
 */
export function alignTranscriptWithFindings(
  rawTranscript: string,
  findings: MarkingFinding[]
): {
  alignedLines: AlignedMarkingLine[];
  unmatchedFindings: MarkingFinding[];
} {
  const rawLines = rawTranscript.replace(/\r\n/g, '\n').split('\n');
  const structure = buildTranscriptParagraphStructure(rawLines);

  const lineFindingsMap = new Map<
    number,
    Array<{
      finding: MarkingFinding;
      startIndex: number;
      endIndex: number;
    }>
  >();
  const usedSpansByLine = new Map<number, Array<{ start: number; end: number }>>();
  const unmatchedFindings: MarkingFinding[] = [];

  for (const finding of findings) {
    // Findings flagged as 'needs_review' are paused from inline rendering until confirmed
    if (finding.decision === 'needs_review') {
      continue;
    }

    const location = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);

    if (location) {
      const { rawLineIndex, startIndex, endIndex } = location;
      const list = lineFindingsMap.get(rawLineIndex) || [];
      list.push({ finding, startIndex, endIndex });
      lineFindingsMap.set(rawLineIndex, list);

      const spans = usedSpansByLine.get(rawLineIndex) || [];
      spans.push({ start: startIndex, end: endIndex });
      usedSpansByLine.set(rawLineIndex, spans);
    } else {
      unmatchedFindings.push(finding);
    }
  }

  // Build tokenized lines with word-level minimal diff
  const alignedLines: AlignedMarkingLine[] = rawLines.map((lineText, lineIndex) => {
    if (lineText.trim().length === 0) {
      return {
        lineIndex,
        rawText: lineText,
        isEmpty: true,
        tokens: [],
      };
    }

    const assignedFindings = lineFindingsMap.get(lineIndex) || [];
    // Sort findings on this line by startIndex ascending
    assignedFindings.sort((a, b) => a.startIndex - b.startIndex);

    const tokens: AlignedLineToken[] = [];
    let cursor = 0;

    for (const item of assignedFindings) {
      if (item.startIndex > cursor) {
        tokens.push({
          type: 'text',
          text: lineText.slice(cursor, item.startIndex),
        });
      }

      const originalSpanText = lineText.slice(item.startIndex, item.endIndex);
      const replacementSpanText =
        item.finding.teacherCustomText || item.finding.replacementText;

      const isOptionalOrClarity =
        item.finding.feedbackType === 'improvement' ||
        item.finding.feedbackType === 'clarity';

      if (isOptionalOrClarity) {
        // For optional improvements and clarity feedback, the entire quote is retained on baseline
        // without decomposing into word diff chunks or striking through unchanged words.
        tokens.push({
          type: 'finding',
          finding: item.finding,
          originalText: originalSpanText,
          replacementText: replacementSpanText,
          startIndex: item.startIndex,
          endIndex: item.endIndex,
          isRejected: item.finding.decision === 'rejected',
          isAccepted: item.finding.decision === 'accepted',
          isEdited: item.finding.decision === 'edited',
        });
      } else {
        // Required corrections: compute word-level minimal diff to isolate and highlight the smallest error words
        const diffChunks = computeWordLevelDiff(originalSpanText, replacementSpanText);

        let chunkCursor = item.startIndex;
        for (const chunk of diffChunks) {
          const chunkLen = chunk.originalText.length;
          const chunkStart = chunkCursor;
          const chunkEnd = chunkStart + chunkLen;

          if (chunk.type === 'equal') {
            // Unchanged words remain normal text
            if (chunk.originalText.length > 0) {
              tokens.push({
                type: 'text',
                text: chunk.originalText,
              });
            }
          } else {
            // Changed words get inline marking
            tokens.push({
              type: 'finding',
              finding: item.finding,
              originalText: chunk.originalText,
              replacementText: chunk.replacementText,
              startIndex: chunkStart,
              endIndex: chunkEnd,
              isRejected: item.finding.decision === 'rejected',
              isAccepted: item.finding.decision === 'accepted',
              isEdited: item.finding.decision === 'edited',
            });
          }

          chunkCursor += chunkLen;
        }
      }

      cursor = item.endIndex;
    }

    if (cursor < lineText.length) {
      tokens.push({
        type: 'text',
        text: lineText.slice(cursor),
      });
    }

    // Merge adjacent text tokens
    const mergedTokens: AlignedLineToken[] = [];
    for (const t of tokens) {
      const prev = mergedTokens[mergedTokens.length - 1];
      if (prev && prev.type === 'text' && t.type === 'text') {
        prev.text += t.text;
      } else {
        mergedTokens.push(t);
      }
    }

    return {
      lineIndex,
      rawText: lineText,
      isEmpty: false,
      tokens: mergedTokens,
    };
  });

  return { alignedLines, unmatchedFindings };
}

export interface FindingValidationResult {
  valid: boolean;
  error?: string;
  lineIndex?: number;
  paragraphIndex?: number;
  occurrenceIndex?: number;
  startIndex?: number;
  endIndex?: number;
}

/**
 * Validates a finding's quoted text and target range against student transcript.
 * Enforces strict single-occurrence resolution, rejects unmatched or ambiguous quotes,
 * and checks for overlaps with other active findings on the same line.
 */
export function validateFindingQuoteAndRange({
  quote,
  lineIndex,
  occurrenceIndex,
  transcript,
  currentFindingId,
  existingFindings = [],
}: {
  quote: string;
  lineIndex?: number;
  occurrenceIndex?: number;
  transcript: string;
  currentFindingId?: string;
  existingFindings?: MarkingFinding[];
}): FindingValidationResult {
  const cleanQuote = quote ? quote.trim() : '';
  if (!cleanQuote) {
    return { valid: false, error: 'Original quoted text cannot be empty.' };
  }

  const rawLines = transcript.replace(/\r\n/g, '\n').split('\n');
  const structure = buildTranscriptParagraphStructure(rawLines);

  interface OccurrenceMatch {
    lineIndex: number;
    occIndex: number;
    startIndex: number;
    endIndex: number;
    paragraphIndex: number;
  }

  const matches: OccurrenceMatch[] = [];
  rawLines.forEach((lineText, lIdx) => {
    let pos = 0;
    let occ = 0;
    while ((pos = lineText.indexOf(cleanQuote, pos)) !== -1) {
      let paraIdx = 0;
      for (let p = 0; p < structure.paragraphs.length; p++) {
        if (structure.paragraphs[p].some((pl) => pl.rawLineIndex === lIdx)) {
          paraIdx = p;
          break;
        }
      }
      matches.push({
        lineIndex: lIdx,
        occIndex: occ,
        startIndex: pos,
        endIndex: pos + cleanQuote.length,
        paragraphIndex: paraIdx,
      });
      occ += 1;
      pos += 1;
    }
  });

  if (matches.length === 0) {
    return { valid: false, error: 'Quote text was not found in the essay transcript.' };
  }

  let targetMatch: OccurrenceMatch | null = null;

  if (typeof lineIndex === 'number') {
    const matchesOnLine = matches.filter((m) => m.lineIndex === lineIndex);
    if (matchesOnLine.length === 1) {
      targetMatch = matchesOnLine[0];
    } else if (matchesOnLine.length > 1) {
      if (typeof occurrenceIndex === 'number' && matchesOnLine[occurrenceIndex]) {
        targetMatch = matchesOnLine[occurrenceIndex];
      } else {
        return {
          valid: false,
          error: `Quote appears ${matchesOnLine.length} times on Line ${lineIndex + 1}. Please use "Reselect" to pick the exact occurrence.`,
        };
      }
    } else {
      // Quote is not on this line at all
      if (matches.length === 1) {
        targetMatch = matches[0];
      } else {
        return {
          valid: false,
          error: `Quote appears in multiple locations across the essay. Please use "Reselect" to pick the exact occurrence.`,
        };
      }
    }
  } else {
    // No lineIndex provided
    if (matches.length === 1) {
      targetMatch = matches[0];
    } else {
      return {
        valid: false,
        error: `Quote appears ${matches.length} times in the essay. Please use "Reselect" to pick the exact occurrence.`,
      };
    }
  }

  if (!targetMatch) {
    return { valid: false, error: 'Unable to anchor quote to transcript location.' };
  }

  // Overlap verification excluding current finding
  const otherFindings = existingFindings.filter(
    (f) => f.id !== currentFindingId && f.decision !== 'rejected' && f.decision !== 'needs_review'
  );

  const usedSpansByLine = new Map<number, Array<{ start: number; end: number }>>();
  for (const f of otherFindings) {
    const loc = resolveFindingLocation(f, rawLines, structure, usedSpansByLine);
    if (loc) {
      const spans = usedSpansByLine.get(loc.rawLineIndex) || [];
      spans.push({ start: loc.startIndex, end: loc.endIndex });
      usedSpansByLine.set(loc.rawLineIndex, spans);

      if (loc.rawLineIndex === targetMatch.lineIndex) {
        if (targetMatch.startIndex < loc.endIndex && targetMatch.endIndex > loc.startIndex) {
          return {
            valid: false,
            error: `Overlaps with another finding on Line ${targetMatch.lineIndex + 1}: "${f.originalText}"`,
          };
        }
      }
    }
  }

  return {
    valid: true,
    lineIndex: targetMatch.lineIndex,
    paragraphIndex: targetMatch.paragraphIndex,
    occurrenceIndex: targetMatch.occIndex,
    startIndex: targetMatch.startIndex,
    endIndex: targetMatch.endIndex,
  };
}
