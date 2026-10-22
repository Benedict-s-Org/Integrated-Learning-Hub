import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportPanel } from '@/modules/essay-marking/components/ReportPanel';
import {
  generateAllStudentsHtmlReport,
  generateSafeHtmlReportFilename,
  escapeHtml,
} from '@/modules/essay-marking/utils/htmlReportGenerator';
import * as htmlReportGen from '@/modules/essay-marking/utils/htmlReportGenerator';
import {
  AssignmentConfig,
  StudentRosterItem,
  AppliedMatching,
  RubricDimension,
  StudentTranscriptState,
  StudentMarkingState,
  MarkingFinding,
} from '@/modules/essay-marking/types';

describe('Export All Reports .html Feature Verification Tests', () => {
  const sampleRubric: RubricDimension[] = [
    { id: 'content', name: 'Content & Ideas', maxScore: 5 },
    { id: 'language', name: 'Language & Grammar', maxScore: 5 },
  ];

  const sampleAssignment: AssignmentConfig = {
    title: 'Adventures at the Beach',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'separate_paper',
    scopePrompt: '',
    isConfirmed: true,
    rubric: sampleRubric,
  };

  const students: StudentRosterItem[] = [
    {
      id: 'std-1',
      classNumber: 1,
      studentIdNumber: '4A01',
      displayName: 'Alice Wong',
      gender: 'F',
      status: 'enrolled',
    },
    {
      id: 'std-2',
      classNumber: 2,
      studentIdNumber: '4A02',
      displayName: 'Bob Chan',
      gender: 'M',
      status: 'enrolled',
    },
    {
      id: 'std-3',
      classNumber: 3,
      studentIdNumber: '4A03',
      displayName: 'Charlie Lee',
      gender: 'M',
      status: 'enrolled',
    },
  ];

  const appliedMatching: AppliedMatching = {
    classId: '4A',
    counts: [1, 1, 1],
    map: [],
    assignedStudentIndices: [0, 1, 2],
  };

  // Alice: Approved with multiple feedback types
  const transcript1: StudentTranscriptState = {
    studentId: 'std-1',
    rawOcrText: 'Alice wrote about the sunny beach.\nShe save her friend.\n\nParagraph two began nicely.\nThis line has no corrections or suggestions.',
    editedText: 'Alice wrote about the sunny beach.\nShe save her friend.\n\nParagraph two began nicely.\nThis line has no corrections or suggestions.',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: true,
  };

  const marking1: StudentMarkingState = {
    studentId: 'std-1',
    findings: [
      {
        id: 'f1',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'save',
        replacementText: 'saved',
        explanation: 'Past tense required for past narrative.',
        decision: 'accepted',
        lineIndex: 1,
      },
      {
        id: 'f2',
        type: 'expression',
        feedbackType: 'clarity',
        originalText: 'Alice wrote about the sunny beach.',
        replacementText: 'On a radiant morning, Alice strolled along the golden shore.',
        explanation: 'Enhances descriptive vividness and sentence flow.',
        decision: 'accepted',
        lineIndex: 0,
      },
      {
        id: 'f3',
        type: 'vocabulary',
        feedbackType: 'improvement',
        originalText: 'began nicely',
        replacementText: 'commenced gracefully',
        explanation: 'Elevates vocabulary choice.',
        decision: 'accepted',
        lineIndex: 3,
      },
    ],
    scores: { content: 5, language: 4 },
    feedbackComment: 'Wonderful storytelling Alice!',
    isApproved: true,
  };

  // Bob: Draft Report
  const transcript2: StudentTranscriptState = {
    studentId: 'std-2',
    rawOcrText: 'Bob built a big sandcastle.',
    editedText: 'Bob built a big sandcastle.',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: true,
  };

  const marking2: StudentMarkingState = {
    studentId: 'std-2',
    findings: [],
    scores: { content: 4, language: 3 },
    feedbackComment: 'Good work, needs teacher review.',
    isApproved: false,
  };

  // Charlie: Unmarked / Incomplete
  const transcript3: StudentTranscriptState = {
    studentId: 'std-3',
    rawOcrText: 'Charlie went swimming.',
    editedText: '',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Verification 1: Export scope, student queue order, and unique anchors
  // --------------------------------------------------------------------------
  it('1. Exports all students in queue order with unique anchors and Table of Contents', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students,
      assignedIndices: [0, 1, 2],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1, 'std-2': transcript2, 'std-3': transcript3 },
      markings: { 'std-1': marking1, 'std-2': marking2 },
    });

    // 1. Directory contains jump links to each student
    expect(html).toContain('href="#report-student-std-1"');
    expect(html).toContain('href="#report-student-std-2"');
    expect(html).toContain('href="#report-student-std-3"');

    // 2. Each student card has matching unique anchor ID
    expect(html).toContain('id="report-student-std-1"');
    expect(html).toContain('id="report-student-std-2"');
    expect(html).toContain('id="report-student-std-3"');

    // 3. Queue order preserved: std-1 appears before std-2, which appears before std-3
    const pos1 = html.indexOf('id="report-student-std-1"');
    const pos2 = html.indexOf('id="report-student-std-2"');
    const pos3 = html.indexOf('id="report-student-std-3"');
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });

  // --------------------------------------------------------------------------
  // Verification 2: Status labels and incomplete data handling
  // --------------------------------------------------------------------------
  it('2. Correctly labels approved, draft, and pending students without generating missing content', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students,
      assignedIndices: [0, 1, 2],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1, 'std-2': transcript2, 'std-3': transcript3 },
      markings: { 'std-1': marking1, 'std-2': marking2 },
    });

    // Alice: Approved
    expect(html).toContain('Teacher Approved');
    expect(html).toContain('Wonderful storytelling Alice!');
    expect(html).toContain('<span class="score-num">9</span>'); // 5 + 4

    // Bob: Draft Report
    expect(html).toContain('Draft Report');
    expect(html).toContain('Good work, needs teacher review.');
    expect(html).toContain('<span class="score-num">7</span>'); // 4 + 3

    // Charlie: Pending Marking (no scores, no fake completion)
    expect(html).toContain('Pending Marking');
    expect(html).toContain('<div class="score-pending">Pending</div>');
    expect(html).toContain('No written commentary entered yet.');
  });

  // --------------------------------------------------------------------------
  // Verification 3: Three feedback types and dedicated annotation rows
  // --------------------------------------------------------------------------
  it('3. Renders red/green corrections, blue clarity suggestions, and purple improvements with dedicated annotation rows', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students: [students[0]],
      assignedIndices: [0],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1 },
      markings: { 'std-1': marking1 },
    });

    // Red error & Green correction
    expect(html).toContain('text-error line-through');
    expect(html).toContain('save');
    expect(html).toContain('text-correction font-bold');
    expect(html).toContain('saved');

    // Blue clarity suggestion in parentheses
    expect(html).toContain('text-clarity');
    expect(html).toContain('(On a radiant morning, Alice strolled along the golden shore.)');

    // Purple optional improvement in parentheses
    expect(html).toContain('text-improvement');
    expect(html).toContain('(commenced gracefully)');

    // Lines without feedback are rendered cleanly as readable paragraphs
    expect(html).toContain('This line has no corrections or suggestions.');

    // Colour legend is present
    expect(html).toContain('Marking Legend &amp; Visual Formatting:');
    expect(html).toContain('Red strikethrough');
    expect(html).toContain('Green text');
    expect(html).toContain('(Blue parentheses)');
    expect(html).toContain('(Purple parentheses)');
  });

  // --------------------------------------------------------------------------
  // Verification 4: Interactive explanations and accessible fallback notes
  // --------------------------------------------------------------------------
  it('4. Provides interactive popovers with explanation text and includes non-JS fallback notes', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students: [students[0]],
      assignedIndices: [0],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1 },
      markings: { 'std-1': marking1 },
    });

    // Interactive popovers with tabindex="0" and role="button"
    expect(html).toContain('class="has-explanation');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="button"');
    expect(html).toContain('class="feedback-popover" role="tooltip"');

    // Popover content includes category and explanation
    expect(html).toContain('Past tense required for past narrative.');
    expect(html).toContain('Enhances descriptive vividness and sentence flow.');

    // Fallback notes section is present and readable without JS
    expect(html).toContain('Specific Language &amp; Accuracy Notes');
    expect(html).toContain('Past tense required for past narrative.');
  });

  // --------------------------------------------------------------------------
  // Verification 5: Security & XSS escaping
  // --------------------------------------------------------------------------
  it('5. Properly escapes student text, names, and commentary containing script tags and HTML special characters', () => {
    const maliciousStudent: StudentRosterItem = {
      id: 'std-xss',
      classNumber: 4,
      displayName: '<script>alert("xss")</script> Xiao Ming & "Friends"',
    };

    const maliciousTranscript: StudentTranscriptState = {
      studentId: 'std-xss',
      editedText: 'The code is <b>bold</b> and <script>malicious()</script> & "quotes".',
      isVerified: true,
      rawOcrText: '',
      isManuallyEntered: false,
      uncertainRegions: [],
    };

    const maliciousMarking: StudentMarkingState = {
      studentId: 'std-xss',
      findings: [
        {
          id: 'f-xss',
          type: 'XSS <Test>',
          feedbackType: 'correction',
          originalText: '<b>bold</b>',
          replacementText: '<img src=x onerror=alert(1)>',
          explanation: '<svg onload=alert(2)>',
          decision: 'accepted',
          lineIndex: 0,
        },
      ],
      scores: { content: 5, language: 5 },
      feedbackComment: '<script>alert("teacher comment")</script>',
      isApproved: true,
    };

    const html = generateAllStudentsHtmlReport({
      assignment: { ...sampleAssignment, title: 'Test <Assignment> & "More"' },
      classId: '4A',
      students: [maliciousStudent],
      assignedIndices: [0],
      rubric: sampleRubric,
      transcripts: { 'std-xss': maliciousTranscript },
      markings: { 'std-xss': maliciousMarking },
    });

    // Unescaped script tags must NOT exist
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>malicious()</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<svg onload=alert(2)>');

    // Escaped versions must exist safely
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;svg onload=alert(2)&gt;');
    expect(html).toContain('Xiao Ming &amp; &quot;Friends&quot;');
  });

  // --------------------------------------------------------------------------
  // Verification 6: Truly standalone and offline (zero external dependencies)
  // --------------------------------------------------------------------------
  it('6. Standalone document has NO external fonts, scripts, CDNs, or network dependencies', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students,
      assignedIndices: [0, 1],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1, 'std-2': transcript2 },
      markings: { 'std-1': marking1, 'std-2': marking2 },
    });

    // Must NOT contain external http/https resource links
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('googleapis.com');
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('localhost:1808');
    expect(html).not.toContain('blob:');

    // Must have UTF-8 charset
    expect(html).toContain('<meta charset="UTF-8">');
    // Must contain inline styles
    expect(html).toContain('<style>');
  });

  // --------------------------------------------------------------------------
  // Verification 7: Print styles
  // --------------------------------------------------------------------------
  it('7. Contains print styles that separate student cards and hide navigation', () => {
    const html = generateAllStudentsHtmlReport({
      assignment: sampleAssignment,
      classId: '4A',
      students,
      assignedIndices: [0, 1],
      rubric: sampleRubric,
      transcripts: { 'std-1': transcript1, 'std-2': transcript2 },
      markings: { 'std-1': marking1, 'std-2': marking2 },
    });

    expect(html).toContain('@media print');
    expect(html).toContain('page-break-before: always');
    expect(html).toContain('.no-print');
    expect(html).toContain('display: none');
    expect(html).toContain('-webkit-print-color-adjust: exact');
  });

  // --------------------------------------------------------------------------
  // Verification 8: Safe filename generation with timestamp
  // --------------------------------------------------------------------------
  it('8. Generates a safe filename containing assignment title, class, and timestamp', () => {
    const fixedDate = new Date(2026, 9, 20, 14, 30); // 2026-10-20 14:30
    const filename = generateSafeHtmlReportFilename('Beach Story: "Fun Day"', '4A', fixedDate);

    expect(filename).toBe('Beach_Story___Fun_Day__4A_All_Reports_20261020_1430.html');
  });

  // --------------------------------------------------------------------------
  // Verification 9: UI Export All Reports .html button & Privacy Modal
  // --------------------------------------------------------------------------
  it('9. Renders "Export All Reports .html" button in ReportPanel and displays privacy modal before downloading', async () => {
    const downloadHtmlSpy = vi
      .spyOn(htmlReportGen, 'downloadHtmlFile')
      .mockImplementation(() => {});

    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={{ 'std-1': transcript1, 'std-2': transcript2 }}
        markings={{ 'std-1': marking1, 'std-2': marking2 }}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    // 1. "Export All Reports .html" button is present in the top summary banner
    const exportAllBtn = screen.getByRole('button', { name: /Export All Reports \.html/i });
    expect(exportAllBtn).toBeInTheDocument();

    // 2. Click button to open confirmation modal
    fireEvent.click(exportAllBtn);

    // 3. Privacy modal appears with notice text
    expect(screen.getByText(/Privacy & Distribution Notice/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Please store and distribute it responsibly/i)
    ).toBeInTheDocument();

    // 4. Click "Download HTML File" in modal
    const downloadConfirmBtn = screen.getByRole('button', { name: /Download HTML File/i });
    fireEvent.click(downloadConfirmBtn);

    // 5. File download triggered with valid HTML containing student data
    expect(downloadHtmlSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Adventures_at_the_Beach_4A_All_Reports_\d+_\d+\.html$/),
      expect.stringContaining('Alice Wong')
    );

    // 6. Modal closes
    await waitFor(() => {
      expect(screen.queryByText(/Privacy & Distribution Notice/i)).not.toBeInTheDocument();
    });
  });
});
