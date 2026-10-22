import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkingReviewPanel } from '../../../modules/essay-marking/components/MarkingReviewPanel';
import { evaluateBatchMarkingEligibility } from '../../../modules/essay-marking/utils/markingBatchQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  DEFAULT_RUBRIC,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  AssignmentConfig,
  StagedCandidateTranscript,
} from '../../../modules/essay-marking/types';

vi.mock('../../../modules/essay-marking/utils/scanImageResolver', () => ({
  resolveScanPageImageUrl: vi.fn((page: ScanPage) => page.previewUrl || 'blob:mock-image'),
  getFallbackScanImageUrl: vi.fn(() => 'blob:mock-fallback'),
}));

vi.mock('../../../modules/essay-marking/services/essayServiceRegistry', () => ({
  essayServices: {
    getAvailabilityService: () => ({
      checkStatus: vi.fn().mockResolvedValue({
        mathpix: { available: true },
        qwen: { available: true },
        deepseek: { available: true },
        ollama: { available: true },
      }),
    }),
    getTranscriptionService: () => ({
      transcribeScanPages: vi.fn().mockResolvedValue({
        success: true,
        rawOcrText: 'Mocked OCR Transcript Result',
        linesWithBboxes: [],
        uncertainRegions: [],
      }),
    }),
    getOcrService: () => ({}),
    getMarkingService: () => ({}),
  },
}));

describe('Unified Verify & Review Marking: OCR Restoration & Eligibility Rules', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', classNumber: 1, name: 'Abby', displayName: 'Abby', className: '4A' },
    { id: 's2', classNumber: 2, name: 'Bernice', displayName: 'Bernice', className: '4A' },
  ];

  const mockPages: ScanPage[] = [
    { id: 'p1', fileId: 'f1', orderIndex: 0, previewUrl: 'blob:p1' },
    { id: 'p2', fileId: 'f1', orderIndex: 1, previewUrl: 'blob:p2' },
  ];

  const appliedMatching: AppliedMatching = {
    classId: '4A',
    counts: [2, 0],
    map: [
      { pageIndex: 0, studentIndex: 0, partIndex: 1, totalParts: 2 },
      { pageIndex: 1, studentIndex: 0, partIndex: 2, totalParts: 2 },
    ],
    assignedStudentIndices: [0],
    mode: 'sequential',
    contextFingerprint: 'fp-test',
  };

  const mockAssignment: AssignmentConfig = {
    title: 'P4 Writing 2_1',
    isTitleCustomized: false,
    grade: 'P4',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'worksheet',
    scopePrompt: '',
    isConfirmed: true,
    rubric: DEFAULT_RUBRIC,
    templateRegions: [],
    transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
  };

  const defaultMarkings: Record<string, StudentMarkingState> = {
    s1: {
      studentId: 's1',
      scores: {},
      totalScore: 0,
      feedback: '',
      findings: [],
      isApproved: false,
    },
  };

  it('restores both OCR controls and toolbar in the unified page', () => {
    render(
      <MarkingReviewPanel
        pages={mockPages}
        transcripts={{}}
        students={mockStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={DEFAULT_RUBRIC}
        markings={defaultMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={false}
        assignment={mockAssignment}
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

    // Toolbar exists with Mode Selector & Settings
    expect(screen.getByText('OCR Mode:')).toBeInTheDocument();
    expect(screen.getByText(/Transcribe All Pending Essays/i)).toBeInTheDocument();
    expect(screen.getByText('Transcription Settings')).toBeInTheDocument();

    // Mode options in select
    expect(screen.getByText('A. Mathpix OCR Only')).toBeInTheDocument();
    expect(screen.getByText('B. Mathpix OCR + Qwen VL Verify')).toBeInTheDocument();

    // Action button for student
    expect(screen.getByText(/Start Mathpix OCR/i)).toBeInTheDocument();
  });

  it('distinguishes State 1: no_transcript (blocks marking and displays clear notice)', () => {
    const onRunAiMarking = vi.fn();

    render(
      <MarkingReviewPanel
        pages={mockPages}
        transcripts={{}}
        students={mockStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={DEFAULT_RUBRIC}
        markings={defaultMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={false}
        assignment={mockAssignment}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRunAiMarking={onRunAiMarking}
      />
    );

    // Header badge indicates no transcript
    expect(screen.getByText('無謄本 (No Transcript)')).toBeInTheDocument();

    // Notice banner informs teacher
    expect(
      screen.getByText(/尚未辨識或輸入謄本 \(No transcript\)/i)
    ).toBeInTheDocument();

    // Inline marking view explains action needed without misleading Step 4 instruction
    expect(screen.getByText('Please run OCR or enter transcript text before marking.')).toBeInTheDocument();

    // Run AI Marking button is disabled
    const runBtn = screen.getByRole('button', { name: /Run AI Marking/i });
    expect(runBtn).toBeDisabled();
    fireEvent.click(runBtn);
    expect(onRunAiMarking).not.toHaveBeenCalled();
  });

  it('distinguishes State 2: staged_ocr (displays staged candidate and blocks marking until applied)', () => {
    const onRunAiMarking = vi.fn();
    const stagedCandidates: Record<string, StagedCandidateTranscript> = {
      s1: {
        id: 'sc-1',
        studentId: 's1',
        transcript: 'Staged transcript from Mathpix OCR waiting for review',
        receivedAt: Date.now(),
        provider: 'mathpix_only',
        promptVersion: 'v1',
        settingsVersion: 'v1.0',
        pageSignature: 'sig-1',
        status: 'candidate_ready',
        pageResults: [],
        ocrMode: 'mathpix_only',
      },
    };

    render(
      <MarkingReviewPanel
        pages={mockPages}
        transcripts={{}}
        students={mockStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={DEFAULT_RUBRIC}
        markings={defaultMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={false}
        assignment={mockAssignment}
        stagedCandidates={stagedCandidates}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRunAiMarking={onRunAiMarking}
      />
    );

    // Shows staged candidate notification
    expect(
      screen.getByText(/OCR 候選文字已就緒 \(Staged OCR\)/i)
    ).toBeInTheDocument();

    // Staged candidate box is visible
    expect(screen.getByText(/Candidate Ready \(Mathpix Only\)/i)).toBeInTheDocument();
    expect(
      screen.getByText('Staged transcript from Mathpix OCR waiting for review')
    ).toBeInTheDocument();

    // Run AI marking disabled until applied
    const runBtn = screen.getByRole('button', { name: /Run AI Marking/i });
    expect(runBtn).toBeDisabled();
  });

  it('distinguishes State 3: unverified applied transcript (allows provisional AI marking)', () => {
    const onRunAiMarking = vi.fn();
    const unverifiedTranscripts: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'Last week, I went Happy park with my family.',
        editedText: 'Last week, I went Happy park with my family.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: false,
        revision: 1,
      },
    };

    render(
      <MarkingReviewPanel
        pages={mockPages}
        transcripts={unverifiedTranscripts}
        students={mockStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={DEFAULT_RUBRIC}
        markings={defaultMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={false}
        assignment={mockAssignment}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRunAiMarking={onRunAiMarking}
      />
    );

    // Header badge indicates unverified / provisional
    expect(screen.getByText(/未核對 \(Unverified · Provisional\)/i)).toBeInTheDocument();

    // Preliminary AI Marking banner explicitly labeled provisional
    expect(
      screen.getByText(/臨時 AI 評分 \(Provisional AI Marking\):/i)
    ).toBeInTheDocument();

    // Provisional button is ENABLED and clickable
    const provisionalBtn = screen.getByRole('button', {
      name: /Run AI Marking \(Provisional\)/i,
    });
    expect(provisionalBtn).toBeEnabled();
    fireEvent.click(provisionalBtn);
    expect(onRunAiMarking).toHaveBeenCalled();
  });

  it('distinguishes State 4: verified transcript (allows standard AI marking)', () => {
    const onRunAiMarking = vi.fn();
    const onVerifyTranscript = vi.fn();
    const verifiedTranscripts: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'Last week, I went Happy park with my family.',
        editedText: 'Last week, I went Happy park with my family.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        revision: 1,
      },
    };

    render(
      <MarkingReviewPanel
        pages={mockPages}
        transcripts={verifiedTranscripts}
        students={mockStudents}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={DEFAULT_RUBRIC}
        markings={defaultMarkings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        freshnessMap={{ s1: 'initial_pending' }}
        assignment={mockAssignment}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRunAiMarking={onRunAiMarking}
        onVerifyTranscript={onVerifyTranscript}
      />
    );

    // Verified badge
    expect(screen.getByText(/已核對 \(Verified\) ✓/i)).toBeInTheDocument();

    // Standard marking banner
    expect(
      screen.getByText(/Preliminary AI Marking:/i)
    ).toBeInTheDocument();

    const standardBtn = screen.getByRole('button', { name: /^Run AI Marking$/i });
    expect(standardBtn).toBeEnabled();
    fireEvent.click(standardBtn);
    expect(onRunAiMarking).toHaveBeenCalled();

    // Verify toggle button functions
    const verifyBtn = screen.getByRole('button', { name: /已確認核對/i });
    fireEvent.click(verifyBtn);
    expect(onVerifyTranscript).toHaveBeenCalledWith('s1');
  });

  it('enforces consistent eligibility rules between single and batch marking', () => {
    const mockStudentsBatch: StudentRosterItem[] = [
      { id: 's_empty', classNumber: 1, name: 'Empty Transcript', displayName: 'Empty Transcript', className: '4A' },
      { id: 's_unverified', classNumber: 2, name: 'Unverified Student', displayName: 'Unverified Student', className: '4A' },
      { id: 's_verified', classNumber: 3, name: 'Verified Student', displayName: 'Verified Student', className: '4A' },
    ];

    const transcriptsBatch: Record<string, StudentTranscriptState> = {
      s_empty: {
        studentId: 's_empty',
        rawOcrText: '',
        editedText: '',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: false,
      },
      s_unverified: {
        studentId: 's_unverified',
        rawOcrText: 'Unverified script content for provisional batch marking.',
        editedText: 'Unverified script content for provisional batch marking.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: false,
      },
      s_verified: {
        studentId: 's_verified',
        rawOcrText: 'Verified script content.',
        editedText: 'Verified script content.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
      },
    };

    const markingsBatch: Record<string, StudentMarkingState> = {};

    const batchMatching: AppliedMatching = {
      classId: '4A',
      counts: [1, 1, 1],
      map: [
        { pageIndex: 0, studentIndex: 0, partIndex: 1, totalParts: 1 },
        { pageIndex: 1, studentIndex: 1, partIndex: 1, totalParts: 1 },
        { pageIndex: 2, studentIndex: 2, partIndex: 1, totalParts: 1 },
      ],
      assignedStudentIndices: [0, 1, 2],
      mode: 'sequential',
      contextFingerprint: 'fp-batch',
    };

    const batchPages: ScanPage[] = [
      { id: 'bp1', fileId: 'f1', orderIndex: 0 },
      { id: 'bp2', fileId: 'f1', orderIndex: 1 },
      { id: 'bp3', fileId: 'f1', orderIndex: 2 },
    ];

    // 1. Batch marking with default allowProvisional (true)
    const evalResult = evaluateBatchMarkingEligibility({
      assignmentGrade: 'P4',
      students: mockStudentsBatch,
      appliedMatching: batchMatching,
      transcripts: transcriptsBatch,
      markings: markingsBatch,
      pages: batchPages,
      allowProvisional: true,
    });

    // Empty transcript is skipped with reason
    const emptyItem = evalResult.items.find((it) => it.studentId === 's_empty');
    expect(emptyItem?.status).toBe('skipped');
    expect(emptyItem?.skipReason).toContain('謄本文字為空');

    // Unverified with content is eligible provisionally (status: pending)
    const unverifiedItem = evalResult.items.find((it) => it.studentId === 's_unverified');
    expect(unverifiedItem?.status).toBe('pending');
    expect(unverifiedItem?.isProvisional).toBe(true);

    // Verified is eligible (status: pending)
    const verifiedItem = evalResult.items.find((it) => it.studentId === 's_verified');
    expect(verifiedItem?.status).toBe('pending');
    expect(verifiedItem?.isProvisional).toBe(false);

    expect(evalResult.provisionalCount).toBe(1);
    expect(evalResult.eligibleCount).toBe(2);
    expect(evalResult.skippedCount).toBe(1);

    // 2. Batch marking in strict mode (allowProvisional = false)
    const strictResult = evaluateBatchMarkingEligibility({
      assignmentGrade: 'P4',
      students: mockStudentsBatch,
      appliedMatching: batchMatching,
      transcripts: transcriptsBatch,
      markings: markingsBatch,
      pages: batchPages,
      allowProvisional: false,
    });

    const strictUnverified = strictResult.items.find((it) => it.studentId === 's_unverified');
    expect(strictUnverified?.status).toBe('skipped');
    expect(strictUnverified?.skipReason).toContain('謄本尚未');
  });
});
