import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TranscriptVerificationPanel } from '../../../modules/essay-marking/components/TranscriptVerificationPanel';
import { TranscriptionToolbar } from '../../../modules/essay-marking/components/TranscriptionToolbar';
import { StagedCandidateBox } from '../../../modules/essay-marking/components/StagedCandidateBox';
import { essayServices } from '../../../modules/essay-marking/services/essayServiceRegistry';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  StagedCandidateTranscript,
} from '../../../modules/essay-marking/types';

// Mock student roster
const mockStudents: StudentRosterItem[] = [
  {
    id: 'student-1',
    assignmentId: 'assign-1',
    studentNumber: '001',
    classNumber: 1,
    studentName: 'Chan Tai Man',
    displayName: 'Chan Tai Man',
    matchedPageCount: 1,
  },
  {
    id: 'student-2',
    assignmentId: 'assign-1',
    studentNumber: '002',
    classNumber: 2,
    studentName: 'Lee Siu Lung',
    displayName: 'Lee Siu Lung',
    matchedPageCount: 1,
  },
];

// Mock scan pages
const mockPages: ScanPage[] = [
  {
    id: 'page-1',
    assignmentId: 'assign-1',
    fileName: 'scan_01.jpg',
    pageNumber: 1,
    previewUrl: 'data:image/png;base64,AAAA',
    fileSize: 1024,
  },
  {
    id: 'page-2',
    assignmentId: 'assign-1',
    fileName: 'scan_02.jpg',
    pageNumber: 2,
    previewUrl: 'data:image/png;base64,BBBB',
    fileSize: 1024,
  },
];

// Mock matching
const mockAppliedMatching: AppliedMatching = {
  assignmentId: 'assign-1',
  classId: 'Class 4A',
  assignedStudentIndices: [0, 1],
  map: [
    { studentIndex: 0, part: 1, total: 1 },
    { studentIndex: 1, part: 1, total: 1 },
  ],
};

// Mock transcripts
const mockTranscripts: Record<string, StudentTranscriptState> = {
  'student-1': {
    studentId: 'student-1',
    rawOcrText: null,
    editedText: '',
    isManuallyEntered: true,
    uncertainRegions: [],
    isVerified: false,
  },
  'student-2': {
    studentId: 'student-2',
    rawOcrText: null,
    editedText: 'Existing teacher text here',
    isManuallyEntered: true,
    uncertainRegions: [],
    isVerified: false,
  },
};

const mockAssignment: AssignmentConfig = {
  title: 'English Narrative Composition',
  worksheetFileName: 'narrative.pdf',
  worksheetFile: null,
  worksheetPreviewUrl: 'data:image/png;base64,AAAA',
  responseFormat: 'free_writing',
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

describe('Step 4: Verify Script - Mathpix OCR & Mode Selector Requirements', () => {
  let mockOcrRecognize: any;
  let mockVerifyTranscription: any;
  let mockCheckStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOcrRecognize = vi.fn().mockResolvedValue({
      status: 'success',
      transcript: 'Yesterday, I saw a big dog.\nIt bark at me.',
      confidence: 0.95,
      pageCount: 1,
    });

    mockVerifyTranscription = vi.fn().mockResolvedValue({
      status: 'success',
      verifiedTranscript: 'Yesterday, I saw a big dog.\nIt bark at me.',
      hasUncertainty: false,
      changes: [],
      unreadableWords: [],
      modelId: 'Qwen3-VL-32B',
    });

    mockCheckStatus = vi.fn().mockResolvedValue({
      ocr: {
        status: 'available',
        providerName: 'Mathpix OCR (Local Bridge)',
        details: 'Bridge connected. Mathpix credentials configured and live OCR enabled.',
      },
      visualVerification: {
        status: 'available',
        providerName: 'Vision Verification (Qwen3-VL-32B)',
        details: 'Local multimodal vision model active on port 18088.',
      },
      marking: {
        status: 'available',
        providerName: 'Essay Marking Model (Port 18086)',
        port: 18086,
        modelId: 'Qwen3.6-35B',
        details: 'Local marking model active on port 18086.',
      },
    });

    essayServices.setOcrService({
      recognize: mockOcrRecognize,
    } as any);

    essayServices.setTranscriptionService({
      transcribePage: vi.fn(),
      verifyTranscription: mockVerifyTranscription,
    } as any);

    essayServices.setAvailabilityService({
      checkStatus: mockCheckStatus,
    } as any);
  });

  describe('1. Mode Selector UI & Explanations', () => {
    it('renders Option A (Mathpix OCR Only) and Option B (Mathpix OCR + Qwen VL Verify) with explanations', () => {
      render(
        <TranscriptionToolbar
          provider="mathpix_only"
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

      // Verify Mode Selector dropdown options
      const select = screen.getByLabelText(/OCR Mode:/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('mathpix_only');

      const options = Array.from(select.options).map((opt) => opt.text);
      expect(options).toContain('A. Mathpix OCR Only');
      expect(options).toContain('B. Mathpix OCR + Qwen VL Verify');

      // Verify explanation for Option A
      expect(
        screen.getByText(/Send the selected page to Mathpix for handwriting recognition/i)
      ).toBeInTheDocument();
    });

    it('shows short explanation for Option B when selected', () => {
      render(
        <TranscriptionToolbar
          provider="mathpix_qwen_verify"
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

      expect(
        screen.getByText(/Run Mathpix OCR first, then send the page image and Mathpix transcript to Qwen VL/i)
      ).toBeInTheDocument();
    });

    it('displays page count and does not submit automatically on mode change', () => {
      const onSelectProvider = vi.fn();
      render(
        <TranscriptionToolbar
          provider="mathpix_only"
          onSelectProvider={onSelectProvider}
          onOpenSettings={vi.fn()}
          onTranscribeAllPending={vi.fn()}
          pendingCount={2}
          isBatchRunning={false}
          batchProgress={null}
          onPauseBatch={vi.fn()}
          onResumeBatch={vi.fn()}
          onRetryFailed={vi.fn()}
          pageCount={2}
          isDryRun={true}
          isMathpixConfigured={true}
          qwenStatus="available"
        />
      );

      // Verify page count is clearly displayed before starting
      expect(screen.getByText(/2 pages/i)).toBeInTheDocument();
      expect(screen.getByText(/DRY_RUN/i)).toBeInTheDocument();

      // Changing mode fires onSelectProvider without triggering any OCR request
      const select = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(select, { target: { value: 'mathpix_qwen_verify' } });
      expect(onSelectProvider).toHaveBeenCalledWith('mathpix_qwen_verify');
      expect(mockOcrRecognize).not.toHaveBeenCalled();
      expect(mockVerifyTranscription).not.toHaveBeenCalled();
    });
  });

  describe('2. Mode A: Mathpix OCR Only', () => {
    it('executes Mathpix OCR and NEVER calls Qwen VL (port 18088)', async () => {
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

      // Verify initial mode is Mathpix OCR Only
      const select = screen.getByLabelText(/OCR Mode:/i) as HTMLSelectElement;
      expect(select.value).toBe('mathpix_only');

      // Click explicit Start Mathpix OCR button
      const startBtn = screen.getByRole('button', { name: /Start Mathpix OCR/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
      });

      // Verify Mathpix received the image URL
      expect(mockOcrRecognize).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrls: ['data:image/png;base64,AAAA'],
          studentId: 'student-1',
        })
      );

      // Critical invariant: Mode A must NEVER call Qwen VL
      expect(mockVerifyTranscription).not.toHaveBeenCalled();

      // Verify candidate review box is displayed with Mathpix transcript
      await waitFor(() => {
        expect(screen.getByText(/Yesterday, I saw a big dog./i)).toBeInTheDocument();
        expect(screen.getByText(/It bark at me./i)).toBeInTheDocument();
        expect(screen.getByText(/Candidate Ready \(Mathpix Only\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Mode B: Mathpix OCR + Qwen VL Verify', () => {
    it('runs Mathpix first, then passes image and transcript to Qwen VL verification', async () => {
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

      // Switch to Mode B: Mathpix OCR + Qwen VL Verify
      const select = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(select, { target: { value: 'mathpix_qwen_verify' } });

      // Click Start Mathpix + Qwen
      const startBtn = screen.getByRole('button', { name: /Start Mathpix \+ Qwen/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockVerifyTranscription).toHaveBeenCalledTimes(1);
      });

      // Verify arguments passed to Qwen VL
      expect(mockVerifyTranscription).toHaveBeenCalledWith(
        expect.objectContaining({
          imageDataUri: 'data:image/png;base64,AAAA',
          mathpixTranscript: 'Yesterday, I saw a big dog.\nIt bark at me.',
          studentId: 'student-1',
          pageNumber: 1,
        })
      );

      // Verify candidate is displayed with Qwen Verified badge
      await waitFor(() => {
        expect(screen.getByText(/Verified Candidate \(Mathpix \+ Qwen VL\)/i)).toBeInTheDocument();
      });
    });

    it('pre-flight check: if Qwen is offline, prompts modal allowing teacher to choose Mathpix Only or Cancel', async () => {
      // Simulate Qwen offline
      mockCheckStatus.mockResolvedValue({
        ocr: { status: 'available' },
        visualVerification: { status: 'error', details: 'Connection refused on port 18088' },
        marking: { status: 'available' },
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

      // Switch to Mode B
      const select = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(select, { target: { value: 'mathpix_qwen_verify' } });

      // Click Start
      const startBtn = screen.getByRole('button', { name: /Start Mathpix \+ Qwen/i });
      fireEvent.click(startBtn);

      // Verify modal dialog appears without calling Mathpix yet!
      await waitFor(() => {
        expect(
          screen.getByText(/Qwen VL Service Unavailable \(Port 18088\)/i)
        ).toBeInTheDocument();
      });
      expect(mockOcrRecognize).not.toHaveBeenCalled();

      // Click "Proceed with Mathpix Only"
      const proceedBtn = screen.getByRole('button', { name: /Proceed with Mathpix Only/i });
      fireEvent.click(proceedBtn);

      // Now Mathpix OCR executes
      await waitFor(() => {
        expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
      });
      // Qwen was not called because teacher chose Mathpix Only
      expect(mockVerifyTranscription).not.toHaveBeenCalled();
    });
  });

  describe('4. Qwen Failure & Retry without Mathpix Re-billing', () => {
    it('retains Mathpix transcript when Qwen fails and allows retrying ONLY Qwen verification', async () => {
      // Qwen fails during verification
      mockVerifyTranscription.mockRejectedValueOnce(
        new Error('Port 18088 connection timeout')
      );

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

      // Switch to Mode B
      const select = screen.getByLabelText(/OCR Mode:/i);
      fireEvent.change(select, { target: { value: 'mathpix_qwen_verify' } });

      // Click Start
      const startBtn = screen.getByRole('button', { name: /Start Mathpix \+ Qwen/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(mockVerifyTranscription).toHaveBeenCalledTimes(1);
      });

      // Verification incomplete: Mathpix transcript is displayed with warning
      await waitFor(() => {
        expect(
          screen.getAllByText(/Qwen Verification Incomplete/i).length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Yesterday, I saw a big dog./i)).toBeInTheDocument();
      });

      // Find the Retry Qwen Verification button
      const retryQwenBtns = screen.getAllByRole('button', {
        name: /Retry Qwen Verify|Retry Qwen Verification/i,
      });
      expect(retryQwenBtns.length).toBeGreaterThanOrEqual(1);

      // Setup Qwen to succeed on retry
      mockVerifyTranscription.mockResolvedValueOnce({
        status: 'success',
        verifiedTranscript: 'Yesterday, I saw a big dog.\nIt barked at me.',
        hasUncertainty: false,
        changes: [{ ocrOriginal: 'bark', verified: 'barked', reason: 'handwriting misread' }],
      });

      // Click Retry Qwen Verify
      fireEvent.click(retryQwenBtns[0]);

      await waitFor(() => {
        expect(mockVerifyTranscription).toHaveBeenCalledTimes(2);
      });

      // CRITICAL: Mathpix was NOT called a second time (zero new Mathpix charges!)
      expect(mockOcrRecognize).toHaveBeenCalledTimes(1);

      // Candidate updated with verified text
      await waitFor(() => {
        expect(screen.getByText(/Verified Candidate \(Mathpix \+ Qwen VL\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Protection of Existing Teacher Edits', () => {
    it('warns teacher before transcribing a student who already has edited text and preserves existing text', async () => {
      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={1} // student-2 has existing teacher text
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      // Verify existing text is present in the editor
      const textarea = screen.getByLabelText(/Student transcript text editor/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Existing teacher text here');

      // Attempt to transcribe
      const startBtn = screen.getByRole('button', { name: /Start Mathpix OCR/i });
      fireEvent.click(startBtn);

      // Pre-flight warning dialog must appear
      expect(
        screen.getByText(/Transcribe Essay for this Student\?/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Zero Overwrite Safety/i)
      ).toBeInTheDocument();

      // Mathpix must not be called yet
      expect(mockOcrRecognize).not.toHaveBeenCalled();

      // Proceed
      const proceedBtn = screen.getByRole('button', { name: /Proceed with Transcription/i });
      fireEvent.click(proceedBtn);

      await waitFor(() => {
        expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
      });

      // Staged candidate appears in separate review box, editor text is NOT silently overwritten
      await waitFor(() => {
        expect(screen.getByText(/Yesterday, I saw a big dog./i)).toBeInTheDocument();
      });
      expect(textarea.value).toBe('Existing teacher text here');
    });
  });

  describe('6. StagedCandidateBox Accordion & Discard', () => {
    it('displays OCR misread changes and allows discarding candidate cleanly', () => {
      const mockCandidate: StagedCandidateTranscript = {
        studentId: 'student-1',
        transcript: 'Yesterday, I saw a big dog.\nIt barked at me.',
        status: 'candidate_ready',
        ocrMode: 'mathpix_qwen_verify',
        mathpixTranscript: 'Yesterday, I saw a big dog.\nIt bark at me.',
        qwenVerifiedTranscript: 'Yesterday, I saw a big dog.\nIt barked at me.',
        qwenVerificationStatus: 'success',
        qwenChanges: [{ ocrOriginal: 'bark', verified: 'barked', reason: 'OCR misread letter d' }],
        pageResults: [],
        linesWithBboxes: [],
        isStale: false,
      };

      const onDiscard = vi.fn();
      const onApply = vi.fn();

      render(
        <StagedCandidateBox
          candidate={mockCandidate}
          studentId="student-1"
          isStale={false}
          onApply={onApply}
          onCopy={vi.fn()}
          onDiscard={onDiscard}
          isCopied={false}
        />
      );

      // Check badge
      expect(screen.getByText(/Verified Candidate \(Mathpix \+ Qwen VL\)/i)).toBeInTheDocument();

      // Check changes accordion exists
      const changesBtn = screen.getByText(/Verified & Corrected 1 OCR Misreads/i);
      expect(changesBtn).toBeInTheDocument();
      fireEvent.click(changesBtn);

      expect(screen.getAllByText(/bark/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/barked/).length).toBeGreaterThanOrEqual(1);

      // Click Discard
      const discardBtn = screen.getByRole('button', { name: /Discard Candidate/i });
      fireEvent.click(discardBtn);
      expect(onDiscard).toHaveBeenCalled();
    });
  });
});
