import { describe, it, expect } from 'vitest';
import {
  buildAnnotatedWritingHtml,
  generateAllStudentsHtmlReport,
} from '@/modules/essay-marking/utils/htmlReportGenerator';
import {
  MarkingFinding,
  StudentTranscriptState,
  StudentMarkingState,
} from '@/modules/essay-marking/types';

/**
 * Regression fixture reproducing the reported screenshot:
 * - Transcript STRING collapsed into one long paragraph (line breaks lost),
 *   while the saved per-line structure (linesWithBboxes) is intact.
 * - Required red/green corrections with decision 'pending' (normal AI state,
 *   displayed inline in Review Marking).
 * - Purple improvement + blue clarity suggestions whose recorded lineIndex is
 *   wrong (0) while their quotes live on later lines.
 * - Rejected and needs_review findings; repeated words; teacher-edited range.
 */

// Saved per-line structure (what Review Marking displays) — 6 source lines.
const SOURCE_LINES = [
  "CHARACTER'S NAME: Dog Man",
  'BOOK TITLE: Dog Man',
  'He is kind because one time he save one friend in the fire.',
  'He is a part of man. A part of dog. And also hero. He have a small eyes too.',
  'But he is also messy. He meas his room when he go home.',
  'He have some friend too. He have Lil Petery, he came of Petery the cat.',
];

// Collapsed string as saved in the transcript state (breaks lost between the
// title label and the essay body, and within the body).
const COLLAPSED_TEXT =
  "CHARACTER'S NAME: Dog Man\n" +
  'BOOK TITLE: Dog Man He is kind because one time he save one friend in the fire. ' +
  'He is a part of man. A part of dog. And also hero. He have a small eyes too. ' +
  'But he is also messy. He meas his room when he go home. ' +
  'He have some friend too. He have Lil Petery, he came of Petery the cat.';

const baseFinding = (over: Partial<MarkingFinding>): MarkingFinding =>
  ({
    id: 'f-x',
    type: 'Tense',
    feedbackType: 'correction',
    originalText: 'save',
    replacementText: 'saved',
    explanation: 'Past tense required.',
    decision: 'pending',
    ...over,
  }) as MarkingFinding;

const findings: MarkingFinding[] = [
  // Pending required correction on line 2 (source-line space)
  baseFinding({
    id: 'f-1',
    type: 'Tense',
    originalText: 'save',
    replacementText: 'saved',
    decision: 'pending',
    lineIndex: 2,
  }),
  // Repeated capital "He" on line 5: first untouched, second corrected
  baseFinding({
    id: 'f-2',
    type: 'Grammar',
    originalText: 'He',
    replacementText: 'She',
    decision: 'pending',
    lineIndex: 5,
    occurrenceIndex: 1,
  } as Partial<MarkingFinding>),
  // Teacher-edited explicit range on line 4 ("meas" at chars 25..29 -> "cleans")
  baseFinding({
    id: 'f-3',
    type: 'Spelling',
    originalText: 'meas',
    replacementText: 'cleans',
    decision: 'edited',
    lineIndex: 4,
    startIndex: 25,
    endIndex: 29,
  } as Partial<MarkingFinding>),
  // Purple improvement: WRONG claimed lineIndex (0) but quote lives on line 3
  baseFinding({
    id: 'f-4',
    type: 'Style',
    feedbackType: 'improvement',
    originalText: 'A part of dog.',
    replacementText: 'Part dog as well.',
    decision: 'pending',
    lineIndex: 0,
  } as Partial<MarkingFinding>),
  // Blue clarity: ambiguous quote appearing on TWO lines -> review list
  baseFinding({
    id: 'f-5',
    type: 'Coherence',
    feedbackType: 'clarity',
    originalText: 'He have',
    replacementText: 'He has',
    decision: 'pending',
    lineIndex: 0,
  } as Partial<MarkingFinding>),
  // Rejected correction -> excluded entirely
  baseFinding({
    id: 'f-6',
    type: 'Spelling',
    originalText: 'messy',
    replacementText: 'untidy',
    decision: 'rejected',
    lineIndex: 4,
  }),
  // Stale finding -> NOT rendered as confirmed; listed for review
  baseFinding({
    id: 'f-7',
    type: 'Grammar',
    originalText: 'also hero',
    replacementText: 'also a hero',
    decision: 'needs_review',
    reviewReason: 'Teacher edited the transcript before this finding was reviewed.',
    lineIndex: 3,
  } as Partial<MarkingFinding>),
];

/** Extracts the writing line unit blocks from the generated HTML. */
function lineUnits(html: string): string[] {
  return html.split('<div class="writing-line-unit">').slice(1);
}

describe('Report annotation regression (collapsed text + intact saved line structure)', () => {
  const { html, unresolvedFindings } = buildAnnotatedWritingHtml(
    COLLAPSED_TEXT,
    findings,
    'std-1',
    SOURCE_LINES
  );

  it('preserves verified source line breaks (one line unit per saved line, not one collapsed paragraph)', () => {
    const units = lineUnits(html);
    expect(units).toHaveLength(SOURCE_LINES.length);
    expect(units[0]).toContain('CHARACTER&#39;S NAME: Dog Man');
    expect(units[1]).toContain('BOOK TITLE: Dog Man');
    expect(units[2]).toContain('He is kind because');
    units.forEach((u) => {
      expect(u).not.toContain('BOOK TITLE: Dog Man He is kind because');
    });
  });

  it('renders PENDING required corrections (red strikethrough + green correction above)', () => {
    expect(html).toContain('>saved<');
    expect(html).toContain('orig-error-text">save<');
  });

  it('does not insert optional improvement suggestions into the student writing text', () => {
    const units = lineUnits(html);
    expect(units[3]).not.toContain('Part dog as well.');
    expect(units[0]).not.toContain('Part dog as well.');
  });

  it('does NOT place unmatched suggestions in writing text; lists them separately as requiring review', () => {
    const units = lineUnits(html);
    expect(units[0]).not.toContain('(He has)');
    expect(unresolvedFindings.some((f) => f.id === 'f-5')).toBe(true);
  });

  it('excludes rejected findings entirely', () => {
    expect(html).not.toContain('orig-error-text">messy<');
    expect(html).not.toContain('>untidy<');
    expect(unresolvedFindings.some((f) => f.id === 'f-6')).toBe(false);
  });

  it('lists needs_review findings only in the review list, not as confirmed corrections', () => {
    expect(html).not.toContain('orig-error-text">also hero<');
    expect(unresolvedFindings.some((f) => f.id === 'f-7')).toBe(true);
  });

  it('honors teacher-edited explicit source ranges without global first-match replacement', () => {
    const units = lineUnits(html);
    expect(units[4]).toContain('>cleans<');
    expect(units[4]).toContain('orig-error-text">meas<');
  });

  it('renders unchanged text cleanly without table row artifacts', () => {
    const units = lineUnits(html);
    expect(units[0]).toContain('CHARACTER&#39;S NAME: Dog Man');
  });

  it('handles repeated words by occurrence index (first "He" untouched, second "He" corrected)', () => {
    const units = lineUnits(html);
    const unit5 = units[5];
    // First occurrence stays normal text...
    expect(unit5).toContain('He have some friend too.');
    // ...second occurrence gets green correction above + red strikethrough baseline
    expect(unit5).toContain('>She<');
    expect(unit5).toContain('orig-error-text">He<');
  });

  it('falls back to the transcript string when no saved structure exists (legacy behavior intact)', () => {
    const res = buildAnnotatedWritingHtml('Line one.\nLine two.', [], 'std-2');
    const units = lineUnits(res.html);
    expect(units).toHaveLength(2);
    expect(units[0]).toContain('Line one.');
    expect(units[1]).toContain('Line two.');
  });

  it('respects teacher re-typed content: string wins when it diverges from saved structure', () => {
    const res = buildAnnotatedWritingHtml(
      'Teacher re-typed entirely different words.',
      [],
      'std-3',
      SOURCE_LINES
    );
    const units = lineUnits(res.html);
    expect(units).toHaveLength(1);
    expect(units[0]).toContain('Teacher re-typed entirely different words.');
  });

  it('end-to-end: exported HTML report keeps line breaks and anchors all eligible feedback', () => {
    const transcripts: Record<string, StudentTranscriptState> = {
      'std-1': {
        studentId: 'std-1',
        rawOcrText: null,
        editedText: COLLAPSED_TEXT,
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
        linesWithBboxes: SOURCE_LINES.map((text) => ({
          text,
          bbox: null,
          pageNumber: 1,
        })),
      },
    };
    const markings: Record<string, StudentMarkingState> = {
      'std-1': {
        studentId: 'std-1',
        scores: { content: 0, language: 0, organisation: 0 },
        feedbackComment: '',
        findings,
        isApproved: true,
      },
    };

    const full = generateAllStudentsHtmlReport({
      assignment: {
        title: 'P.4 Wr1_Character Profile',
        rubric: [],
        isConfirmed: true,
      } as any,
      classId: '4A',
      students: [
        { id: 'std-1', classNumber: 1, displayName: 'Abby', status: 'enrolled' } as any,
      ],
      assignedIndices: [0],
      rubric: [
        { id: 'content', name: 'Content', maxScore: 40 },
        { id: 'language', name: 'Language', maxScore: 40 },
        { id: 'organisation', name: 'Organisation', maxScore: 20 },
      ],
      transcripts,
      markings,
    });

    expect(full).toContain('CHARACTER&#39;S NAME: Dog Man');
    const units = lineUnits(full);
    expect(units.length).toBe(SOURCE_LINES.length);
    expect(full).toContain('>saved<');
    expect(full).not.toContain('>untidy<');
    expect(full).toContain('Unresolved Review Items');
    // Zero-valued scores preserved as valid values (rendered "0 / 100",
    // NOT a "Pending" score state)
    expect(full).toContain('score-num">0</span>');
    expect(full).not.toContain('score-pending">Pending</div>');
  });
});

