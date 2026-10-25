import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TranscriptVerificationPanel } from '../../../modules/essay-marking/components/TranscriptVerificationPanel';
import { TranscriptionToolbar } from '../../../modules/essay-marking/components/TranscriptionToolbar';
import { essayServices } from '../../../modules/essay-marking/services/essayServiceRegistry';
import { loadImage, cropRegionFromImage } from '../../../modules/essay-marking/utils/scanRegionCropper';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  StagedCandidateTranscript,
} from '../../../modules/essay-marking/types';
import {
  BatchTranscriptionQueueController,
  buildBatchTasks,
  combineCandidateTranscript,
} from '../../../modules/essay-marking/utils/transcriptionBatchQueue';
import { normalizeOcrTranscript } from '../../../modules/essay-marking/utils/ocrFormatNormalizer';
import { DEFAULT_OCR_CLEANUP_RULES } from '../../../modules/essay-marking/utils/ocrRulesSchema';

vi.mock('../../../modules/essay-marking/utils/scanRegionCropper', () => ({
  loadImage: vi.fn(),
  cropRegionFromImage: vi.fn(),
}));

const mockStudents: StudentRosterItem[] = [
  {
    id: 'student-1',
    assignmentId: 'assign-1',
    studentNumber: '001',
    classNumber: 1,
    studentName: 'Chan Tai Man',
    displayName: 'Chan Tai Man',
    matchedPageCount: 2,
    className: 'Primary 4',
  },
  {
    id: 'student-2',
    assignmentId: 'assign-1',
    studentNumber: '002',
    classNumber: 2,
    studentName: 'Lee Siu Lung',
    displayName: 'Lee Siu Lung',
    matchedPageCount: 1,
    className: 'Primary 4',
  },
];

const mockPages: ScanPage[] = [
  {
    id: 'page-1',
    assignmentId: 'assign-1',
    fileName: 'scan_01.jpg',
    pageNumber: 1,
    previewUrl: 'data:image/png;base64,PAGE1',
    fileSize: 1024,
  },
  {
    id: 'page-2',
    assignmentId: 'assign-1',
    fileName: 'scan_02.jpg',
    pageNumber: 2,
    previewUrl: 'data:image/png;base64,PAGE2',
    fileSize: 1024,
  },
  {
    id: 'page-3',
    assignmentId: 'assign-1',
    fileName: 'scan_03.jpg',
    pageNumber: 3,
    previewUrl: 'data:image/png;base64,PAGE3',
    fileSize: 1024,
  },
];

const mockAppliedMatching: AppliedMatching = {
  assignmentId: 'assign-1',
  classId: 'Class 4A',
  assignedStudentIndices: [0, 1],
  map: [
    { studentIndex: 0, part: 1, total: 1 },
    { studentIndex: 1, part: 1, total: 1 },
  ],
};

const mockTranscripts: Record<string, StudentTranscriptState> = {
  'student-1': {
    studentId: 'student-1',
    rawOcrText: null,
    editedText: '',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: false,
  },
  'student-2': {
    studentId: 'student-2',
    rawOcrText: 'Existing teacher text here',
    editedText: 'Existing teacher text here',
    isManuallyEntered: true,
    uncertainRegions: [],
    isVerified: false,
  },
};

const mockAssignment: AssignmentConfig = {
  id: 'assign-1',
  title: 'English Narrative Composition',
  worksheetFileName: 'narrative.pdf',
  worksheetFile: null,
  worksheetPreviewUrl: 'data:image/png;base64,AAAA',
  responseFormat: 'free_writing',
  grade: 'Primary 4',
  scopePrompt: 'Write a narrative about an unexpected adventure.',
  isConfirmed: true,
  rubric: [],
  templateRegions: [],
  transcriptionSettings: {
    version: 'v1.0',
    primaryLanguage: 'en',
    printedLabelsMode: 'separate_context',
    notes: 'English narrative',
    readingOrder: [],
  },
};

describe('Qwen VL OCR — Local only Option & Pipeline Requirements', () => {
  let mockOcrRecognize: any;
  let mockTranscribePage: any;
  let mockGetOcrPromptSnapshot: any;
  let mockCheckStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOcrRecognize = vi.fn().mockResolvedValue({
      status: 'success',
      transcript: 'Mathpix output text.',
      confidence: 0.95,
      pageCount: 1,
    });

    mockTranscribePage = vi.fn().mockResolvedValue({
      status: 'success',
      transcript: 'Yesterday, I saw a big dog.\nIt bark at me.',
      linesWithBboxes: [
        { text: 'Yesterday, I saw a big dog.', bbox: [50, 100, 450, 150] },
        { text: 'It bark at me.', bbox: [50, 160, 300, 210] },
      ],
      modelId: 'qwen3-vl-32b',
      promptVersion: 'qwen-vl-ocr-abc123456789',
      promptHash: 'abc123456789',
      settingsVersion: 'v1.0',
    });

    mockGetOcrPromptSnapshot = vi.fn().mockResolvedValue({
      ok: true,
      snapshot: {
        promptText: 'You are an objective, precise, and faithful handwriting transcription model.',
        promptHash: 'abc123456789',
        promptVersion: 'qwen-vl-ocr-abc123456789',
        rulesVersion: 'v1.4',
        filePath: 'bridges/essay-marking-bridge/prompts/qwen-vl-ocr-prompt.md',
      },
    });

    mockCheckStatus = vi.fn().mockResolvedValue({
      ocr: { status: 'configured', provider: 'Mathpix' },
      visualVerification: { status: 'available', model: 'Qwen3-VL-32B (Local ROCm)' },
    });

    essayServices.getOcrService = vi.fn().mockReturnValue({
      recognize: mockOcrRecognize,
    });

    essayServices.getTranscriptionService = vi.fn().mockReturnValue({
      transcribePage: mockTranscribePage,
      getOcrPromptSnapshot: mockGetOcrPromptSnapshot,
    });

    essayServices.getAvailabilityService = vi.fn().mockReturnValue({
      checkStatus: mockCheckStatus,
    });
  });

  describe('1. OCR Engine Selection & UI Exposure', () => {
    it('exposes clearly labelled options: Mathpix OCR and Qwen VL OCR — Local only', () => {
      render(
        <TranscriptionToolbar
          provider="local_qwen_vl"
          onSelectProvider={vi.fn()}
          onOpenSettings={vi.fn()}
          onTranscribeAllPending={vi.fn()}
          pendingCount={2}
          isBatchRunning={false}
          batchProgress={null}
          onPauseBatch={vi.fn()}
          onResumeBatch={vi.fn()}
          onRetryFailed={vi.fn()}
          pageCount={1}
          isDryRun={false}
          isMathpixConfigured={true}
          qwenStatus="available"
        />
      );

      const select = screen.getByLabelText(/OCR Mode:/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('local_qwen_vl');

      const options = Array.from(select.options).map((opt) => opt.text);
      expect(options).toContain('Mathpix OCR');
      expect(options).toContain('Qwen VL OCR — Local only');

      // Displays explanation for Local Only mode
      expect(
        screen.getByText(/Direct local OCR using Qwen VL on port 18088/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Qwen VL \(18088\) Ready/i)).toBeInTheDocument();
    });
  });

  describe('2. Qwen VL Only: Zero Mathpix calls across Batch, Student, and Page Retry', () => {
    it('executes individual student transcription using Qwen VL ONLY with zero Mathpix calls', async () => {
      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      // Select Qwen VL OCR — Local only
      const modeSelect = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(modeSelect, { target: { value: 'local_qwen_vl' } });

      // Click "Start Qwen VL OCR"
      const startBtn = screen.getByRole('button', { name: /Start Qwen VL OCR/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(mockTranscribePage).toHaveBeenCalledTimes(1);
      });

      // Crucial invariant: zero calls to Mathpix
      expect(mockOcrRecognize).not.toHaveBeenCalled();

      // Prompt snapshot was passed to transcribePage
      const firstCallArgs = mockTranscribePage.mock.calls[0][0];
      expect(firstCallArgs.promptSnapshot).toBeDefined();
      expect(firstCallArgs.promptSnapshot.promptHash).toBe('abc123456789');
    });

    it('fails visibly with actionable error when local VL service on 18088 is offline, with ZERO Mathpix fallback', async () => {
      mockCheckStatus.mockResolvedValue({
        ocr: { status: 'configured', provider: 'Mathpix' },
        visualVerification: { status: 'error', details: 'Local model unreachable' },
      });

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      const modeSelect = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(modeSelect, { target: { value: 'local_qwen_vl' } });

      const startBtn = screen.getByRole('button', { name: /Start Qwen VL OCR/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Qwen VL OCR service is offline or unreachable on port 18088/i)
        ).toBeInTheDocument();
      });

      // Absolutely zero Mathpix fallback calls
      expect(mockOcrRecognize).not.toHaveBeenCalled();
      expect(mockTranscribePage).not.toHaveBeenCalled();
    });

    it('fails visibly when OCR prompt file is missing or invalid, with no silent fallback', async () => {
      mockGetOcrPromptSnapshot.mockResolvedValue({
        ok: false,
        error: 'OCR prompt file bridges/essay-marking-bridge/prompts/qwen-vl-ocr-prompt.md is empty',
      });

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      const modeSelect = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(modeSelect, { target: { value: 'local_qwen_vl' } });

      const startBtn = screen.getByRole('button', { name: /Start Qwen VL OCR/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(screen.getByText(/Qwen VL OCR prompt error/i)).toBeInTheDocument();
      });

      expect(mockOcrRecognize).not.toHaveBeenCalled();
      expect(mockTranscribePage).not.toHaveBeenCalled();
    });

    it('retries single page with Qwen VL and zero Mathpix calls', async () => {
      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      const modeSelect = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(modeSelect, { target: { value: 'local_qwen_vl' } });

      const retryBtn = screen.getByRole('button', { name: /Retry Page 1/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(mockTranscribePage).toHaveBeenCalled();
      });

      expect(mockOcrRecognize).not.toHaveBeenCalled();
    });
  });

  describe('3. Batch Queue Controller & Blank Page Exclusion', () => {
    it('runs batch queue using local Qwen VL, skips blank pages, and passes one immutable prompt snapshot', async () => {
      const blankPages: ScanPage[] = [
        {
          id: 'page-1',
          assignmentId: 'assign-1',
          fileName: 'scan_01.jpg',
          pageNumber: 1,
          previewUrl: 'data:image/png;base64,PAGE1',
          fileSize: 1024,
          isBlank: false,
        },
        {
          id: 'page-2',
          assignmentId: 'assign-1',
          fileName: 'scan_02.jpg',
          pageNumber: 2,
          previewUrl: 'data:image/png;base64,PAGE2',
          fileSize: 1024,
          isBlank: true, // Blank continuation page
        },
      ];

      const singleStudentMatching: AppliedMatching = {
        assignmentId: 'assign-1',
        classId: 'Class 4A',
        assignedStudentIndices: [0],
        map: [
          { studentIndex: 0, part: 1, total: 2 },
          { studentIndex: 0, part: 2, total: 2 },
        ],
      };

      const { tasks, skippedStudents } = buildBatchTasks({
        students: [mockStudents[0]],
        pages: blankPages,
        appliedMatching: singleStudentMatching,
        transcripts: {},
      });

      expect(tasks).toHaveLength(2);

      const completedCandidates: StagedCandidateTranscript[] = [];
      const controller = new BatchTranscriptionQueueController({
        tasks,
        skippedStudents,
        settings: mockAssignment.transcriptionSettings,
        totalEssays: 1,
        onStudentCompleted: (candidate) => {
          completedCandidates.push(candidate);
        },
      });

      const fixedPromptSnapshot = {
        promptText: 'Test immutable prompt snapshot',
        promptHash: 'hash-fixed-123',
        promptVersion: 'qwen-vl-ocr-hash-fixed-123',
        rulesVersion: 'v1.4',
        filePath: 'prompts/qwen-vl-ocr-prompt.md',
      };

      await controller.run({
        transcriptionService: essayServices.getTranscriptionService(),
        ocrService: essayServices.getOcrService(),
        provider: 'local_qwen_vl',
        appliedMatching: singleStudentMatching,
        pages: blankPages,
        assignmentId: 'assign-1',
        promptSnapshot: fixedPromptSnapshot,
      });

      // Page 1 is called, Page 2 (blank) is skipped!
      expect(mockTranscribePage).toHaveBeenCalledTimes(1);
      expect(mockOcrRecognize).not.toHaveBeenCalled();

      expect(mockTranscribePage.mock.calls[0][0].promptSnapshot.promptHash).toBe('hash-fixed-123');

      expect(completedCandidates).toHaveLength(1);
      expect(completedCandidates[0].status).toBe('candidate_ready');
      expect(completedCandidates[0].promptHash).toBe('abc123456789'); // From response
    });
  });

  describe('4. Deterministic Application Cleanup via ocr-cleanup-rules.md', () => {
    it('applies cleanup rules in application code, preserving raw OCR evidence separately from normalized transcript', () => {
      const rawOcrText = 'First line with rule marker.\n[unreadable] word here.\nThird line.';
      const { normalizedText, notices } = normalizeOcrTranscript(rawOcrText, DEFAULT_OCR_CLEANUP_RULES);

      // Raw OCR text is not mutated
      expect(rawOcrText).toContain('[unreadable]');

      // Combined candidate transcript separates rawTranscript and normalized transcript
      const candidate = combineCandidateTranscript({
        studentId: 'student-1',
        studentIndex: 0,
        tasksForStudent: [
          {
            taskId: 't1',
            studentId: 'student-1',
            studentIndex: 0,
            studentName: 'Chan Tai Man',
            classNumber: 1,
            scanPage: mockPages[0],
            part: 1,
            totalParts: 1,
            regions: [],
            status: 'success',
            transcript: rawOcrText,
            promptVersion: 'qwen-vl-ocr-v1',
            promptHash: 'hash123',
          },
        ],
        appliedMatching: mockAppliedMatching,
        pages: mockPages,
        settings: mockAssignment.transcriptionSettings,
        assignmentId: 'assign-1',
        provider: 'local_qwen_vl',
      });

      expect(candidate.rawTranscript).toBe(rawOcrText);
      expect(candidate.transcript).toBe(normalizedText);
      expect(candidate.promptHash).toBe('hash123');
      expect(candidate.provider).toBe('local_qwen_vl');
    });
  });
});
