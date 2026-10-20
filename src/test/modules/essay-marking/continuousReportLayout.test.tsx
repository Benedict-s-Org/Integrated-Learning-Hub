import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ReportPanel } from '@/modules/essay-marking/components/ReportPanel';
import * as docxReportGen from '@/modules/essay-marking/utils/docxReportGenerator';
import * as mdReportGen from '@/modules/essay-marking/utils/markdownReportGenerator';
import {
  AssignmentConfig,
  StudentRosterItem,
  AppliedMatching,
  RubricDimension,
  StudentTranscriptState,
  StudentMarkingState,
} from '@/modules/essay-marking/types';

describe('Step 6 Continuous Report Layout Verification Tests', () => {
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
    assignedStudentIndices: [0, 1, 2], // Alice, Bob, Charlie
  };

  // Student 1: Approved
  const transcript1: StudentTranscriptState = {
    studentId: 'std-1',
    rawOcrText: 'Alice wrote about the sunny beach.',
    editedText: 'Alice wrote about the sunny beach.',
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
        originalText: 'beach',
        replacementText: 'seashore',
        decision: 'accepted',
        lineIndex: 0,
      },
    ],
    scores: { content: 5, language: 4 },
    feedbackComment: 'Wonderful storytelling Alice!',
    isApproved: true,
  };

  // Student 2: Unapproved Draft
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
    feedbackComment: 'Good effort, needs minor revision.',
    isApproved: false,
  };

  // Student 3: Incomplete / Unmarked
  const transcript3: StudentTranscriptState = {
    studentId: 'std-3',
    rawOcrText: 'Charlie went swimming in the sea.',
    editedText: '',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: false,
  };

  // No marking for Charlie

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Verification 1 & 2: Multiple students rendered simultaneously in queue order with distinct borders
  // --------------------------------------------------------------------------
  it('1. Renders all students simultaneously in student-queue order with distinct outer borders', () => {
    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={{ 'std-1': transcript1, 'std-2': transcript2, 'std-3': transcript3 }}
        markings={{ 'std-1': marking1, 'std-2': marking2 }}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    // Verify all 3 cards exist simultaneously in the DOM
    const cardAlice = screen.getByTestId('student-report-card-std-1');
    const cardBob = screen.getByTestId('student-report-card-std-2');
    const cardCharlie = screen.getByTestId('student-report-card-std-3');

    expect(cardAlice).toBeInTheDocument();
    expect(cardBob).toBeInTheDocument();
    expect(cardCharlie).toBeInTheDocument();

    // Verify correct student headings
    expect(within(cardAlice).getByText(/Alice Wong/i)).toBeInTheDocument();
    expect(within(cardBob).getByText(/Bob Chan/i)).toBeInTheDocument();
    expect(within(cardCharlie).getByText(/Charlie Lee/i)).toBeInTheDocument();

    // Verify stable anchors and scroll-margin
    expect(cardAlice).toHaveAttribute('id', 'report-student-std-1');
    expect(cardBob).toHaveAttribute('id', 'report-student-std-2');
    expect(cardCharlie).toHaveAttribute('id', 'report-student-std-3');

    expect(cardAlice.className).toContain('scroll-mt-24');
    expect(cardBob.className).toContain('scroll-mt-24');
    expect(cardCharlie.className).toContain('scroll-mt-24');

    // Verify distinct outer borders
    expect(cardAlice.className).toContain('border');
    expect(cardBob.className).toContain('border');
    expect(cardCharlie.className).toContain('border');
  });

  // --------------------------------------------------------------------------
  // Verification 3: Continuous layout does not use fixed-height nested scrolling
  // --------------------------------------------------------------------------
  it('2. Uses main vertical page scroll; report cards do not have nested overflow-y-auto or fixed heights', () => {
    const { container } = render(
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

    const reportStream = screen.getByTestId('continuous-report-stream');
    expect(reportStream).toBeInTheDocument();
    expect(reportStream.className).not.toContain('overflow-y-auto');
    expect(reportStream.className).not.toContain('h-');

    const cardAlice = screen.getByTestId('student-report-card-std-1');
    expect(cardAlice.className).not.toContain('overflow-y-auto');
    expect(cardAlice.className).not.toContain('h-');
  });

  // --------------------------------------------------------------------------
  // Verification 4: Student queue navigation triggers scroll without hiding reports
  // --------------------------------------------------------------------------
  it('3. Clicking a name in the student queue scrolls to that report and does not hide other reports', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const onSelectStudentMock = vi.fn();

    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={{ 'std-1': transcript1, 'std-2': transcript2, 'std-3': transcript3 }}
        markings={{ 'std-1': marking1, 'std-2': marking2 }}
        onSelectStudent={onSelectStudentMock}
        onPrev={vi.fn()}
      />
    );

    // Click Bob in the queue
    const bobQueueBtn = screen.getByTestId('queue-student-btn-std-2');
    fireEvent.click(bobQueueBtn);

    // Selected student updated
    expect(onSelectStudentMock).toHaveBeenCalledWith(1);

    // scrollIntoView called on Bob's card
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    // Other reports (Alice and Charlie) MUST still remain visible in the DOM
    expect(screen.getByTestId('student-report-card-std-1')).toBeInTheDocument();
    expect(screen.getByTestId('student-report-card-std-2')).toBeInTheDocument();
    expect(screen.getByTestId('student-report-card-std-3')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Verification 5: Status and incomplete data safety
  // --------------------------------------------------------------------------
  it('4. Correctly displays status for approved, draft, and incomplete students without presenting missing scores as complete', () => {
    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={{ 'std-1': transcript1, 'std-2': transcript2, 'std-3': transcript3 }}
        markings={{ 'std-1': marking1, 'std-2': marking2 }}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    const cardAlice = screen.getByTestId('student-report-card-std-1');
    const cardBob = screen.getByTestId('student-report-card-std-2');
    const cardCharlie = screen.getByTestId('student-report-card-std-3');

    // Alice: Approved
    expect(within(cardAlice).getByText('Teacher Approved')).toBeInTheDocument();
    expect(within(cardAlice).getByText(/9/)).toBeInTheDocument(); // 5 + 4
    expect(within(cardAlice).getByText('Wonderful storytelling Alice!')).toBeInTheDocument();

    // Bob: Draft
    expect(within(cardBob).getByText('Draft Report')).toBeInTheDocument();
    expect(within(cardBob).getByText(/7/)).toBeInTheDocument(); // 4 + 3

    // Charlie: Pending marking (no invented score or approval)
    expect(within(cardCharlie).getByText('Pending Marking')).toBeInTheDocument();
    expect(
      within(cardCharlie).getByText('Scores pending completion of marking')
    ).toBeInTheDocument();
    expect(
      within(cardCharlie).getByText('No written commentary entered yet.')
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Verification 6: Export actions in a student's card target that specific student
  // --------------------------------------------------------------------------
  it('5. Export actions inside a student card strictly target that student without affecting others', async () => {
    const downloadDocxSpy = vi
      .spyOn(docxReportGen, 'downloadDocxFile')
      .mockImplementation(() => {});

    const generateDocxBlobSpy = vi
      .spyOn(docxReportGen, 'generateStudentDocxBlob')
      .mockResolvedValue(new Blob(['docx-data']));

    const downloadMdSpy = vi
      .spyOn(mdReportGen, 'downloadMarkdownFile')
      .mockImplementation(() => {});

    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0} // Alice is active globally
        rubric={sampleRubric}
        transcripts={{ 'std-1': transcript1, 'std-2': transcript2 }}
        markings={{ 'std-1': marking1, 'std-2': marking2 }}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    const cardBob = screen.getByTestId('student-report-card-std-2');

    // Click Export .docx inside BOB's card (even though Alice is index 0)
    const bobDocxBtn = within(cardBob).getByRole('button', { name: /Export \.docx/i });
    fireEvent.click(bobDocxBtn);

    await waitFor(() => {
      expect(generateDocxBlobSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          studentName: 'Bob Chan',
          studentNumber: 2,
          totalScore: 7,
        })
      );
    });

    // Click Export .md inside BOB's card
    const bobMdBtn = within(cardBob).getByRole('button', { name: /Export \.md/i });
    fireEvent.click(bobMdBtn);

    expect(downloadMdSpy).toHaveBeenCalledWith(
      'Adventures_at_the_Beach_4A_No02_Bob_Chan.md',
      expect.stringContaining('Bob Chan')
    );
  });
});
