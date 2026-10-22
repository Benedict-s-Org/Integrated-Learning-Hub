import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptVerificationPanel } from '@/modules/essay-marking/components/TranscriptVerificationPanel';
import { MarkingReviewPanel } from '@/modules/essay-marking/components/MarkingReviewPanel';
import { computeIdentityMatchingPreview } from '@/modules/essay-marking/utils/identityMatchingLogic';
import { evaluateBatchMarkingEligibility } from '@/modules/essay-marking/utils/markingBatchQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  PageIdentityRecognition,
  StudentMarkingState,
} from '@/modules/essay-marking/types';

describe('Matched Student Order Preservation (Requirements A, B, C, D, E)', () => {
  const sampleStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Chan Tai Man', classNumber: 1, className: '3A' },
    { id: 's2', displayName: 'Wong Ka Yan', classNumber: 2, className: '3A' },
    { id: 's3', displayName: 'Lee Siu Lung', classNumber: 3, className: '3A' },
    { id: 's4', displayName: 'Cheung Ho Yin', classNumber: 4, className: '3A' },
  ];

  const sourcePages: ScanPage[] = [
    { id: 'p1', fileId: 'f1', fileName: 'scan_page_1.png', sourcePageNumber: 1, previewUrl: 'data:image/png;base64,P1', orderIndex: 0 },
    { id: 'p2', fileId: 'f1', fileName: 'scan_page_2.png', sourcePageNumber: 2, previewUrl: 'data:image/png;base64,P2', orderIndex: 1 },
    { id: 'p3', fileId: 'f1', fileName: 'scan_page_3.png', sourcePageNumber: 3, previewUrl: 'data:image/png;base64,P3', orderIndex: 2 },
    { id: 'p4', fileId: 'f1', fileName: 'scan_page_4.png', sourcePageNumber: 4, previewUrl: 'data:image/png;base64,P4', orderIndex: 3 },
  ];

  const assignment: AssignmentConfig = {
    title: 'P3 Creative Writing',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'worksheet',
    scopePrompt: 'Write a story.',
    isConfirmed: true,
    rubric: [
      { id: 'content', name: 'Content', maxScore: 60 },
      { id: 'language', name: 'Language', maxScore: 40 },
    ],
    templateRegions: [
      { id: 'wa1', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    ],
    transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
  };

  const sampleTranscripts: Record<string, StudentTranscriptState> = {
    s1: { studentId: 's1', rawOcrText: 'S1 OCR', editedText: 'S1 Essay Text', isManuallyEntered: false, uncertainRegions: [], isVerified: true },
    s2: { studentId: 's2', rawOcrText: 'S2 OCR', editedText: 'S2 Essay Text', isManuallyEntered: false, uncertainRegions: [], isVerified: true },
    s3: { studentId: 's3', rawOcrText: 'S3 OCR', editedText: 'S3 Essay Text', isManuallyEntered: false, uncertainRegions: [], isVerified: true },
    s4: { studentId: 's4', rawOcrText: 'S4 OCR', editedText: 'S4 Essay Text', isManuallyEntered: false, uncertainRegions: [], isVerified: true },
  };

  const sampleMarkings: Record<string, StudentMarkingState> = {
    s1: { studentId: 's1', findings: [], scores: { content: 50, language: 35 }, feedbackComment: 'Good', isApproved: false },
    s2: { studentId: 's2', findings: [], scores: { content: 52, language: 36 }, feedbackComment: 'Good', isApproved: false },
    s3: { studentId: 's3', findings: [], scores: { content: 55, language: 38 }, feedbackComment: 'Great', isApproved: false },
    s4: { studentId: 's4', findings: [], scores: { content: 48, language: 32 }, feedbackComment: 'Keep going', isApproved: false },
  };

  // Requirement A: Match Students produces non-numeric matched order [3, 1, 4, 2]
  it('A. computes confirmed matched order [3, 1, 4, 2] from source pages [1, 2, 3, 4]', () => {
    const recognitions: Record<string, PageIdentityRecognition> = {
      p1: { scanPageId: 'p1', pageNumber: 1, rawClass: '3A', rawStudentName: 'Lee Siu Lung', rawClassNumber: '3', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's3' }, // Student 3 (idx 2)
      p2: { scanPageId: 'p2', pageNumber: 2, rawClass: '3A', rawStudentName: 'Chan Tai Man', rawClassNumber: '1', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's1' }, // Student 1 (idx 0)
      p3: { scanPageId: 'p3', pageNumber: 3, rawClass: '3A', rawStudentName: 'Cheung Ho Yin', rawClassNumber: '4', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's4' }, // Student 4 (idx 3)
      p4: { scanPageId: 'p4', pageNumber: 4, rawClass: '3A', rawStudentName: 'Wong Ka Yan', rawClassNumber: '2', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's2' }, // Student 2 (idx 1)
    };

    const matchingResult = computeIdentityMatchingPreview(sourcePages, recognitions, sampleStudents);

    // Confirmed student indices in exact order of appearance: s3 (2), s1 (0), s4 (3), s2 (1)
    expect(matchingResult.assignedStudentIndices).toEqual([2, 0, 3, 1]);
    expect(matchingResult.assignedStudentIndices.map((idx) => sampleStudents[idx].classNumber)).toEqual([3, 1, 4, 2]);
  });

  // Requirement B: Verify Scripts renders [3, 1, 4, 2] with each student linked to correct PDF/script
  it('B. Verify Scripts renders [3, 1, 4, 2] in student queue, with every student linked to correct script', () => {
    const appliedMatching: AppliedMatching = {
      classId: '3A',
      counts: [1, 1, 1, 1],
      assignedStudentIndices: [2, 0, 3, 1], // [s3, s1, s4, s2]
      map: [
        { studentIndex: 2, studentId: 's3', studentName: 'Lee Siu Lung', classNumber: 3, part: 1, total: 1 },
        { studentIndex: 0, studentId: 's1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 1 },
        { studentIndex: 3, studentId: 's4', studentName: 'Cheung Ho Yin', classNumber: 4, part: 1, total: 1 },
        { studentIndex: 1, studentId: 's2', studentName: 'Wong Ka Yan', classNumber: 2, part: 1, total: 1 },
      ],
      mode: 'recognition',
    };

    const onSelectStudent = vi.fn();

    const { container } = render(
      <TranscriptVerificationPanel
        students={sampleStudents}
        pages={sourcePages}
        appliedMatching={appliedMatching}
        activeStudentIndex={2} // Student 3 is the first matched student
        transcripts={sampleTranscripts}
        assignment={assignment}
        onSelectStudent={onSelectStudent}
        onUpdateTranscriptText={vi.fn()}
        onVerifyTranscript={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Locate the student queue items
    const queueButtons = container.querySelectorAll('aside button[type="button"]');
    expect(queueButtons).toHaveLength(4);

    // Verify exact display order in the queue sidebar: Student 3, Student 1, Student 4, Student 2
    expect(queueButtons[0].textContent).toContain('03 · Lee Siu Lung');
    expect(queueButtons[1].textContent).toContain('01 · Chan Tai Man');
    expect(queueButtons[2].textContent).toContain('04 · Cheung Ho Yin');
    expect(queueButtons[3].textContent).toContain('02 · Wong Ka Yan');

    // Verify active student is Student 3 and linked to Page 1
    const scanImage = container.querySelector('img[alt="Student essay scan"]') as HTMLImageElement;
    expect(scanImage).toBeInTheDocument();
    expect(scanImage.src).toBe(sourcePages[0].previewUrl); // p1 is Lee Siu Lung's script

    // Click Student 1 in the queue
    fireEvent.click(queueButtons[1]);
    expect(onSelectStudent).toHaveBeenCalledWith(0); // Index 0 is Student 1
  });

  // Requirement C: Going to the next marking step preserves [3, 1, 4, 2] in marking queue
  it('C. Going to Review Marking preserves [3, 1, 4, 2] in both UI queue and batch marking queue', () => {
    const appliedMatching: AppliedMatching = {
      classId: '3A',
      counts: [1, 1, 1, 1],
      assignedStudentIndices: [2, 0, 3, 1],
      map: [
        { studentIndex: 2, studentId: 's3', studentName: 'Lee Siu Lung', classNumber: 3, part: 1, total: 1 },
        { studentIndex: 0, studentId: 's1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 1 },
        { studentIndex: 3, studentId: 's4', studentName: 'Cheung Ho Yin', classNumber: 4, part: 1, total: 1 },
        { studentIndex: 1, studentId: 's2', studentName: 'Wong Ka Yan', classNumber: 2, part: 1, total: 1 },
      ],
      mode: 'recognition',
    };

    // 1. Check UI Queue in MarkingReviewPanel
    const { container } = render(
      <MarkingReviewPanel
        pages={sourcePages}
        transcripts={sampleTranscripts}
        students={sampleStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={2}
        rubric={assignment.rubric}
        markings={sampleMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onEditFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRunAiMarking={vi.fn()}
        isAiMarkingLoading={false}
        aiMarkingError={null}
        onUpdateTranscriptText={vi.fn()}
        onUpdateFindings={vi.fn()}
        isBatchRunning={false}
        markingModelHealth={null}
        batchProgress={null}
      />
    );

    const markingQueueButtons = container.querySelectorAll('aside button[type="button"]');
    expect(markingQueueButtons).toHaveLength(4);
    expect(markingQueueButtons[0].textContent).toContain('03 · Lee Siu Lung');
    expect(markingQueueButtons[1].textContent).toContain('01 · Chan Tai Man');
    expect(markingQueueButtons[2].textContent).toContain('04 · Cheung Ho Yin');
    expect(markingQueueButtons[3].textContent).toContain('02 · Wong Ka Yan');

    // 2. Check batch queue ordering logic
    const batchResult = evaluateBatchMarkingEligibility({
      students: sampleStudents,
      appliedMatching,
      transcripts: sampleTranscripts,
      markings: sampleMarkings,
      pages: sourcePages,
    });

    expect(batchResult.items.map((item) => item.studentId)).toEqual(['s3', 's1', 's4', 's2']);
    expect(batchResult.items.map((item) => item.classNumber)).toEqual([3, 1, 4, 2]);
  });

  // Requirement D: Returning to Verify Scripts does not revert to [1, 2, 3, 4]
  it('D. Returning to Verify Scripts preserves [3, 1, 4, 2] without reverting to [1, 2, 3, 4]', () => {
    const appliedMatching: AppliedMatching = {
      classId: '3A',
      counts: [1, 1, 1, 1],
      assignedStudentIndices: [2, 0, 3, 1],
      map: [
        { studentIndex: 2, studentId: 's3', studentName: 'Lee Siu Lung', classNumber: 3, part: 1, total: 1 },
        { studentIndex: 0, studentId: 's1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 1 },
        { studentIndex: 3, studentId: 's4', studentName: 'Cheung Ho Yin', classNumber: 4, part: 1, total: 1 },
        { studentIndex: 1, studentId: 's2', studentName: 'Wong Ka Yan', classNumber: 2, part: 1, total: 1 },
      ],
      mode: 'recognition',
    };

    // Simulating re-mount / back-navigation from Step 5 to Step 4
    const { container, rerender } = render(
      <TranscriptVerificationPanel
        students={sampleStudents}
        pages={sourcePages}
        appliedMatching={appliedMatching}
        activeStudentIndex={2}
        transcripts={sampleTranscripts}
        assignment={assignment}
        onSelectStudent={vi.fn()}
        onUpdateTranscriptText={vi.fn()}
        onVerifyTranscript={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Initial check on Step 4
    let queueButtons = container.querySelectorAll('aside button[type="button"]');
    expect(queueButtons[0].textContent).toContain('03 · Lee Siu Lung');
    expect(queueButtons[1].textContent).toContain('01 · Chan Tai Man');
    expect(queueButtons[2].textContent).toContain('04 · Cheung Ho Yin');
    expect(queueButtons[3].textContent).toContain('02 · Wong Ka Yan');

    // Simulate navigation return with active student changed to s1 (index 0)
    rerender(
      <TranscriptVerificationPanel
        students={sampleStudents}
        pages={sourcePages}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        transcripts={sampleTranscripts}
        assignment={assignment}
        onSelectStudent={vi.fn()}
        onUpdateTranscriptText={vi.fn()}
        onVerifyTranscript={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Queue order must remain [3, 1, 4, 2]
    queueButtons = container.querySelectorAll('aside button[type="button"]');
    expect(queueButtons[0].textContent).toContain('03 · Lee Siu Lung');
    expect(queueButtons[1].textContent).toContain('01 · Chan Tai Man');
    expect(queueButtons[2].textContent).toContain('04 · Cheung Ho Yin');
    expect(queueButtons[3].textContent).toContain('02 · Wong Ka Yan');
    // Active student s1 must now display page 2 (scan_page_2.png)
    const scanImage = container.querySelector('img[alt="Student essay scan"]') as HTMLImageElement;
    expect(scanImage.src).toBe(sourcePages[1].previewUrl);
  });

  // Requirement E: Unmatched scripts do not disturb the order of confirmed matches
  it('E. Unmatched scripts do not disturb the order of confirmed matches', () => {
    const fivePages: ScanPage[] = [
      { id: 'p1', fileId: 'f1', fileName: 'scan_1.png', sourcePageNumber: 1, previewUrl: 'p1', orderIndex: 0 },
      { id: 'p2', fileId: 'f1', fileName: 'scan_2.png', sourcePageNumber: 2, previewUrl: 'p2', orderIndex: 1 },
      { id: 'p3_unmatched', fileId: 'f1', fileName: 'scan_3.png', sourcePageNumber: 3, previewUrl: 'p3', orderIndex: 2 },
      { id: 'p4', fileId: 'f1', fileName: 'scan_4.png', sourcePageNumber: 4, previewUrl: 'p4', orderIndex: 3 },
      { id: 'p5', fileId: 'f1', fileName: 'scan_5.png', sourcePageNumber: 5, previewUrl: 'p5', orderIndex: 4 },
    ];

    const recognitions: Record<string, PageIdentityRecognition> = {
      p1: { scanPageId: 'p1', pageNumber: 1, rawClass: '3A', rawStudentName: 'Lee Siu Lung', rawClassNumber: '3', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's3' },
      p2: { scanPageId: 'p2', pageNumber: 2, rawClass: '3A', rawStudentName: 'Chan Tai Man', rawClassNumber: '1', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's1' },
      p3_unmatched: { scanPageId: 'p3_unmatched', pageNumber: 3, rawClass: null, rawStudentName: null, rawClassNumber: null, classReadable: false, nameReadable: false, numberReadable: false, warnings: ['Illegible'], status: 'unmatched', matchedStudentId: null },
      p4: { scanPageId: 'p4', pageNumber: 4, rawClass: '3A', rawStudentName: 'Cheung Ho Yin', rawClassNumber: '4', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's4' },
      p5: { scanPageId: 'p5', pageNumber: 5, rawClass: '3A', rawStudentName: 'Wong Ka Yan', rawClassNumber: '2', classReadable: true, nameReadable: true, numberReadable: true, warnings: [], status: 'matched', matchedStudentId: 's2' },
    };

    const result = computeIdentityMatchingPreview(fivePages, recognitions, sampleStudents);

    expect(result.unmatchedPagesCount).toBe(1);
    expect(result.preview.map[2]).toBeNull();
    // Confirmed order is untouched and completely preserved: [s3, s1, s4, s2]
    expect(result.assignedStudentIndices).toEqual([2, 0, 3, 1]);
    expect(result.assignedStudentIndices.map((idx) => sampleStudents[idx].classNumber)).toEqual([3, 1, 4, 2]);
  });
});
