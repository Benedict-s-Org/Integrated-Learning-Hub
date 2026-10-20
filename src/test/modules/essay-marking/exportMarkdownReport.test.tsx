import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportPanel } from '@/modules/essay-marking/components/ReportPanel';
import {
  generateStudentMarkdownReport,
  generateSafeMarkdownFilename,
  annotateTranscriptWithCorrections,
} from '@/modules/essay-marking/utils/markdownReportGenerator';
import {
  AssignmentConfig,
  StudentRosterItem,
  AppliedMatching,
  RubricDimension,
  StudentTranscriptState,
  StudentMarkingState,
  MarkingFinding,
} from '@/modules/essay-marking/types';

describe('Export .md Feature Verification Tests', () => {
  const sampleRubric: RubricDimension[] = [
    { id: 'content', name: 'Content & Ideas', maxScore: 5 },
    { id: 'language', name: 'Language & Grammar', maxScore: 5 },
    { id: 'vocabulary', name: 'Vocabulary', maxScore: 5 },
  ];

  const sampleAssignment: AssignmentConfig = {
    title: 'Dog Man Book Review',
    classId: '4A',
    targetWordCount: 80,
    rubricId: 'p4-standard',
  };

  const sampleStudent: StudentRosterItem = {
    id: 'std-1',
    classNumber: 1,
    studentIdNumber: '4A01',
    displayName: 'Abby',
    gender: 'F',
    status: 'enrolled',
  };

  const sampleAppliedMatching: AppliedMatching = {
    classId: '4A',
    assignedStudentIndices: [0],
  };

  // --------------------------------------------------------------------------
  // Verification 1: Exact output: He $save$ %saved% his friend.
  // --------------------------------------------------------------------------
  it('1. Generates exact inline marker format: He $save$ %saved% his friend.', () => {
    const transcript = 'He save his friend.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        decision: 'accepted',
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ];

    const { annotatedText } = annotateTranscriptWithCorrections(transcript, findings);
    expect(annotatedText).toBe('He $save$ %saved% his friend.');

    // Full report check
    const reportMd = generateStudentMarkdownReport({
      assignmentTitle: 'Story Review',
      classId: '4A',
      studentNumber: 1,
      studentName: 'Abby',
      isApproved: true,
      totalScore: 14,
      maxPossibleScore: 15,
      rubric: sampleRubric,
      scores: { content: 5, language: 4, vocabulary: 5 },
      feedbackComment: 'Well done on using vivid descriptions.',
      transcriptText: transcript,
      findings,
    });

    // Fenced plain-text block must contain exact marker
    expect(reportMd).toContain('```text\nHe $save$ %saved% his friend.\n```');
    // Delimiters must be single, not double
    expect(reportMd).not.toContain('$$');
    expect(reportMd).not.toContain('%%');
    // Legend must be present
    expect(reportMd).toContain('Inline Marker Legend:');
    expect(reportMd).toContain('`$original$`');
    expect(reportMd).toContain('`%correction%`');
  });

  // --------------------------------------------------------------------------
  // Verification 2: Original line breaks and blank lines
  // --------------------------------------------------------------------------
  it('2. Preserves exact original source line breaks, blank lines, and page structure', () => {
    const transcriptWithBlankLines = `CHARACTER'S NAME: Dog Man

BOOK TITLE: Dog Man

He save his friend.
They walk away.`;

    const findings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        decision: 'accepted',
        lineIndex: 4,
        occurrenceIndex: 0,
      },
    ];

    const { annotatedText } = annotateTranscriptWithCorrections(
      transcriptWithBlankLines,
      findings
    );

    const lines = annotatedText.split('\n');
    expect(lines.length).toBe(6);
    expect(lines[0]).toBe("CHARACTER'S NAME: Dog Man");
    expect(lines[1]).toBe(''); // Blank line preserved!
    expect(lines[2]).toBe('BOOK TITLE: Dog Man');
    expect(lines[3]).toBe(''); // Blank line preserved!
    expect(lines[4]).toBe('He $save$ %saved% his friend.');
    expect(lines[5]).toBe('They walk away.');
  });

  // --------------------------------------------------------------------------
  // Verification 3: Multiple corrections on one line
  // --------------------------------------------------------------------------
  it('3. Applies multiple corrections on the same line without position shifting or deleting surrounding words', () => {
    const transcript = 'He save his friend and mess the room today.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        decision: 'accepted',
        lineIndex: 0,
        occurrenceIndex: 0,
      },
      {
        id: 'f-mess',
        type: 'Grammar',
        originalText: 'mess',
        replacementText: 'messes',
        decision: 'accepted',
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ];

    const { annotatedText } = annotateTranscriptWithCorrections(transcript, findings);
    expect(annotatedText).toBe(
      'He $save$ %saved% his friend and $mess$ %messes% the room today.'
    );
  });

  // --------------------------------------------------------------------------
  // Verification 4: Repeated words
  // --------------------------------------------------------------------------
  it('4. Handles repeated words correctly using occurrenceIndex without corrupting other instances', () => {
    const transcript = 'the boy saw the dog and the cat.';
    // Second "the" is at index 12 (occ 1)
    const findings: MarkingFinding[] = [
      {
        id: 'f-the-2',
        type: 'Capitalization',
        originalText: 'the',
        replacementText: 'The',
        decision: 'accepted',
        lineIndex: 0,
        occurrenceIndex: 1,
      },
    ];

    const { annotatedText } = annotateTranscriptWithCorrections(transcript, findings);
    // Only the second "the" should be marked
    expect(annotatedText).toBe('the boy saw $the$ %The% dog and the cat.');
  });

  // --------------------------------------------------------------------------
  // Verification 5: Teacher-edited source ranges
  // --------------------------------------------------------------------------
  it('5. Uses latest teacher-edited quote and source range, leaving unselected words normal', () => {
    const transcript = 'He save his friend.';
    // Teacher narrowed AI finding from "He save" to "save"
    const findings: MarkingFinding[] = [
      {
        id: 'f-edited',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        teacherCustomText: 'saved',
        decision: 'edited',
        source: 'teacher',
        isManual: true,
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ];

    const { annotatedText } = annotateTranscriptWithCorrections(transcript, findings);
    // "He" must remain outside the markers as normal text
    expect(annotatedText).toBe('He $save$ %saved% his friend.');
    expect(annotatedText).not.toContain('$He');
  });

  // --------------------------------------------------------------------------
  // Verification 6: Rejected/stale findings excluded from inline corrections
  // --------------------------------------------------------------------------
  it('6. Excludes rejected and stale findings from inline corrections and places optional/clarity suggestions in separate sections', () => {
    const transcript = 'He save his friend. And also he mess the room.';
    const findings: MarkingFinding[] = [
      // 1. Accepted correction -> inline
      {
        id: 'f-1',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        decision: 'accepted',
        feedbackType: 'correction',
        lineIndex: 0,
      },
      // 2. Rejected finding -> must NOT be in inline markers
      {
        id: 'f-2',
        type: 'Grammar',
        originalText: 'mess',
        replacementText: 'messes',
        decision: 'rejected',
        feedbackType: 'correction',
        lineIndex: 0,
      },
      // 3. Stale finding (needs_review) -> must NOT be in inline markers
      {
        id: 'f-3',
        type: 'Spelling',
        originalText: 'friend',
        replacementText: 'companion',
        decision: 'needs_review',
        feedbackType: 'correction',
        lineIndex: 0,
      },
      // 4. Optional improvement -> separate section, NOT in inline markers
      {
        id: 'f-4',
        type: 'Vocabulary',
        originalText: 'mess the room',
        replacementText: 'caused chaos in the room',
        decision: 'pending',
        feedbackType: 'improvement',
        explanation: 'More descriptive expression.',
        lineIndex: 0,
      },
      // 5. Clarity suggestion -> separate section, NOT in inline markers
      {
        id: 'f-5',
        type: 'Clarity',
        originalText: 'And also',
        replacementText: 'Furthermore',
        decision: 'pending',
        feedbackType: 'clarity',
        explanation: 'Improve transition.',
        lineIndex: 0,
      },
    ];

    const reportMd = generateStudentMarkdownReport({
      assignmentTitle: 'Essay',
      classId: '4A',
      studentName: 'Abby',
      isApproved: true,
      totalScore: 10,
      maxPossibleScore: 15,
      rubric: sampleRubric,
      scores: { content: 4, language: 3, vocabulary: 3 },
      transcriptText: transcript,
      findings,
    });

    // In the fenced code block:
    // Only "save" is marked. "mess" and "friend" are untouched!
    expect(reportMd).toContain('He $save$ %saved% his friend. And also he mess the room.');
    expect(reportMd).not.toContain('$mess$');
    expect(reportMd).not.toContain('$friend$');

    // Optional improvement section
    expect(reportMd).toContain('## Optional Improvements');
    expect(reportMd).toContain('"mess the room" → suggested phrasing: (caused chaos in the room)');
    expect(reportMd).toContain('More descriptive expression.');

    // Clarity / coherence section
    expect(reportMd).toContain('## Clarity & Coherence Suggestions');
    expect(reportMd).toContain('"And also" → suggestion: (Furthermore)');
    expect(reportMd).toContain('Improve transition.');
  });

  // --------------------------------------------------------------------------
  // Verification 7: Insertion, deletion, and unresolved ranges
  // --------------------------------------------------------------------------
  it('7. Handles insertion ($EMPTY$ %text%), deletion ($text$ %EMPTY%), and reports unresolved items cleanly', () => {
    // 7A: Insertion
    const insertTranscript = 'He his friend.';
    const insertFindings: MarkingFinding[] = [
      {
        id: 'f-insert',
        type: 'Grammar',
        originalText: '',
        replacementText: 'saved',
        decision: 'accepted',
        lineIndex: 0,
        startIndex: 3,
      } as any,
    ];

    const insertResult = annotateTranscriptWithCorrections(insertTranscript, insertFindings);
    expect(insertResult.annotatedText).toBe('He $EMPTY$ %saved% his friend.');

    // 7B: Deletion
    const deleteTranscript = 'He really saved his friend.';
    const deleteFindings: MarkingFinding[] = [
      {
        id: 'f-delete',
        type: 'Grammar',
        originalText: 'really',
        replacementText: '(delete)',
        decision: 'accepted',
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ];

    const deleteResult = annotateTranscriptWithCorrections(deleteTranscript, deleteFindings);
    expect(deleteResult.annotatedText).toBe('He $really$ %EMPTY% saved his friend.');

    // 7C: Unresolved conflicting finding
    const conflictTranscript = 'He messes up.';
    const conflictFindings: MarkingFinding[] = [
      {
        id: 'f-unresolved-1',
        type: 'Spelling',
        originalText: 'xyzWordNotInTranscript',
        replacementText: 'abc',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const reportMd = generateStudentMarkdownReport({
      assignmentTitle: 'Story',
      studentName: 'Abby',
      totalScore: 10,
      maxPossibleScore: 15,
      rubric: sampleRubric,
      scores: {},
      transcriptText: conflictTranscript,
      findings: conflictFindings,
    });

    // Transcript remains intact without guessing
    expect(reportMd).toContain('```text\nHe messes up.\n```');
    // Listed in unresolved section
    expect(reportMd).toContain('## Unresolved Review Items');
    expect(reportMd).toContain('"xyzWordNotInTranscript" → "abc"');
  });

  // --------------------------------------------------------------------------
  // Verification 8: UTF-8 student names, download file contents & filename
  // --------------------------------------------------------------------------
  it('8. Supports UTF-8 student names, generates safe filenames, and triggers download from UI', () => {
    // 8A: Safe filename with UTF-8 characters
    const filenameUtf8 = generateSafeMarkdownFilename(
      'P4 Writing / Task #1: "Summer"',
      '4A',
      7,
      '陳大文'
    );

    expect(filenameUtf8).toBe('P4_Writing___Task__1___Summer__4A_No07_陳大文.md');
    expect(filenameUtf8).not.toMatch(/[<>:"/\\|?*]/);
    expect(filenameUtf8).toContain('陳大文');

    // 8B: UI Click on Export .md triggers blob creation and link download
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-md');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    const utf8Student: StudentRosterItem = {
      id: 'std-utf8',
      classNumber: 7,
      studentIdNumber: '4A07',
      displayName: '陳大文',
      gender: 'M',
      status: 'enrolled',
    };

    const studentMarking: StudentMarkingState = {
      studentId: 'std-utf8',
      findings: [
        {
          id: 'f-save',
          type: 'Tense',
          originalText: 'save',
          replacementText: 'saved',
          decision: 'accepted',
          lineIndex: 0,
        },
      ],
      scores: { content: 5, language: 4, vocabulary: 5 },
      feedbackComment: '寫作表現優秀，請注意過去時態。',
      isApproved: true,
    };

    const studentTranscript: StudentTranscriptState = {
      studentId: 'std-utf8',
      editedText: 'He save his friend.',
      verifiedAt: '2026-10-20T00:00:00Z',
    };

    render(
      <ReportPanel
        assignment={{ title: 'Writing Task', classId: '4A', targetWordCount: 100, rubricId: 'r1' }}
        students={[utf8Student]}
        appliedMatching={{ classId: '4A', assignedStudentIndices: [0] }}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={{ 'std-utf8': studentTranscript }}
        markings={{ 'std-utf8': studentMarking }}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    // Verify "Export .md" button is present on Report screen
    const exportMdBtn = screen.getByRole('button', { name: /Export \.md/i });
    expect(exportMdBtn).toBeInTheDocument();

    fireEvent.click(exportMdBtn);

    // Verify createObjectURL called with a Blob
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/markdown;charset=utf-8');

    // Verify download was clicked
    expect(mockClick).toHaveBeenCalledTimes(1);
  });
});
