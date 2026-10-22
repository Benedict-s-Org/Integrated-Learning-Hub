import {
  MarkingFinding,
  RubricDimension,
  StructuredAssessmentComments,
} from '../types';
import {
  buildTranscriptParagraphStructure,
  resolveFindingLocation,
} from './markingTextAlignment';

export interface MarkdownReportOptions {
  assignmentTitle?: string;
  classId?: string;
  studentNumber?: number;
  studentName?: string;
  isApproved?: boolean;
  totalScore: number;
  maxPossibleScore: number;
  rubric: RubricDimension[];
  scores: Record<string, number>;
  feedbackComment?: string;
  assessmentComments?: StructuredAssessmentComments;
  transcriptText?: string;
  findings?: MarkingFinding[];
}

export interface AnnotatedTranscriptResult {
  annotatedText: string;
  unresolvedFindings: MarkingFinding[];
}

/**
 * Generates a safe, cross-platform filename for the exported Markdown report,
 * preserving UTF-8 student names and replacing unsafe OS characters.
 */
export function generateSafeMarkdownFilename(
  assignmentTitle?: string,
  classId?: string,
  classNumber?: number,
  studentName?: string
): string {
  const sanitize = (str: string) =>
    str
      .replace(/[<>:"/\\|?*#%\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .trim();

  const parts: string[] = [];
  if (assignmentTitle) parts.push(sanitize(assignmentTitle));
  if (classId) parts.push(sanitize(classId));
  if (classNumber !== undefined && classNumber !== null && !isNaN(classNumber)) {
    parts.push(`No${String(classNumber).padStart(2, '0')}`);
  }
  if (studentName) parts.push(sanitize(studentName));

  const baseName = parts.filter(Boolean).join('_') || 'Writing_Report';
  return `${baseName}.md`;
}

/**
 * Builds the annotated student text with $original$ %correction% markers
 * strictly anchored to exact source ranges in the verified transcript.
 */
export function annotateTranscriptWithCorrections(
  transcript: string,
  findings: MarkingFinding[]
): AnnotatedTranscriptResult {
  if (!transcript) {
    return { annotatedText: '', unresolvedFindings: [] };
  }

  const rawLines = transcript.replace(/\r\n/g, '\n').split('\n');
  const structure = buildTranscriptParagraphStructure(rawLines);

  const usedSpansByLine = new Map<number, Array<{ start: number; end: number }>>();
  const lineFindingsMap = new Map<
    number,
    Array<{ finding: MarkingFinding; startIndex: number; endIndex: number }>
  >();
  const unresolvedFindings: MarkingFinding[] = [];

  for (const finding of findings) {
    // 1. Insertion-only correction (no original student text)
    const isInsertion =
      !finding.originalText ||
      finding.originalText.trim() === '' ||
      finding.originalText.trim().toUpperCase() === 'EMPTY';

    if (isInsertion) {
      if (typeof finding.lineIndex === 'number' && rawLines[finding.lineIndex] !== undefined) {
        const lineIdx = finding.lineIndex;
        const lineText = rawLines[lineIdx];
        const start = Math.min((finding as any).startIndex ?? lineText.length, lineText.length);
        const list = lineFindingsMap.get(lineIdx) || [];
        list.push({ finding, startIndex: start, endIndex: start });
        lineFindingsMap.set(lineIdx, list);
        continue;
      } else {
        unresolvedFindings.push(finding);
        continue;
      }
    }

    // 2. Standard or deletion correction with original quote
    const loc = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);
    if (loc) {
      const list = lineFindingsMap.get(loc.rawLineIndex) || [];
      list.push({ finding, startIndex: loc.startIndex, endIndex: loc.endIndex });
      lineFindingsMap.set(loc.rawLineIndex, list);

      const spans = usedSpansByLine.get(loc.rawLineIndex) || [];
      spans.push({ start: loc.startIndex, end: loc.endIndex });
      usedSpansByLine.set(loc.rawLineIndex, spans);
    } else {
      unresolvedFindings.push(finding);
    }
  }

  // Reconstruct each line with exact literal inline markers
  const annotatedLines: string[] = rawLines.map((lineText, lineIdx) => {
    const assignedFindings = lineFindingsMap.get(lineIdx);
    if (!assignedFindings || assignedFindings.length === 0) {
      return lineText;
    }

    // Sort findings on this line by startIndex ascending
    assignedFindings.sort((a, b) => a.startIndex - b.startIndex);

    let cursor = 0;
    let lineOut = '';

    for (let i = 0; i < assignedFindings.length; i++) {
      const item = assignedFindings[i];

      // If overlapping with previously processed span on this line, protect text and flag as unresolved
      if (item.startIndex < cursor) {
        unresolvedFindings.push(item.finding);
        continue;
      }

      // Append preceding unchanged text
      if (item.startIndex > cursor) {
        lineOut += lineText.slice(cursor, item.startIndex);
      }

      // Determine original quoted text
      let orig = item.finding.originalText;
      if (!orig || orig.trim() === '' || orig.trim().toUpperCase() === 'EMPTY') {
        orig = 'EMPTY';
      } else {
        // Use exact slice from raw transcript line to maintain student's exact text
        orig = lineText.slice(item.startIndex, item.endIndex);
      }

      // Determine correction text
      let repl = item.finding.teacherCustomText || item.finding.replacementText || '';
      const cleanRepl = repl.trim();
      if (
        !cleanRepl ||
        cleanRepl.toLowerCase() === '(delete)' ||
        cleanRepl.toUpperCase() === 'EMPTY'
      ) {
        repl = 'EMPTY';
      } else {
        repl = cleanRepl;
      }

      // Literal markers: $original$ %correction%
      lineOut += `$${orig}$ %${repl}%`;

      // If this was an insertion (orig === 'EMPTY') and next character is not whitespace or punctuation,
      // add a trailing space so the inserted word does not run into the following text
      if (
        orig === 'EMPTY' &&
        item.endIndex < lineText.length &&
        lineText[item.endIndex] !== ' ' &&
        !/^[.,!?;:'")]/.test(lineText[item.endIndex])
      ) {
        lineOut += ' ';
      }

      cursor = item.endIndex;
    }

    // Append remaining unchanged text on this line
    if (cursor < lineText.length) {
      lineOut += lineText.slice(cursor);
    }

    return lineOut;
  });

  return {
    annotatedText: annotatedLines.join('\n'),
    unresolvedFindings,
  };
}

/**
 * Exports the complete student report as a formatted UTF-8 Markdown document.
 */
export function generateStudentMarkdownReport(options: MarkdownReportOptions): string {
  const {
    assignmentTitle = 'Writing Assessment',
    classId = '',
    studentNumber,
    studentName = 'Student',
    isApproved = false,
    totalScore,
    maxPossibleScore,
    rubric = [],
    scores = {},
    feedbackComment = '',
    assessmentComments,
    transcriptText = '',
    findings = [],
  } = options;

  // Filter out rejected findings; collect needs_review items for the review list
  const needsReviewFindings = findings.filter((f) => f.decision === 'needs_review');
  const activeFindings = findings.filter(
    (f) => f.decision !== 'rejected' && f.decision !== 'needs_review'
  );

  // Eligible inline corrections: required corrections that are accepted, edited,
  // or pending (Review Marking displays pending AI corrections inline; report
  // approval does not change individual finding decisions).
  const eligibleCorrections = activeFindings.filter((f) => {
    const isCorrection = !f.feedbackType || f.feedbackType === 'correction';
    return isCorrection && (f.decision === 'accepted' || f.decision === 'edited' || f.decision === 'pending');
  });

  // Reference suggestions: optional improvements and clarity/coherence
  const optionalImprovements = activeFindings.filter(
    (f) => f.feedbackType === 'improvement'
  );

  const claritySuggestions = activeFindings.filter(
    (f) => f.feedbackType === 'clarity'
  );

  // Annotate transcript with corrections
  const { annotatedText, unresolvedFindings } = annotateTranscriptWithCorrections(
    transcriptText,
    eligibleCorrections
  );

  // needs_review items are listed under Unresolved Review Items (requiring
  // review) rather than being silently dropped or rendered as confirmed.
  const allReviewItems = [...unresolvedFindings, ...needsReviewFindings];

  let md = '';

  // Document Header
  md += `# LEARNING HUB — WRITING FEEDBACK REPORT\n\n`;

  // Assignment & Student Metadata
  md += `## Assignment Information\n`;
  md += `- **Assignment:** ${assignmentTitle}\n`;
  if (classId) {
    md += `- **Class:** ${classId}${studentNumber ? ` · No. ${String(studentNumber).padStart(2, '0')}` : ''}\n`;
  }
  md += `- **Student:** ${studentName}\n`;
  md += `- **Evaluation Status:** ${isApproved ? 'Teacher Approved' : 'Draft / Unapproved'}\n`;
  md += `- **Overall Score:** ${totalScore} / ${maxPossibleScore}\n\n`;

  // Rubric Dimension Breakdown
  if (rubric.length > 0) {
    md += `## Rubric Dimension Breakdown\n`;
    rubric.forEach((dim) => {
      const s = scores[dim.id] ?? 0;
      md += `- **${dim.name}:** ${s} / ${dim.maxScore}\n`;
    });
    md += `\n`;
  }

  // Teacher Feedback Commentary
  md += `## Teacher Feedback\n`;
  if (assessmentComments) {
    md += `### Strengths & Highlights\n${assessmentComments.positive || 'None recorded.'}\n\n`;
    md += `### Areas for Improvement\n${assessmentComments.relevant || 'None recorded.'}\n\n`;
    md += `### Next Steps for Writing\n${assessmentComments.finalNextStep || 'None recorded.'}\n\n`;
  }
  md += `${feedbackComment.trim() || 'No written commentary entered yet.'}\n\n`;

  // Verified Student Writing (Annotated)
  md += `## Verified Student Writing (Annotated)\n\n`;
  md += `> **Inline Marker Legend:**\n`;
  md += `> - \`$original$\`: Erroneous original text written by the student.\n`;
  md += `> - \`%correction%\`: Suggested teacher / AI correction.\n`;
  md += `> - \`EMPTY\`: Indicates no original text (insertion) or no replacement text (deletion).\n\n`;

  md += `\`\`\`text\n`;
  md += `${annotatedText}\n`;
  md += `\`\`\`\n\n`;

  // Optional Improvements (Purple)
  if (optionalImprovements.length > 0) {
    md += `## Optional Improvements\n`;
    optionalImprovements.forEach((f, idx) => {
      const locStr = typeof f.lineIndex === 'number' ? `Line ${f.lineIndex + 1}` : 'General';
      const phrasing = f.teacherCustomText || f.replacementText || '';
      md += `${idx + 1}. **[${locStr}]** "${f.originalText}" → suggested phrasing: (${phrasing})\n`;
      if (f.explanation || f.teacherCustomText) {
        md += `   - Note: ${f.teacherCustomText || f.explanation}\n`;
      }
    });
    md += `\n`;
  }

  // Clarity / Coherence Suggestions (Blue)
  if (claritySuggestions.length > 0) {
    md += `## Clarity & Coherence Suggestions\n`;
    claritySuggestions.forEach((f, idx) => {
      const locStr = typeof f.lineIndex === 'number' ? `Line ${f.lineIndex + 1}` : 'General';
      const suggestion = f.teacherCustomText || f.replacementText || 'Clarification needed';
      md += `${idx + 1}. **[${locStr}]** "${f.originalText}" → suggestion: (${suggestion})\n`;
      if (f.explanation || f.teacherCustomText) {
        md += `   - Note: ${f.teacherCustomText || f.explanation}\n`;
      }
    });
    md += `\n`;
  }

  // Unresolved Review Items
  if (allReviewItems.length > 0) {
    md += `## Unresolved Review Items\n`;
    md += `The following items could not be unambiguously anchored to the transcript, conflicted with another range, or require teacher review. The original student text has been left intact:\n`;
    allReviewItems.forEach((f, idx) => {
      const locStr = typeof f.lineIndex === 'number' ? `Line ${f.lineIndex + 1}` : 'Unspecified Line';
      const repl = f.teacherCustomText || f.replacementText || '(delete)';
      md += `${idx + 1}. **[${locStr}]** "${f.originalText}" → "${repl}"\n`;
      if (f.explanation || f.reviewReason) {
        md += `   - Reason: ${f.reviewReason || f.explanation}\n`;
      }
    });
    md += `\n`;
  }

  return md;
}

/**
 * Triggers a browser download of the Markdown file.
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
