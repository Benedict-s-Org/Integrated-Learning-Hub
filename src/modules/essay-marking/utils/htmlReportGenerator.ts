import {
  AssignmentConfig,
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  StudentTranscriptState,
  RubricDimension,
  MarkingFinding,
} from '../types';
import {
  buildTranscriptParagraphStructure,
  resolveFindingLocation,
} from './markingTextAlignment';

export interface AllStudentsHtmlReportOptions {
  assignment: AssignmentConfig;
  classId: string;
  students: StudentRosterItem[];
  assignedIndices: number[];
  rubric: RubricDimension[];
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  exportTimestamp?: Date;
}

export interface HtmlWritingWordSegment {
  type: 'text' | 'correction' | 'insertion' | 'deletion';
  original: string;
  replacement: string;
  finding?: MarkingFinding;
}

/**
 * Escapes raw strings for safe HTML interpolation to prevent XSS vulnerabilities.
 */
export function escapeHtml(str?: string | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a safe, cross-platform filename for the exported all-reports HTML file,
 * containing the assignment title, class ID, and an export timestamp.
 */
export function generateSafeHtmlReportFilename(
  assignmentTitle?: string,
  classId?: string,
  date: Date = new Date()
): string {
  const sanitize = (str: string) =>
    str
      .replace(/[<>:"/\\|?*#%\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .trim();

  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`;

  const parts: string[] = [];
  if (assignmentTitle) parts.push(sanitize(assignmentTitle));
  if (classId) parts.push(sanitize(classId));
  parts.push('All_Reports');
  parts.push(timestamp);

  const baseName = parts.filter(Boolean).join('_') || 'Writing_Assessment_All_Reports';
  return `${baseName}.html`;
}

/**
 * Builds the annotated writing HTML for a single student.
 * Places dedicated annotation rows above each source line, formats corrections in green,
 * clarity in blue, improvements in purple, errors in red strikethrough, and handles tooltips/notes.
 */
export function buildAnnotatedWritingHtml(
  transcriptText: string,
  findings: MarkingFinding[],
  studentId: string
): { html: string; unresolvedFindings: MarkingFinding[] } {
  if (!transcriptText || !transcriptText.trim()) {
    return {
      html: '<p class="text-muted italic">No verified transcript available for this student.</p>',
      unresolvedFindings: [],
    };
  }

  const rawLines = transcriptText.replace(/\r\n/g, '\n').split('\n');
  const structure = buildTranscriptParagraphStructure(rawLines);

  const usedSpansByLine = new Map<number, Array<{ start: number; end: number }>>();
  const wordCorrectionsByLine = new Map<
    number,
    Array<{
      finding: MarkingFinding;
      startIndex: number;
      endIndex: number;
      isInsertion: boolean;
    }>
  >();
  const sentenceSuggestionsByLine = new Map<number, MarkingFinding[]>();
  const unresolvedFindings: MarkingFinding[] = [];

  // Filter out rejected and needs_review findings from active annotations
  const activeFindings = (findings || []).filter(
    (f) => f.decision !== 'rejected' && f.decision !== 'needs_review'
  );

  for (const finding of activeFindings) {
    const feedbackType = finding.feedbackType || 'correction';

    // 1. Sentence-level suggestions (clarity / improvement)
    if (feedbackType === 'clarity' || feedbackType === 'improvement') {
      let lineIdx: number | null = null;
      if (typeof finding.lineIndex === 'number' && rawLines[finding.lineIndex] !== undefined) {
        lineIdx = finding.lineIndex;
      } else if (finding.originalText) {
        const loc = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);
        if (loc) lineIdx = loc.rawLineIndex;
      }

      if (lineIdx !== null) {
        const list = sentenceSuggestionsByLine.get(lineIdx) || [];
        list.push(finding);
        sentenceSuggestionsByLine.set(lineIdx, list);
      } else {
        unresolvedFindings.push(finding);
      }
      continue;
    }

    // 2. Required word-level corrections (only accepted or edited)
    if (finding.decision !== 'accepted' && finding.decision !== 'edited') {
      continue;
    }

    const isInsertion =
      !finding.originalText ||
      finding.originalText.trim() === '' ||
      finding.originalText.trim().toUpperCase() === 'EMPTY';

    if (isInsertion) {
      if (typeof finding.lineIndex === 'number' && rawLines[finding.lineIndex] !== undefined) {
        const lineIdx = finding.lineIndex;
        const lineText = rawLines[lineIdx];
        const explicitStart = (finding as any).startIndex;
        const start = Math.min(
          typeof explicitStart === 'number' ? explicitStart : lineText.length,
          lineText.length
        );
        const list = wordCorrectionsByLine.get(lineIdx) || [];
        list.push({ finding, startIndex: start, endIndex: start, isInsertion: true });
        wordCorrectionsByLine.set(lineIdx, list);
      } else {
        unresolvedFindings.push(finding);
      }
      continue;
    }

    // Teacher explicit range check
    const explicitStart = (finding as any).startIndex;
    const explicitEnd = (finding as any).endIndex;
    if (
      typeof explicitStart === 'number' &&
      typeof explicitEnd === 'number' &&
      typeof finding.lineIndex === 'number' &&
      rawLines[finding.lineIndex] !== undefined &&
      explicitStart <= explicitEnd &&
      explicitEnd <= rawLines[finding.lineIndex].length
    ) {
      const lineIdx = finding.lineIndex;
      const spans = usedSpansByLine.get(lineIdx) || [];
      const overlaps = spans.some((s) => explicitStart < s.end && explicitEnd > s.start);
      if (!overlaps) {
        const list = wordCorrectionsByLine.get(lineIdx) || [];
        list.push({
          finding,
          startIndex: explicitStart,
          endIndex: explicitEnd,
          isInsertion: false,
        });
        wordCorrectionsByLine.set(lineIdx, list);
        spans.push({ start: explicitStart, end: explicitEnd });
        usedSpansByLine.set(lineIdx, spans);
        continue;
      }
    }

    // Standard location resolution
    const loc = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);
    if (loc) {
      const list = wordCorrectionsByLine.get(loc.rawLineIndex) || [];
      list.push({
        finding,
        startIndex: loc.startIndex,
        endIndex: loc.endIndex,
        isInsertion: false,
      });
      wordCorrectionsByLine.set(loc.rawLineIndex, list);

      const spans = usedSpansByLine.get(loc.rawLineIndex) || [];
      spans.push({ start: loc.startIndex, end: loc.endIndex });
      usedSpansByLine.set(loc.rawLineIndex, spans);
    } else {
      unresolvedFindings.push(finding);
    }
  }

  // Render HTML lines
  const linesHtml: string[] = [];

  rawLines.forEach((lineText, lineIdx) => {
    // Blank line (paragraph break)
    if (lineText.trim() === '') {
      linesHtml.push('<div class="writing-paragraph-break" aria-hidden="true"></div>');
      return;
    }

    const suggestions = sentenceSuggestionsByLine.get(lineIdx) || [];
    const corrections = (wordCorrectionsByLine.get(lineIdx) || []).sort(
      (a, b) => a.startIndex - b.startIndex
    );

    const segments: HtmlWritingWordSegment[] = [];
    let cursor = 0;

    for (const item of corrections) {
      // Overlap protection
      if (item.startIndex < cursor && !item.isInsertion) {
        unresolvedFindings.push(item.finding);
        continue;
      }

      if (item.startIndex > cursor) {
        segments.push({
          type: 'text',
          original: lineText.slice(cursor, item.startIndex),
          replacement: '',
        });
      }

      const replRaw = item.finding.teacherCustomText || item.finding.replacementText || '';
      const cleanRepl = replRaw.trim();
      const isDeletion =
        !cleanRepl || cleanRepl.toLowerCase() === '(delete)' || cleanRepl.toUpperCase() === 'EMPTY';

      if (item.isInsertion) {
        segments.push({
          type: 'insertion',
          original: '^',
          replacement: cleanRepl,
          finding: item.finding,
        });
        cursor = item.startIndex;
      } else if (isDeletion) {
        segments.push({
          type: 'deletion',
          original: lineText.slice(item.startIndex, item.endIndex),
          replacement: '',
          finding: item.finding,
        });
        cursor = item.endIndex;
      } else {
        segments.push({
          type: 'correction',
          original: lineText.slice(item.startIndex, item.endIndex),
          replacement: cleanRepl,
          finding: item.finding,
        });
        cursor = item.endIndex;
      }
    }

    if (cursor < lineText.length) {
      segments.push({
        type: 'text',
        original: lineText.slice(cursor),
        replacement: '',
      });
    }

    const hasCorrections = segments.some((s) => s.type !== 'text');

    let lineBlockHtml = '<div class="writing-line-unit">';

    // 1. Sentence Suggestions Row(s)
    for (const sugg of suggestions) {
      const isClarity = sugg.feedbackType === 'clarity';
      const badgeText = isClarity ? 'Clarity & Coherence' : 'Optional Improvement';
      const badgeClass = isClarity ? 'badge-clarity' : 'badge-improvement';
      const textClass = isClarity ? 'text-clarity' : 'text-improvement';

      let text = sugg.teacherCustomText || sugg.replacementText || sugg.explanation || '';
      text = text.trim();
      if (!text.startsWith('(') || !text.endsWith(')')) {
        text = `(${text})`;
      }

      const reason = sugg.teacherCustomText || sugg.explanation || '';

      lineBlockHtml += `
        <div class="sentence-suggestion-row">
          <span class="has-explanation ${textClass}" tabindex="0" role="button" aria-haspopup="true">
            <span class="suggestion-text">${escapeHtml(text)}</span>
            <span class="feedback-popover" role="tooltip">
              <span class="popover-badge ${badgeClass}">${escapeHtml(badgeText)} · ${escapeHtml(sugg.type)}</span>
              ${reason ? `<span class="popover-reason">${escapeHtml(reason)}</span>` : ''}
            </span>
          </span>
        </div>`;
    }

    // 2. Word corrections & Student line table
    if (hasCorrections) {
      lineBlockHtml += '<table class="writing-table"><tr class="annotation-row">';

      // Top row (corrections)
      segments.forEach((seg) => {
        if (seg.type === 'correction' || seg.type === 'insertion') {
          const badgeText = seg.type === 'insertion' ? 'Missing Word' : seg.finding?.type || 'Correction';
          const reason = seg.finding?.teacherCustomText || seg.finding?.explanation || '';

          lineBlockHtml += `
            <td class="corr-cell">
              <span class="has-explanation text-correction font-bold" tabindex="0" role="button" aria-haspopup="true">
                <span class="corr-text">${escapeHtml(seg.replacement)}</span>
                <span class="feedback-popover" role="tooltip">
                  <span class="popover-badge badge-correction">Correction · ${escapeHtml(badgeText)}</span>
                  ${reason ? `<span class="popover-reason">${escapeHtml(reason)}</span>` : ''}
                </span>
              </span>
            </td>`;
        } else {
          lineBlockHtml += '<td class="empty-top-cell">&nbsp;</td>';
        }
      });

      lineBlockHtml += '</tr><tr class="student-baseline-row">';

      // Bottom row (student text)
      segments.forEach((seg) => {
        if (seg.type === 'text') {
          lineBlockHtml += `<td class="orig-text-cell">${escapeHtml(seg.original)}</td>`;
        } else if (seg.type === 'correction' || seg.type === 'deletion') {
          const reason = seg.finding?.teacherCustomText || seg.finding?.explanation || '';
          const badgeText = seg.type === 'deletion' ? 'Unnecessary Word' : seg.finding?.type || 'Grammar';

          lineBlockHtml += `
            <td class="error-cell">
              <span class="has-explanation text-error line-through font-medium" tabindex="0" role="button" aria-haspopup="true">
                <span class="orig-error-text">${escapeHtml(seg.original)}</span>
                <span class="feedback-popover" role="tooltip">
                  <span class="popover-badge badge-error">Error · ${escapeHtml(badgeText)}</span>
                  ${reason ? `<span class="popover-reason">${escapeHtml(reason)}</span>` : ''}
                </span>
              </span>
            </td>`;
        } else if (seg.type === 'insertion') {
          const reason = seg.finding?.teacherCustomText || seg.finding?.explanation || '';

          lineBlockHtml += `
            <td class="insertion-caret-cell">
              <span class="has-explanation text-correction font-bold caret-marker" tabindex="0" role="button" aria-haspopup="true">
                ^
                <span class="feedback-popover" role="tooltip">
                  <span class="popover-badge badge-correction">Insertion Point</span>
                  ${reason ? `<span class="popover-reason">${escapeHtml(reason)}</span>` : ''}
                </span>
              </span>
            </td>`;
        }
      });

      lineBlockHtml += '</tr></table>';
    } else {
      // Line with NO word corrections
      lineBlockHtml += '<table class="writing-table">';

      // If no sentence suggestions either, output dedicated blank annotation row
      if (suggestions.length === 0) {
        lineBlockHtml += '<tr class="annotation-row"><td class="blank-annotation-cell">&nbsp;</td></tr>';
      }

      lineBlockHtml += `
        <tr class="student-baseline-row">
          <td class="orig-text-cell single-line">${escapeHtml(lineText)}</td>
        </tr>
      </table>`;
    }

    lineBlockHtml += '</div>';
    linesHtml.push(lineBlockHtml);
  });

  return {
    html: linesHtml.join('\n'),
    unresolvedFindings,
  };
}

/**
 * Builds the standalone offline HTML document containing all student reports.
 */
export function generateAllStudentsHtmlReport(options: AllStudentsHtmlReportOptions): string {
  const {
    assignment,
    classId,
    students,
    assignedIndices,
    rubric,
    transcripts,
    markings,
    exportTimestamp = new Date(),
  } = options;

  const indices =
    assignedIndices && assignedIndices.length > 0
      ? assignedIndices
      : students.map((_, i) => i);

  // Compute stats
  const totalStudents = indices.length;
  const approvedCount = indices.reduce((count, idx) => {
    const s = students[idx];
    if (s && markings[s.id]?.isApproved) return count + 1;
    return count;
  }, 0);

  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  // Format date
  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedDate = `${exportTimestamp.getFullYear()}-${pad(exportTimestamp.getMonth() + 1)}-${pad(
    exportTimestamp.getDate()
  )} ${pad(exportTimestamp.getHours())}:${pad(exportTimestamp.getMinutes())}`;

  // Build Directory / Table of Contents
  let tocItemsHtml = '';
  indices.forEach((idx) => {
    const s = students[idx];
    if (!s) return;
    const marking = markings[s.id];
    const isApproved = marking?.isApproved ?? false;
    const hasMarking = !!marking;
    const statusText = isApproved ? '✓ Approved' : hasMarking ? 'Draft Report' : 'Pending Marking';
    const statusClass = isApproved ? 'status-approved' : hasMarking ? 'status-draft' : 'status-pending';

    tocItemsHtml += `
      <a href="#report-student-${escapeHtml(s.id)}" class="toc-card">
        <div class="toc-header">
          <span class="toc-number">No. ${String(s.classNumber).padStart(2, '0')}</span>
          <span class="toc-status-badge ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        <div class="toc-name">${escapeHtml(s.displayName)}</div>
      </a>`;
  });

  // Build Student Report Cards
  let studentCardsHtml = '';
  indices.forEach((idx) => {
    const s = students[idx];
    if (!s) return;

    const transcript = transcripts[s.id];
    const marking = markings[s.id];
    const isApproved = marking?.isApproved ?? false;
    const hasMarking = !!marking;
    const hasScores = !!marking && !!marking.scores && Object.keys(marking.scores).length > 0;

    const totalScore = rubric.reduce(
      (acc, dim) => acc + (marking?.scores?.[dim.id] ?? 0),
      0
    );

    // Filter accepted/teacher-edited corrections and active suggestions
    const approvedFindings = (marking?.findings || []).filter((f) => {
      if (f.decision === 'rejected') return false;
      if (f.feedbackType === 'improvement' || f.feedbackType === 'clarity') return true;
      return f.decision === 'accepted' || f.decision === 'edited';
    });

    const transcriptText = transcript?.editedText || transcript?.rawOcrText || '';

    const { html: writingHtml, unresolvedFindings } = buildAnnotatedWritingHtml(
      transcriptText,
      marking?.findings || [],
      s.id
    );

    // Status label
    const statusText = isApproved
      ? 'Teacher Approved'
      : hasMarking
      ? 'Draft Report'
      : 'Pending Marking';
    const statusClass = isApproved ? 'badge-approved' : hasMarking ? 'badge-draft' : 'badge-pending';

    // Rubric grid
    let rubricGridHtml = '';
    rubric.forEach((dim) => {
      const scoreVal = marking?.scores?.[dim.id];
      rubricGridHtml += `
        <div class="rubric-grid-item">
          <span class="rubric-dim-name">${escapeHtml(dim.name)}</span>
          <span class="rubric-dim-score font-bold">
            ${scoreVal !== undefined ? scoreVal : '—'} / ${dim.maxScore}
          </span>
        </div>`;
    });

    // Notes section
    let notesListHtml = '';
    if (approvedFindings.length === 0) {
      notesListHtml = '<p class="text-muted italic">No specific language corrections flagged.</p>';
    } else {
      approvedFindings.forEach((f, fIdx) => {
        const isClarity = f.feedbackType === 'clarity';
        const isImprovement = f.feedbackType === 'improvement';
        const typeBadge = isImprovement
          ? `Optional Improvement · ${f.type}`
          : isClarity
          ? `Clarity / Coherence · ${f.type}`
          : f.type;
        const badgeClass = isImprovement
          ? 'badge-improvement'
          : isClarity
          ? 'badge-clarity'
          : 'badge-error';

        const suggestionHtml =
          isImprovement || isClarity
            ? `suggested phrasing: <span class="${
                isImprovement ? 'text-improvement' : 'text-clarity'
              } font-semibold">(${escapeHtml(f.replacementText)})</span>`
            : `→ <span class="text-correction font-semibold">"${escapeHtml(f.replacementText)}"</span>`;

        const noteText = f.teacherCustomText || f.explanation || '';

        notesListHtml += `
          <div class="note-item">
            <span class="note-idx font-semibold">${fIdx + 1}.</span>
            <div class="note-body">
              <span class="note-badge ${badgeClass}">${escapeHtml(typeBadge)}</span>
              <span class="note-quote">"${escapeHtml(f.originalText)}"</span>
              ${suggestionHtml}
              ${noteText ? `<span class="note-reason">: ${escapeHtml(noteText)}</span>` : ''}
            </div>
          </div>`;
      });
    }

    // Unresolved section
    let unresolvedHtml = '';
    if (unresolvedFindings.length > 0) {
      unresolvedHtml = `
        <div class="unresolved-section">
          <h4 class="section-title text-amber font-bold">Unresolved Review Items</h4>
          <p class="section-subtitle">The following items could not be unambiguously anchored to the transcript or conflicted with another range. The original student text has been left intact:</p>
          <div class="space-y-1">
            ${unresolvedFindings
              .map(
                (f, uIdx) => `
              <div class="unresolved-item">
                <span class="font-bold">${uIdx + 1}. "${escapeHtml(f.originalText)}"</span>
                <span> → "${escapeHtml(f.teacherCustomText || f.replacementText || '(delete)')}"</span>
                <span class="text-muted italic">(${escapeHtml(f.explanation || f.reviewReason || 'Unanchored location')})</span>
              </div>`
              )
              .join('')}
          </div>
        </div>`;
    }

    studentCardsHtml += `
      <article id="report-student-${escapeHtml(s.id)}" class="report-card">
        <!-- Top Status Banner -->
        <div class="card-status-banner ${isApproved ? 'banner-approved' : hasMarking ? 'banner-draft' : 'banner-pending'}">
          <div class="status-banner-left">
            <span class="status-icon">${isApproved ? '✓' : '⚠'}</span>
            <span class="status-banner-text">
              ${
                isApproved
                  ? 'Teacher-approved evaluation.'
                  : hasMarking
                  ? 'Teacher approval is incomplete. This is a draft report.'
                  : 'Marking is pending for this student.'
              }
            </span>
          </div>
          <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
        </div>

        <!-- Student Header -->
        <header class="report-card-header">
          <div>
            <div class="assessment-subtag">Learning Hub · Writing Assessment</div>
            <h2 class="assessment-title">${escapeHtml(assignment.title || 'Untitled Writing Task')}</h2>
            <div class="student-meta">
              Class ${escapeHtml(classId)} · No. ${String(s.classNumber).padStart(2, '0')} · <strong class="student-name">${escapeHtml(s.displayName)}</strong>
            </div>
          </div>

          <div class="score-box">
            <div class="score-label">Overall Score</div>
            ${
              hasScores
                ? `<div class="score-display"><span class="score-num">${totalScore}</span><span class="score-max"> / ${maxPossibleScore}</span></div>`
                : '<div class="score-pending">Pending</div>'
            }
          </div>
        </header>

        <!-- Rubric Grid -->
        <div class="report-section">
          <h4 class="section-title">Rubric Dimension Breakdown</h4>
          <div class="rubric-grid">
            ${rubricGridHtml}
          </div>
        </div>

        <!-- Teacher Feedback Commentary -->
        <div class="report-section">
          <h4 class="section-title">Teacher Feedback</h4>
          <div class="feedback-commentary-box">
            ${escapeHtml(marking?.feedbackComment || 'No written commentary entered yet.')}
          </div>
        </div>

        <!-- Annotated Student Writing -->
        <div class="report-section">
          <h4 class="section-title">Annotated Student Writing</h4>
          <div class="annotated-writing-container">
            ${writingHtml}
          </div>
        </div>

        <!-- Specific Language & Accuracy Notes (Fallback for JS-disabled & Print) -->
        <div class="report-section notes-section">
          <h4 class="section-title">Specific Language &amp; Accuracy Notes</h4>
          <div class="notes-list">
            ${notesListHtml}
          </div>
        </div>

        <!-- Unresolved Items if any -->
        ${unresolvedHtml}

        <!-- Card Footer -->
        <footer class="report-card-footer">
          <span>Student ID: ${escapeHtml(s.id)}</span>
          <a href="#student-directory" class="back-to-top no-print">↑ Back to Directory</a>
        </footer>
      </article>`;
  });

  // Assemble full standalone HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(assignment.title || 'Writing Assessment')} — Class ${escapeHtml(classId)} All Reports</title>
  <style>
    /* Standalone Offline CSS Reset & Typography */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      line-height: 1.5;
      padding: 2rem 1rem;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header Summary Banner */
    .master-header {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .master-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }

    .master-subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 1rem;
    }

    .master-stats-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.875rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .stat-label {
      color: #64748b;
    }

    .stat-val {
      font-weight: 700;
      color: #0f172a;
    }

    /* Student Directory / Contents List */
    .directory-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .directory-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }

    .toc-card {
      display: block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.15s ease-in-out;
    }

    .toc-card:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .toc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }

    .toc-number {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
    }

    .toc-status-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .status-approved { background: #dcfce7; color: #15803d; }
    .status-draft { background: #fef3c7; color: #b45309; }
    .status-pending { background: #f1f5f9; color: #64748b; }

    .toc-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Marking Legend Box */
    .legend-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2.5rem;
      font-size: 0.825rem;
    }

    .legend-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    /* Report Card Container */
    .report-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 2.5rem;
      margin-bottom: 3rem;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      scroll-margin-top: 2rem;
    }

    /* Card Status Banner */
    .card-status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      margin-bottom: 1.5rem;
    }

    .banner-approved { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .banner-draft { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .banner-pending { background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; }

    .status-banner-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
    }

    .status-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .badge-approved { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-draft { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .badge-pending { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }

    /* Report Card Header */
    .report-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 1.5rem;
    }

    .assessment-subtag {
      font-size: 0.7rem;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.25rem;
    }

    .assessment-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }

    .student-meta {
      font-size: 0.825rem;
      color: #475569;
    }

    .student-name {
      color: #0f172a;
    }

    .score-box {
      text-align: right;
      flex-shrink: 0;
    }

    .score-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 0.15rem;
    }

    .score-display {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
    }

    .score-num {
      font-size: 2rem;
      font-weight: 800;
      color: #1d4ed8;
    }

    .score-max {
      font-size: 0.875rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .score-pending {
      font-size: 0.875rem;
      color: #94a3b8;
      font-style: italic;
    }

    /* Report Sections */
    .report-section {
      padding: 1.25rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .section-subtitle {
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 0.5rem;
    }

    /* Rubric Dimension Breakdown Grid */
    .rubric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .rubric-grid-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.6rem 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
    }

    .rubric-dim-name {
      color: #475569;
    }

    .rubric-dim-score {
      color: #0f172a;
    }

    /* Teacher Commentary */
    .feedback-commentary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.85rem;
      color: #334155;
      white-space: pre-line;
      line-height: 1.6;
    }

    /* Annotated Writing Layout & Typography */
    .annotated-writing-container {
      background: #ffffff;
      padding: 0.5rem 0;
      font-family: Georgia, Cambria, "Times New Roman", Times, serif;
    }

    .writing-line-unit {
      margin-bottom: 0.65rem;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .writing-paragraph-break {
      height: 1.25rem;
    }

    .sentence-suggestion-row {
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
    }

    .suggestion-text {
      font-style: italic;
    }

    .writing-table {
      border-collapse: collapse;
      border: none;
      width: auto;
      max-width: 100%;
    }

    .writing-table td {
      border: none;
      padding: 0 1px;
      vertical-align: bottom;
      font-size: 1rem;
      line-height: 1.4;
    }

    .annotation-row td {
      font-size: 0.875rem;
      padding-bottom: 2px;
      line-height: 1.2;
    }

    .student-baseline-row td {
      color: #000000;
    }

    .blank-annotation-cell {
      height: 1.1rem;
    }

    .empty-top-cell {
      height: 1.1rem;
    }

    .orig-text-cell {
      color: #000000;
      white-space: pre-wrap;
    }

    .single-line {
      white-space: pre-wrap;
    }

    /* Text & Badge Colors */
    .text-correction { color: #16a34a; }
    .text-error { color: #dc2626; }
    .text-clarity { color: #0284c7; }
    .text-improvement { color: #7c3aed; }
    .text-muted { color: #64748b; }

    .line-through { text-decoration: line-through; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .italic { font-style: italic; }

    .badge-correction { background: #dcfce7; color: #166534; }
    .badge-error { background: #fee2e2; color: #991b1b; }
    .badge-clarity { background: #e0f2fe; color: #075985; }
    .badge-improvement { background: #f3e8ff; color: #6b21a8; }

    /* Interactive Explanation Popovers */
    .has-explanation {
      position: relative;
      cursor: pointer;
      display: inline-block;
      outline: none;
    }

    .has-explanation:focus {
      outline: 2px solid #3b82f6;
      border-radius: 2px;
    }

    .feedback-popover {
      display: none;
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-style: normal;
      font-weight: 400;
      white-space: normal;
      width: max-content;
      max-width: 280px;
      z-index: 50;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      pointer-events: auto;
      text-align: left;
    }

    .feedback-popover::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px;
      border-style: solid;
      border-color: #0f172a transparent transparent transparent;
    }

    .popover-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      margin-bottom: 0.25rem;
    }

    .popover-reason {
      display: block;
      color: #cbd5e1;
      line-height: 1.35;
    }

    .has-explanation:hover .feedback-popover,
    .has-explanation:focus .feedback-popover,
    .feedback-popover.is-open {
      display: block;
    }

    /* Fallback Notes List */
    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.8rem;
    }

    .note-item {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
    }

    .note-body {
      color: #334155;
    }

    .note-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
      margin-right: 0.35rem;
    }

    .note-quote {
      font-weight: 600;
      color: #0f172a;
    }

    /* Unresolved Section */
    .unresolved-section {
      padding: 1rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .text-amber { color: #b45309; }

    .unresolved-item {
      font-size: 0.8rem;
      color: #334155;
      margin-bottom: 0.25rem;
    }

    /* Card Footer */
    .report-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #94a3b8;
      padding-top: 1.5rem;
    }

    .back-to-top {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }

    .back-to-top:hover {
      text-decoration: underline;
    }

    /* Print Stylesheet */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        font-size: 10.5pt;
      }

      .no-print {
        display: none !important;
      }

      .container {
        max-width: 100% !important;
        margin: 0 !important;
      }

      .report-card {
        page-break-before: always !important;
        break-before: page !important;
        border: none !important;
        border-bottom: 2px solid #0f172a !important;
        box-shadow: none !important;
        padding: 0 0 20mm 0 !important;
        margin: 0 !important;
      }

      .report-card:first-of-type {
        page-break-before: auto !important;
        break-before: auto !important;
      }

      .writing-line-unit {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .feedback-popover {
        display: none !important;
      }

      .notes-section {
        display: block !important;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="container" id="student-directory">
    <!-- Master Header -->
    <header class="master-header no-print">
      <h1 class="master-title">${escapeHtml(assignment.title || 'Writing Assessment')}</h1>
      <div class="master-subtitle">Class ${escapeHtml(classId)} · Comprehensive Offline Student Writing Evaluation</div>

      <div class="master-stats-bar">
        <div class="stat-item">
          <span class="stat-label">Total Reports:</span>
          <span class="stat-val">${totalStudents}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Teacher Approved:</span>
          <span class="stat-val" style="color: #15803d;">${approvedCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Draft / Pending:</span>
          <span class="stat-val" style="color: #b45309;">${totalStudents - approvedCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Exported:</span>
          <span class="stat-val">${escapeHtml(formattedDate)}</span>
        </div>
      </div>
    </header>

    <!-- Student Contents List (Table of Contents) -->
    <nav class="directory-panel no-print" aria-label="Student Directory">
      <h2 class="directory-title">Student Directory</h2>
      <div class="toc-grid">
        ${tocItemsHtml}
      </div>
    </nav>

    <!-- Marking Colour Legend Box -->
    <aside class="legend-box no-print" aria-label="Marking Legend">
      <div class="legend-title">Marking Legend &amp; Visual Formatting:</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="text-error line-through font-medium">Red strikethrough</span>
          <span>: Original student error</span>
        </div>
        <div class="legend-item">
          <span class="text-correction font-bold">Green text</span>
          <span>: Required correction above error</span>
        </div>
        <div class="legend-item">
          <span class="text-clarity italic">(Blue parentheses)</span>
          <span>: Clarity & coherence suggestion</span>
        </div>
        <div class="legend-item">
          <span class="text-improvement italic">(Purple parentheses)</span>
          <span>: Optional sentence improvement</span>
        </div>
        <div class="legend-item">
          <span class="text-correction font-bold">^</span>
          <span>: Insertion point for missing words</span>
        </div>
      </div>
    </aside>

    <!-- Main All-Student Report Cards -->
    <main>
      ${studentCardsHtml}
    </main>
  </div>

  <!-- Minimal Inline JavaScript for Interactive Popovers (Dismiss on outside click or Escape) -->
  <script>
    (function() {
      var activePopover = null;

      document.addEventListener('click', function(e) {
        var trigger = e.target.closest('.has-explanation');
        if (trigger) {
          var popover = trigger.querySelector('.feedback-popover');
          if (popover) {
            e.stopPropagation();
            if (activePopover && activePopover !== popover) {
              activePopover.classList.remove('is-open');
            }
            var isOpen = popover.classList.toggle('is-open');
            activePopover = isOpen ? popover : null;
          }
        } else {
          if (activePopover) {
            activePopover.classList.remove('is-open');
            activePopover = null;
          }
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && activePopover) {
          activePopover.classList.remove('is-open');
          activePopover = null;
        }
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * Triggers a client-side browser download of the standalone HTML report file.
 */
export function downloadHtmlFile(filename: string, htmlContent: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
