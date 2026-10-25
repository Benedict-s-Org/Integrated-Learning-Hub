import { OcrReviewNotice } from '../types';
import { OcrRulesConfig } from './ocrRulesSchema';
import { DEFAULT_OCR_RULES_CONFIG } from './ocrRulesDefaults';

/**
 * Pure helper to parse balanced braces starting from `startIndex` where `text[startIndex] === '{'`.
 * Returns the index of the matching '}', or -1 if unbalanced.
 */
function findMatchingBrace(text: string, startIndex: number): number {
  if (text[startIndex] !== '{') return -1;
  let depth = 1;
  for (let i = startIndex + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      // Skip escaped characters like \{ or \}
      i++;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Safely unwrap supported LaTeX text/style wrappers (e.g., \text{...}, \textbf{\textit{...}}).
 * Supports harmless whitespace between command name and opening brace (e.g. \text { Octoher, }).
 * Preserves source text, spaces, punctuation, and newlines.
 * If braces are unclosed or commands are not in the whitelist, they are left intact.
 */
function unwrapStyleWrappers(
  input: string,
  supportedCommandsSet: Set<string>
): string {
  let result = '';
  let i = 0;

  while (i < input.length) {
    if (input[i] === '\\') {
      // Check if followed by an alphabetical command name
      const commandMatch = input.slice(i + 1).match(/^[a-zA-Z]+/);
      if (commandMatch) {
        const cmd = commandMatch[0];
        const afterCmdIdx = i + 1 + cmd.length;

        // Skip harmless whitespace between command and opening brace (e.g. \text { ... })
        let openBraceIdx = afterCmdIdx;
        while (
          openBraceIdx < input.length &&
          (input[openBraceIdx] === ' ' || input[openBraceIdx] === '\t')
        ) {
          openBraceIdx++;
        }

        if (supportedCommandsSet.has(cmd) && input[openBraceIdx] === '{') {
          const closeBraceIdx = findMatchingBrace(input, openBraceIdx);
          if (closeBraceIdx !== -1) {
            // Inner content between { and }
            const innerRaw = input.slice(openBraceIdx + 1, closeBraceIdx);
            // Recursively unwrap inner content
            const innerUnwrapped = unwrapStyleWrappers(innerRaw, supportedCommandsSet);

            // Handle word boundary spacing safely:
            // If the wrapper is preceded by whitespace and inner starts with whitespace, prevent double space
            // If the wrapper is followed by whitespace and inner ends with whitespace, prevent double space
            let replacement = innerUnwrapped;
            const prevChar = result.length > 0 ? result[result.length - 1] : '';
            if (prevChar === ' ' && replacement.startsWith(' ')) {
              replacement = replacement.slice(1);
            }
            const nextChar = closeBraceIdx + 1 < input.length ? input[closeBraceIdx + 1] : '';
            if (nextChar === ' ' && replacement.endsWith(' ')) {
              replacement = replacement.slice(0, -1);
            }

            result += replacement;
            i = closeBraceIdx + 1;
            continue;
          }
        }
      }
    }

    result += input[i];
    i++;
  }

  return result;
}

/**
 * Safely unwrap balanced display/inline wrappers:
 * \[...\] and \(...\)
 *
 * If \[ or \] appears alone on its own line (with optional whitespace),
 * that line becomes an empty line, preserving the newline structure.
 */
function unwrapMathWrappers(text: string): string {
  const openDisplayCount = (text.match(/\\\[/g) || []).length;
  const closeDisplayCount = (text.match(/\\\]/g) || []).length;
  const openInlineCount = (text.match(/\\\(/g) || []).length;
  const closeInlineCount = (text.match(/\\\)/g) || []).length;

  let out = text;

  // Only strip if matched pairs exist
  if (openDisplayCount > 0 && openDisplayCount === closeDisplayCount) {
    out = out.replace(/\\\[/g, '').replace(/\\\]/g, '');
  }

  if (openInlineCount > 0 && openInlineCount === closeInlineCount) {
    out = out.replace(/\\\(/g, '').replace(/\\\)/g, '');
  }

  return out;
}

/**
 * Normalizes simple ordinal superscripts, such as:
 * 12^{\text{th}} -> 12th
 * 12^{\text {th }} -> 12th
 * 12^{\mathrm{th}} -> 12th
 * 12^{th} -> 12th
 * 1^{\text{st}} -> 1st
 * 2^{\text{nd}} -> 2nd
 * 3^{\text{rd}} -> 3rd
 * 21^{\text{st}} -> 21st
 *
 * Accepts harmless whitespace variations in supported command/bracket syntax.
 */
function normalizeOrdinalSuperscripts(
  text: string,
  suffixes: string[] = ['st', 'nd', 'rd', 'th']
): string {
  const suffixPattern = suffixes.join('|');
  return text
    // Form 1: 12^{\text{th}} or 12^{\text {th }} or 12^{\mathrm{th}}
    .replace(
      new RegExp(
        `\\b(\\d+)\\s*\\^\\s*\\{\\s*\\\\(?:text|mathrm|textbf|textit|mathbf|emph)\\s*\\{\\s*(${suffixPattern})\\s*\\}\\s*\\}`,
        'gi'
      ),
      '$1$2'
    )
    // Form 2: 12^\text{th} or 12^\text {th }
    .replace(
      new RegExp(
        `\\b(\\d+)\\s*\\^\\s*\\\\(?:text|mathrm|textbf|textit|mathbf|emph)\\s*\\{\\s*(${suffixPattern})\\s*\\}`,
        'gi'
      ),
      '$1$2'
    )
    // Form 3: 12^{th} or 12^{ th }
    .replace(
      new RegExp(
        `\\b(\\d+)\\s*\\^\\s*\\{\\s*(${suffixPattern})\\s*\\}`,
        'gi'
      ),
      '$1$2'
    )
    // Form 4: 12^th
    .replace(
      new RegExp(
        `\\b(\\d+)\\s*\\^\\s*(${suffixPattern})\\b`,
        'gi'
      ),
      '$1$2'
    );
}

/**
 * Applies active user-configured text replacements.
 */
function applyUserReplacements(text: string, config: OcrRulesConfig): string {
  let out = text;
  const activeReplaceRules = config.rules.filter(
    (r) => r.enabled && r.action === 'replace'
  );

  for (const rule of activeReplaceRules) {
    if (!rule.matchLiteral) continue;
    const replacement = rule.replacementLiteral ?? '';

    if (rule.scope === 'all_literal_occurrences') {
      out = out.split(rule.matchLiteral).join(replacement);
    } else if (rule.scope === 'whole_line_exact') {
      const lines = out.split('\n');
      const updatedLines = lines.map((l) =>
        l.trim() === rule.matchLiteral ? replacement : l
      );
      out = updatedLines.join('\n');
    }
  }

  return out;
}

/**
 * Pure normalization pipeline for OCR formatting commonly generated by Mathpix/LaTeX.
 * Strictly adheres to:
 * 1. User-configured replacements first (e.g. \_ -> _).
 * 2. Whitelisted syntax unwrapping & harmless whitespace tolerance.
 * 3. Nested wrappers supported safely.
 * 4. Exact spelling and punctuation preserved (no autocorrect).
 * 5. Newline structure and empty line boundaries preserved.
 * 6. Idempotent: normalize(normalize(x)) === normalize(x).
 */
export function normalizeOcrFormat(
  rawText: string,
  config: OcrRulesConfig = DEFAULT_OCR_RULES_CONFIG
): string {
  if (!rawText) return '';

  // 1. User literal replacements first
  let processed = applyUserReplacements(rawText, config);

  // 2. Ordinal normalization (handles 12^{\text{th}} before style unwrapping)
  if (config.builtInProcessors.ordinalSuperscripts.enabled) {
    processed = normalizeOrdinalSuperscripts(
      processed,
      config.builtInProcessors.ordinalSuperscripts.suffixes
    );
  }

  // 3. Display and inline math wrappers \[...\] and \(...\)
  if (config.builtInProcessors.latexWrappers.enabled) {
    processed = unwrapMathWrappers(processed);
  }

  // 4. Whitelisted style/text wrappers with recursive brace support
  if (config.builtInProcessors.latexWrappers.enabled) {
    const supportedCommandsSet = new Set(
      config.builtInProcessors.latexWrappers.styleCommands
    );
    processed = unwrapStyleWrappers(processed, supportedCommandsSet);
  }

  return processed;
}

/**
 * Pure detector for non-blocking review notices in OCR text:
 * 1. LaTeX table / tabular environments (complete, incomplete, residual commands).
 * 2. Standalone X/x tokens (suspected student skip-line markers).
 * 3. User-configured worksheet boilerplate rules and page labels.
 * 4. Suspicious / unhandled LaTeX syntax or unbalanced delimiters.
 *
 * Does NOT alter or delete text; only produces structured notices.
 */
export function detectReviewNotices(
  text: string,
  config: OcrRulesConfig = DEFAULT_OCR_RULES_CONFIG
): OcrReviewNotice[] {
  const notices: OcrReviewNotice[] = [];
  if (!text) return notices;

  const lines = text.split('\n');
  let noticeCounter = 1;

  // Track lines covered by complete table blocks so commands inside don't trigger duplicate notices
  const linesCoveredByTableNotice = new Set<number>();

  // --- Step 1: Detect complete and incomplete tabular blocks ---
  if (config.builtInProcessors.tableDetection.enabled) {
    const tableBeginIndices: number[] = [];
    const tableEndIndices: number[] = [];

    lines.forEach((line, idx) => {
      if (/\\begin\{tabular\}/.test(line)) {
        tableBeginIndices.push(idx);
      }
      if (/\\end\{tabular\}/.test(line)) {
        tableEndIndices.push(idx);
      }
    });

    // Pair begins with ends
    let beginPtr = 0;
    let endPtr = 0;
    while (beginPtr < tableBeginIndices.length && endPtr < tableEndIndices.length) {
      const bIdx = tableBeginIndices[beginPtr];
      const eIdx = tableEndIndices[endPtr];

      if (eIdx >= bIdx) {
        // Complete tabular block found
        for (let l = bIdx; l <= eIdx; l++) {
          linesCoveredByTableNotice.add(l);
        }
        if (config.builtInProcessors.tableDetection.flagCompleteTabularBlocks) {
          notices.push({
            id: `notice-table-block-${noticeCounter++}`,
            type: 'suspicious_syntax',
            message:
              'Detected complete LaTeX tabular block (worksheet rubric/table structure); preserved for review without alteration.',
            matchedText: lines.slice(bIdx, eIdx + 1).join('\n').slice(0, 80),
            lineIndex: bIdx,
            lineNumber: bIdx + 1,
            sourceContext: lines[bIdx],
          });
        }
        beginPtr++;
        endPtr++;
      } else {
        // Orphan \end{tabular} before any \begin{tabular}
        if (config.builtInProcessors.tableDetection.flagIncompleteTabularBlocks) {
          notices.push({
            id: `notice-orphan-end-tabular-${noticeCounter++}`,
            type: 'suspicious_syntax',
            message:
              'Orphan LaTeX \\end{tabular} without matching \\begin{tabular}.',
            matchedText: '\\end{tabular}',
            lineIndex: eIdx,
            lineNumber: eIdx + 1,
            sourceContext: lines[eIdx],
          });
        }
        endPtr++;
      }
    }

    // Remaining unclosed \begin{tabular}
    while (beginPtr < tableBeginIndices.length) {
      const bIdx = tableBeginIndices[beginPtr];
      if (config.builtInProcessors.tableDetection.flagIncompleteTabularBlocks) {
        notices.push({
          id: `notice-unclosed-begin-tabular-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message:
            'Unclosed LaTeX tabular environment (incomplete table structure).',
          matchedText: '\\begin{tabular}',
          lineIndex: bIdx,
          lineNumber: bIdx + 1,
          sourceContext: lines[bIdx],
        });
      }
      beginPtr++;
    }

    // Remaining orphan \end{tabular}
    while (endPtr < tableEndIndices.length) {
      const eIdx = tableEndIndices[endPtr];
      if (config.builtInProcessors.tableDetection.flagIncompleteTabularBlocks) {
        notices.push({
          id: `notice-orphan-end-tabular-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message:
            'Orphan LaTeX \\end{tabular} without matching \\begin{tabular}.',
          matchedText: '\\end{tabular}',
          lineIndex: eIdx,
          lineNumber: eIdx + 1,
          sourceContext: lines[eIdx],
        });
      }
      endPtr++;
    }
  }

  // --- Step 2: Line-by-line checks ---
  const activeReviewRules = config.rules.filter(
    (r) => r.enabled && r.action === 'review_notice'
  );

  const pageLabelRegex = config.builtInProcessors.pageNumberLabels.enabled
    ? new RegExp(config.builtInProcessors.pageNumberLabels.pattern, 'i')
    : null;

  lines.forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // If this line is part of an already-flagged complete tabular block, suppress inner notices
    const isInsideCoveredTable = linesCoveredByTableNotice.has(lineIndex);

    // --- Check 2A: Active user-configured review rules ---
    for (const rule of activeReviewRules) {
      let isMatch = false;

      if (rule.scope === 'whole_line_exact') {
        isMatch = rule.caseSensitive
          ? trimmed === rule.matchLiteral
          : trimmed.toLowerCase() === (rule.matchLiteral || '').toLowerCase();
      } else if (rule.scope === 'whole_line_prefix') {
        isMatch = rule.caseSensitive
          ? trimmed.startsWith(rule.matchLiteral || '')
          : trimmed.toLowerCase().startsWith((rule.matchLiteral || '').toLowerCase());
      } else if (rule.scope === 'literal_sequence') {
        isMatch = rule.caseSensitive
          ? rawLine.includes(rule.matchLiteral || '')
          : rawLine.toLowerCase().includes((rule.matchLiteral || '').toLowerCase());
      }

      if (isMatch) {
        notices.push({
          id: `notice-rule-${rule.id}-${noticeCounter++}`,
          type: rule.noticeType || 'worksheet_boilerplate',
          message: rule.message || rule.description,
          matchedText: rule.matchLiteral || trimmed,
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
        // If matched a whole line boilerplate rule, skip to next line
        if (rule.scope === 'whole_line_exact' || rule.scope === 'whole_line_prefix') {
          return;
        }
      }
    }

    // --- Check 2B: Standalone page number labels ---
    if (pageLabelRegex && pageLabelRegex.test(trimmed)) {
      notices.push({
        id: `notice-page-label-${noticeCounter++}`,
        type: 'worksheet_boilerplate',
        message: `Suspected standalone page label: "${trimmed}"`,
        matchedText: trimmed,
        lineIndex,
        lineNumber: lineIndex + 1,
        sourceContext: rawLine,
      });
      return;
    }

    // --- Check 2C: Standalone X/x tokens ---
    if (config.builtInProcessors.standaloneX.enabled) {
      // Rule 2Ca: Standalone line
      if (
        config.builtInProcessors.standaloneX.flagStandaloneLine &&
        /^[Xx][.,!?]?$/.test(trimmed)
      ) {
        notices.push({
          id: `notice-skip-${noticeCounter++}`,
          type: 'skip_line_marker',
          message: `Suspected student "skip a line" marker on standalone line: "${trimmed}"`,
          matchedText: trimmed,
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
        return;
      }

      // Rule 2Cb: Isolated X in sentence (never inside words like Next, six, excited, fox)
      if (config.builtInProcessors.standaloneX.flagIsolatedInProse) {
        const isolatedXRegex = /(?:^|[\s.,!?;:()[\]{}"'“”])([Xx])(?=[\s.,!?;:()[\]{}"'“”]|$)/g;
        let xMatch: RegExpExecArray | null;
        while ((xMatch = isolatedXRegex.exec(rawLine)) !== null) {
          const token = xMatch[1];
          notices.push({
            id: `notice-isolated-x-${noticeCounter++}`,
            type: 'skip_line_marker',
            message: `Isolated '${token}' token in sentence (possible merged margin/skip-line marker)`,
            matchedText: token,
            lineIndex,
            lineNumber: lineIndex + 1,
            sourceContext: rawLine,
          });
        }
      }
    }

    // --- Check 2D: Table-specific residual commands outside covered table blocks ---
    if (config.builtInProcessors.tableDetection.enabled && !isInsideCoveredTable) {
      if (
        config.builtInProcessors.tableDetection.flagResidualCommands &&
        /\\hline\b/.test(rawLine)
      ) {
        notices.push({
          id: `notice-residual-hline-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message: 'Residual LaTeX table horizontal line command: \\hline',
          matchedText: '\\hline',
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }

      if (
        config.builtInProcessors.tableDetection.flagResidualCommands &&
        /\\multicolumn\b/.test(rawLine)
      ) {
        notices.push({
          id: `notice-residual-multicolumn-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message:
            'Residual LaTeX table column spanning command: \\multicolumn',
          matchedText: rawLine.slice(0, 40),
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }

      if (
        config.builtInProcessors.tableDetection.flagTableSeparators &&
        /&\s*\\multicolumn/.test(rawLine)
      ) {
        notices.push({
          id: `notice-residual-separator-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message: 'Residual table column separator with \\multicolumn',
          matchedText: rawLine.slice(0, 40),
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }

      // Standalone \\ or trailing \\ representing tabular row break
      if (
        config.builtInProcessors.tableDetection.flagTableSeparators &&
        /^\s*\\\\\s*$/.test(rawLine)
      ) {
        notices.push({
          id: `notice-standalone-row-break-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message: 'Residual LaTeX row break / newline command: \\\\',
          matchedText: '\\\\',
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }
    }

    // --- Check 2E: Remaining suspicious LaTeX syntax or unexplained symbols ---
    if (!isInsideCoveredTable) {
      // Unhandled backslash commands: e.g. \frac, \sqrt, \alpha, \begin, etc.
      const remainingBackslashCommands = rawLine.match(/\\[a-zA-Z]+/g);
      if (remainingBackslashCommands) {
        for (const cmd of remainingBackslashCommands) {
          // Ignore commands already flagged as table notices
          if (cmd === '\\begin' || cmd === '\\end' || cmd === '\\hline' || cmd === '\\multicolumn') {
            continue;
          }
          notices.push({
            id: `notice-syntax-${noticeCounter++}`,
            type: 'suspicious_syntax',
            message: `Unhandled LaTeX syntax: "${cmd}"`,
            matchedText: cmd,
            lineIndex,
            lineNumber: lineIndex + 1,
            sourceContext: rawLine,
          });
        }
      }

      // Unclosed display/inline wrappers on this line
      if (/\\\[|\\\]|\\\(|\\\)/.test(rawLine)) {
        notices.push({
          id: `notice-unclosed-wrapper-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message: `Unresolved LaTeX math wrapper syntax on line ${lineIndex + 1}`,
          matchedText: rawLine.slice(0, 30),
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }

      // Unbalanced curly braces on this line
      let openB = 0;
      let closeB = 0;
      for (let c = 0; c < rawLine.length; c++) {
        if (rawLine[c] === '{' && (c === 0 || rawLine[c - 1] !== '\\')) openB++;
        if (rawLine[c] === '}' && (c === 0 || rawLine[c - 1] !== '\\')) closeB++;
      }
      if (openB !== closeB) {
        notices.push({
          id: `notice-brace-${noticeCounter++}`,
          type: 'suspicious_syntax',
          message: `Unbalanced curly braces on line ${lineIndex + 1}`,
          matchedText: rawLine.slice(0, 30),
          lineIndex,
          lineNumber: lineIndex + 1,
          sourceContext: rawLine,
        });
      }
    }
  });

  return notices;
}

/**
 * Combined OCR transcript normalization result.
 */
export interface NormalizedOcrResult {
  normalizedText: string;
  notices: OcrReviewNotice[];
}

/**
 * Normalizes an OCR transcript and detects non-blocking review notices.
 * Pure, unit-testable, and idempotent.
 */
export function normalizeOcrTranscript(
  rawTranscript: string,
  config: OcrRulesConfig = DEFAULT_OCR_RULES_CONFIG
): NormalizedOcrResult {
  if (!rawTranscript) {
    return { normalizedText: '', notices: [] };
  }

  const normalizedText = normalizeOcrFormat(rawTranscript, config);
  const notices = detectReviewNotices(normalizedText, config);

  return {
    normalizedText,
    notices,
  };
}
