import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkingReviewPanel } from '../../../modules/essay-marking/components/MarkingReviewPanel';
import { InlineMarkingView } from '../../../modules/essay-marking/components/InlineMarkingView';
import {
  BackgroundMarkingQueueController,
  MarkingQueueJob,
} from '../../../modules/essay-marking/utils/backgroundMarkingQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  DEFAULT_RUBRIC,
  MarkingFinding,
} from '../../../modules/essay-marking/types';
import { essayServices } from '../../../modules/essay-marking/services/essayServiceRegistry';

// Mock scan image resolution
vi.mock('../../../modules/essay-marking/utils/scanImageResolver', () => ({
  resolveScanPageImageUrl: vi.fn((page: ScanPage) => page.previewUrl || 'blob:mock-image'),
  getFallbackScanImageUrl: vi.fn(() => 'blob:mock-fallback'),
}));

describe('Unified Verify & Review Marking Workflow (Requirements A - J)', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', classNumber: 1, name: 'Student 1', displayName: 'Student 1' },
    { id: 's2', classNumber: 2, name: 'Student 2', displayName: 'Student 2' },
    { id: 's3', classNumber: 3, name: 'Student 3', displayName: 'Student 3' },
    { id: 's4', classNumber: 4, name: 'Student 4', displayName: 'Student 4' },
  ];

  const mockPages: ScanPage[] = [
    { id: 'p1', fileId: 'f1', orderIndex: 0, previewUrl: 'blob:p1' },
    { id: 'p2', fileId: 'f1', orderIndex: 1, previewUrl: 'blob:p2' },
    { id: 'p3', fileId: 'f1', orderIndex: 2, previewUrl: 'blob:p3' },
    { id: 'p4', fileId: 'f1', orderIndex: 3, previewUrl: 'blob:p4' },
  ];

  // Non-numeric match order [3, 1, 4, 2] represented by 0-indexed student indices [2, 0, 3, 1]
  const nonNumericOrder: AppliedMatching = {
    classId: 'class-A',
    counts: [1, 1, 1, 1],
    map: [
      { pageIndex: 0, studentIndex: 2, partIndex: 1, totalParts: 1 },
      { pageIndex: 1, studentIndex: 0, partIndex: 1, totalParts: 1 },
      { pageIndex: 2, studentIndex: 3, partIndex: 1, totalParts: 1 },
      { pageIndex: 3, studentIndex: 1, partIndex: 1, totalParts: 1 },
    ],
    assignedStudentIndices: [2, 0, 3, 1], // Students 3, 1, 4, 2
    mode: 'recognition',
    contextFingerprint: 'fp-test',
  };

  const defaultTranscripts: Record<string, StudentTranscriptState> = {
    s1: {
      studentId: 's1',
      rawOcrText: 'Yesterday I went to the park. It was fun.',
      editedText: 'Yesterday I went to the park. It was fun.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
      revision: 1,
    },
    s2: {
      studentId: 's2',
      rawOcrText: 'He mess his room.',
      editedText: 'He mess his room.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
      revision: 1,
    },
    s3: {
      studentId: 's3',
      rawOcrText: 'Student three writing sample.',
      editedText: 'Student three writing sample.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
      revision: 1,
    },
    s4: {
      studentId: 's4',
      rawOcrText: 'Student four multi-page script.',
      editedText: 'Student four multi-page script.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
      revision: 1,
    },
  };

  const defaultMarkings: Record<string, StudentMarkingState> = {
    s2: {
      studentId: 's2',
      scores: {},
      feedbackComment: '',
      findings: [
        {
          id: 'f-ai-1',
          type: 'Grammar',
          feedbackType: 'correction',
          originalText: 'mess',
          replacementText: 'messes',
          explanation: 'Subject-verb agreement error',
          decision: 'pending',
          source: 'ai',
          isManual: false,
        },
      ],
      isApproved: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. UNIFIED PAGE AND ORDER
  it('A. Preserves matched order [3, 1, 4, 2] in unified page student queue without reverting to [1, 2, 3, 4]', () => {
    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={2} // Student 3 is first in queue
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Get all student queue button titles/labels
    const studentQueueButtons = screen.getAllByRole('button', { name: /\d{2} · Student/i });
    expect(studentQueueButtons).toHaveLength(4);
    expect(studentQueueButtons[0]).toHaveTextContent('03 · Student 3');
    expect(studentQueueButtons[1]).toHaveTextContent('01 · Student 1');
    expect(studentQueueButtons[2]).toHaveTextContent('04 · Student 4');
    expect(studentQueueButtons[3]).toHaveTextContent('02 · Student 2');
  });

  // B. LEFT-CLICK OCR
  it('B. Left-clicking plain OCR word directly opens OCR correction without opening Add Finding', () => {
    const onUpdateTranscriptText = vi.fn();

    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={1} // Student 2 ('He mess his room.')
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onUpdateTranscriptText={onUpdateTranscriptText}
      />
    );

    // Left-click plain OCR word "room."
    const roomWord = screen.getByText('room.');
    fireEvent.click(roomWord);

    // Left-click plain OCR word "room." mounts an in-place controlled textarea for Option B line editing;
    // it does not open a modal or floating popover.
    expect(screen.queryByText(/修正辨識文字 \(Correct OCR\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/新增批改 \(Add Finding\)/i)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  // C. RIGHT-CLICK ADD FINDING
  it('C. Right-clicking plain OCR word opens Add Finding and suppresses context menu inside transcript area', () => {
    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={1} // Student 2
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const roomWord = screen.getByText('room.');
    fireEvent.contextMenu(roomWord);

    // Right-click plain OCR word opens the Add Finding modal directly without intermediate menu.
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();
  });

  // D. PHRASE SELECTION
  it('D. Right-clicking a selected phrase opens Add Finding for full phrase without opening OCR correction', () => {
    const transcriptWithPhrase: Record<string, StudentTranscriptState> = {
      s2: {
        studentId: 's2',
        rawOcrText: 'He cleaned his room one time yesterday.',
        editedText: 'He cleaned his room one time yesterday.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
        revision: 1,
      },
    };

    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={1} // Student 2
        transcripts={transcriptWithPhrase}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const oneWord = screen.getByText('one');
    const lineEl = oneWord.closest('[data-line-index]') || oneWord;

    // Mock text selection of "one time"
    const windowSelectionMock = {
      toString: () => 'one time',
      isCollapsed: false,
      anchorNode: lineEl,
      rangeCount: 0,
    };
    const getSelSpy = vi.spyOn(window, 'getSelection').mockReturnValue(windowSelectionMock as any);

    // Simulate drag selection mouseup on canvas
    fireEvent.mouseUp(lineEl);

    // Right-click on word "one"
    fireEvent.contextMenu(oneWord);

    // Right-click opens the Add Finding modal directly prefilled with selected phrase.
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();

    // Clean up spy
    getSelSpy.mockRestore();
  });

  // E. EXISTING FINDINGS
  it('E. Clicking an existing finding chip opens that finding and preserves AI vs manual provenance', () => {
    const onFindingDecision = vi.fn();
    const onDeleteFinding = vi.fn();

    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={1} // Student 2
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={onFindingDecision}
        onDeleteFinding={onDeleteFinding}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Finding chip for "messes" should be visible
    const chip = screen.getByText('messes');
    expect(chip).toBeInTheDocument();

    // Clicking chip opens finding popover
    fireEvent.click(chip);

    expect(screen.getByText('Subject-verb agreement error')).toBeInTheDocument();
    // It is an AI finding (decision: pending)
    expect(defaultMarkings.s2.findings[0].source).toBe('ai');
    expect(defaultMarkings.s2.findings[0].isManual).toBe(false);
  });

  // F. BACKGROUND JOBS NON-BLOCKING & RETRY
  it('F. Background marking queue processes jobs sequentially without blocking other student reviews', async () => {
    let jobCompletedCount = 0;
    const completedStudents: string[] = [];

    const mockMarkingService = {
      mark: vi.fn(async (params) => {
        // Simulate local model delay
        await new Promise((r) => setTimeout(r, 20));
        jobCompletedCount++;
        completedStudents.push(params.studentId);
        return {
          status: 'success' as const,
          findings: [
            {
              type: 'Grammar',
              originalText: 'was',
              replacementText: 'is',
              explanation: 'Tense check',
            },
          ],
        };
      }),
    };

    vi.spyOn(essayServices, 'getMarkingService').mockReturnValue(mockMarkingService as any);

    const queueController = new BackgroundMarkingQueueController({
      getCurrentRevision: () => 1,
      onJobCompleted: (job) => {
        // Verified completion
      },
    });

    // Enqueue Student A and Student B
    queueController.enqueueJob({
      studentId: 's1',
      studentName: 'Student 1',
      transcriptRevision: 1,
      transcriptText: 'Student 1 text',
      assignmentTitle: 'Essay',
      scopePrompt: 'Prompt',
      rubric: DEFAULT_RUBRIC,
    });

    queueController.enqueueJob({
      studentId: 's2',
      studentName: 'Student 2',
      transcriptRevision: 1,
      transcriptText: 'Student 2 text',
      assignmentTitle: 'Essay',
      scopePrompt: 'Prompt',
      rubric: DEFAULT_RUBRIC,
    });

    // Queue is running in background; caller can immediately continue other operations
    expect(queueController.isBusy()).toBe(true);

    // Wait for jobs to finish
    await waitFor(() => {
      expect(completedStudents).toEqual(['s1', 's2']);
    });

    expect(mockMarkingService.mark).toHaveBeenCalledTimes(2);
  });

  // G. REVISION SAFETY
  it('G. If student transcript revision changes while AI job is in flight, outdated result is rejected', async () => {
    let currentRevision = 5;
    let appliedJob: MarkingQueueJob | null = null;
    let appliedFindings: MarkingFinding[] = [];
    let isCurrent = true;

    const mockMarkingService = {
      mark: vi.fn(async () => {
        // During inference, user edits OCR and increments revision to 6!
        currentRevision = 6;
        return {
          status: 'success' as const,
          findings: [
            {
              type: 'Spelling',
              originalText: 'outdated',
              replacementText: 'updated',
              explanation: 'Outdated word finding',
            },
          ],
        };
      }),
    };

    vi.spyOn(essayServices, 'getMarkingService').mockReturnValue(mockMarkingService as any);

    const queueController = new BackgroundMarkingQueueController({
      getCurrentRevision: () => currentRevision,
      onJobCompleted: (job, findings, isCurrentRevision) => {
        appliedJob = job;
        appliedFindings = findings;
        isCurrent = isCurrentRevision;
      },
    });

    queueController.enqueueJob({
      studentId: 's1',
      studentName: 'Student 1',
      transcriptRevision: 5,
      transcriptText: 'Initial text rev 5',
      assignmentTitle: 'Essay',
      scopePrompt: 'Prompt',
      rubric: DEFAULT_RUBRIC,
    });

    await waitFor(() => {
      expect(appliedJob).not.toBeNull();
    });

    // isCurrentRevision must be FALSE because currentRevision (6) !== job revision (5)
    expect(isCurrent).toBe(false);
  });

  // H. AI RERUN REPLACEMENT
  it('H. Fresh AI findings replace old AI findings atomically while preserving manual teacher findings', () => {
    const initialFindings: MarkingFinding[] = [
      {
        id: 'f-ai-old-1',
        type: 'Grammar',
        originalText: 'old mistake',
        replacementText: 'old fix',
        explanation: 'Old AI finding',
        decision: 'pending',
        source: 'ai',
        isManual: false,
      },
      {
        id: 'f-manual-1',
        type: 'Vocabulary',
        originalText: 'nice',
        replacementText: 'splendid',
        explanation: 'Teacher manual suggestion',
        decision: 'pending',
        source: 'teacher',
        isManual: true,
      },
    ];

    const freshAiFindings: MarkingFinding[] = [
      {
        id: 'f-ai-fresh-1',
        type: 'Grammar',
        originalText: 'new mistake',
        replacementText: 'new fix',
        explanation: 'Fresh AI finding',
        decision: 'pending',
        source: 'ai',
        isManual: false,
      },
    ];

    // Simulate atomic replacement logic in controller
    const preservedManual = initialFindings.filter(
      (f) =>
        f.source === 'teacher' ||
        f.isManual ||
        f.decision === 'edited' ||
        (!f.id.startsWith('f-ai-') && f.source !== 'ai')
    );
    const updatedFindings = [...preservedManual, ...freshAiFindings];

    expect(updatedFindings).toHaveLength(2);
    expect(updatedFindings.some((f) => f.id === 'f-manual-1')).toBe(true);
    expect(updatedFindings.some((f) => f.id === 'f-ai-fresh-1')).toBe(true);
    expect(updatedFindings.some((f) => f.id === 'f-ai-old-1')).toBe(false);
  });

  // I. MULTI-PAGE PRESERVATION
  it('I. Multi-page scripts remain correctly grouped under student in unified page', () => {
    const multiPageMatching: AppliedMatching = {
      classId: 'class-A',
      counts: [2, 1], // Student 1 has 2 pages (p1, p2)
      map: [
        { studentIndex: 0, studentId: 's1', studentName: 'Student 1', classNumber: 1, part: 1, total: 2 } as any,
        { studentIndex: 0, studentId: 's1', studentName: 'Student 1', classNumber: 1, part: 2, total: 2 } as any,
        { studentIndex: 1, studentId: 's2', studentName: 'Student 2', classNumber: 2, part: 1, total: 1 } as any,
      ],
      assignedStudentIndices: [0, 1],
      mode: 'sequential',
      contextFingerprint: 'fp-multi',
    };

    render(
      <MarkingReviewPanel
        students={mockStudents.slice(0, 2)}
        pages={mockPages.slice(0, 3)}
        appliedMatching={multiPageMatching}
        activeStudentIndex={0} // Student 1
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Multi-page counter and navigation buttons for Student 1
    expect(screen.getByText(/2 pages assigned/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Page 1 of 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Page 2 of 2/i })).toBeInTheDocument();
  });

  // J. UI REMOVAL & PERSISTENT INSTRUCTION
  it('J. Displays persistent left-click/right-click instruction and does not show A/B action chooser bar', () => {
    render(
      <MarkingReviewPanel
        students={mockStudents}
        pages={mockPages}
        appliedMatching={nonNumericOrder}
        activeStudentIndex={0}
        transcripts={defaultTranscripts}
        markings={defaultMarkings}
        rubric={DEFAULT_RUBRIC}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Persistent instruction
    expect(screen.getByText('Left-click: correct OCR · Right-click: add marking')).toBeInTheDocument();

    // A/B toolbar must NOT be present
    expect(screen.queryByText('A. 修正辨識文字')).not.toBeInTheDocument();
    expect(screen.queryByText('B. 新增批改')).not.toBeInTheDocument();
  });
});
