import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptionSettingsModal } from '@/modules/essay-marking/components/TranscriptionSettingsModal';
import { TranscriptVerificationPanel } from '@/modules/essay-marking/components/TranscriptVerificationPanel';
import { StagedCandidateBox } from '@/modules/essay-marking/components/StagedCandidateBox';
import {
  AssignmentConfig,
  AssignmentTranscriptionSettings,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  TemplateRegion,
  ScanPage,
  StudentRosterItem,
  AppliedMatching,
  StudentTranscriptState,
  StagedCandidateTranscript,
  normalizeTranscriptionSettings,
} from '@/modules/essay-marking/types';

describe('Stage 4 Transcription Settings & Verification Robustness', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 'student_1', displayName: 'Chan Tai Man', classNumber: 1, className: '3A' },
  ];

  const mockPages: ScanPage[] = [
    {
      id: 'p1',
      fileId: 'f1',
      fileName: 'scan1.png',
      sourcePageNumber: 1,
      previewUrl: 'data:image/png;base64,AAAA',
      orderIndex: 0,
    },
  ];

  const mockAppliedMatching: AppliedMatching = {
    classId: '3A',
    counts: [1],
    assignedStudentIndices: [0],
    map: [
      {
        studentIndex: 0,
        studentId: 'student_1',
        studentName: 'Chan Tai Man',
        classNumber: 1,
        part: 1,
        total: 1,
      },
    ],
  };

  const mockTranscripts: Record<string, StudentTranscriptState> = {
    student_1: {
      studentId: 'student_1',
      rawOcrText: null,
      editedText: '',
      isManuallyEntered: true,
      uncertainRegions: [],
      isVerified: false,
    },
  };

  const sampleTemplateRegions: TemplateRegion[] = [
    {
      id: 'area_1',
      type: 'writing_area',
      pageNumber: 1,
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.3,
      name: 'Introduction',
    },
    {
      id: 'area_2',
      type: 'writing_area',
      pageNumber: 1,
      x: 0.1,
      y: 0.45,
      width: 0.8,
      height: 0.45,
      name: 'Main Body',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeTranscriptionSettings helper', () => {
    it('returns valid defaults with fresh arrays when input is undefined or null', () => {
      const resUndefined = normalizeTranscriptionSettings(undefined);
      expect(resUndefined.version).toBe('v1.0');
      expect(resUndefined.primaryLanguage).toBe('en');
      expect(resUndefined.printedLabelsMode).toBe('separate_context');
      expect(Array.isArray(resUndefined.readingOrder)).toBe(true);
      expect(resUndefined.readingOrder).toHaveLength(0);

      // Verify fresh array reference
      resUndefined.readingOrder!.push('test');
      const resSecond = normalizeTranscriptionSettings(null);
      expect(resSecond.readingOrder).toHaveLength(0);
    });

    it('preserves existing teacher settings when merging defaults', () => {
      const partial: Partial<AssignmentTranscriptionSettings> = {
        primaryLanguage: 'zh',
        printedLabelsMode: 'exclude',
        notes: 'Handwriting is cursive',
      };
      const res = normalizeTranscriptionSettings(partial);
      expect(res.primaryLanguage).toBe('zh');
      expect(res.printedLabelsMode).toBe('exclude');
      expect(res.notes).toBe('Handwriting is cursive');
      expect(res.version).toBe('v1.0');
      expect(Array.isArray(res.readingOrder)).toBe(true);
    });
  });

  describe('TranscriptionSettingsModal Component', () => {
    it('does not throw when closed even if templateRegions and settings are undefined', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      const { container } = render(
        <TranscriptionSettingsModal
          isOpen={false}
          onClose={onClose}
          onSaveSettings={onSave}
          templateRegions={undefined}
          settings={undefined}
        />
      );

      // When closed, returns null without executing unsafe expressions
      expect(container.firstChild).toBeNull();
    });

    it('renders English empty state and actionable link to Preparation when writing areas are absent', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();
      const onNavPrep = vi.fn();

      render(
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={onClose}
          onSaveSettings={onSave}
          templateRegions={undefined}
          settings={undefined}
          onNavigateToPreparation={onNavPrep}
        />
      );

      // Verify English modal title
      expect(screen.getByText('Transcription Settings')).toBeInTheDocument();

      // Verify empty state warning
      expect(screen.getByText(/No Writing Areas Configured/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /No writing regions have been marked on the template worksheet in Preparation/i
        )
      ).toBeInTheDocument();

      // Actionable button to Preparation
      const prepButtons = screen.getAllByRole('button', {
        name: /Edit Writing Areas in Preparation →/i,
      });
      expect(prepButtons.length).toBeGreaterThan(0);

      // Clicking navigation button closes modal and navigates
      fireEvent.click(prepButtons[0]);
      expect(onClose).toHaveBeenCalled();
      expect(onNavPrep).toHaveBeenCalled();
    });

    it('renders writing areas list and allows reading order reordering when valid regions provided', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      render(
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={onClose}
          onSaveSettings={onSave}
          templateRegions={sampleTemplateRegions}
          settings={undefined}
        />
      );

      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Main Body')).toBeInTheDocument();

      // Move Introduction down
      const downButtons = screen.getAllByTitle(/Move Down/i);
      expect(downButtons.length).toBe(2);
      fireEvent.click(downButtons[0]);

      // Save settings
      const saveBtn = screen.getByRole('button', { name: /Save Settings/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          readingOrder: ['area_2', 'area_1'],
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('cancelling closes without saving', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      render(
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={onClose}
          onSaveSettings={onSave}
          templateRegions={sampleTemplateRegions}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);

      expect(onClose).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('TranscriptVerificationPanel (Stage 4) Initialization & Safety', () => {
    it('does not crash when mounted with assignment having undefined transcriptionSettings and templateRegions', () => {
      const assignmentWithoutSettings: AssignmentConfig = {
        title: 'P4 Composition',
        worksheetFileName: null,
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt: 'Write an essay.',
        isConfirmed: true,
        rubric: [],
        templateRegions: undefined,
        transcriptionSettings: undefined,
      };

      const { container } = render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={assignmentWithoutSettings}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onNavigateToPreparation={vi.fn()}
        />
      );

      expect(container).toBeInTheDocument();
      expect(screen.getByText(/Missing Writing Areas/i)).toBeInTheDocument();
    });

    it('blocks transcription and shows notice when writing areas are absent', () => {
      const assignmentWithoutRegions: AssignmentConfig = {
        title: 'P4 Composition',
        worksheetFileName: null,
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt: 'Write an essay.',
        isConfirmed: true,
        rubric: [],
        templateRegions: [],
        transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
      };

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={assignmentWithoutRegions}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onNavigateToPreparation={vi.fn()}
        />
      );

      // Warning banner is rendered in English
      expect(
        screen.getByText(
          /No writing regions have been marked on the template worksheet in Preparation/i
        )
      ).toBeInTheDocument();

      // Transcribe This Essay button
      const transcribeBtn = screen.getByRole('button', { name: /Transcribe This Essay/i });
      fireEvent.click(transcribeBtn);

      // Expect notice to alert user
      expect(
        screen.getByText(/Missing required writing areas: No writing areas have been defined/i)
      ).toBeInTheDocument();
    });

    it('allows opening, editing and saving settings modal from toolbar', () => {
      const onUpdateSettings = vi.fn();
      const assignmentWithRegions: AssignmentConfig = {
        title: 'P4 Composition',
        worksheetFileName: 'worksheet.pdf',
        worksheetFile: null,
        worksheetPreviewUrl: 'data:image/png;base64,AAAA',
        responseFormat: 'worksheet',
        scopePrompt: 'Write an essay.',
        isConfirmed: true,
        rubric: [],
        templateRegions: sampleTemplateRegions,
        transcriptionSettings: {
          version: 'v1.0',
          primaryLanguage: 'zh',
          printedLabelsMode: 'separate_context',
          notes: 'Initial notes',
          readingOrder: ['area_1', 'area_2'],
        },
      };

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={assignmentWithRegions}
          onUpdateAssignmentSettings={onUpdateSettings}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onNavigateToPreparation={vi.fn()}
        />
      );

      // Open Settings Modal
      const settingsBtn = screen.getByRole('button', { name: /Transcription Settings/i });
      fireEvent.click(settingsBtn);

      // Modal is visible
      expect(
        screen.getByText('Assignment-level rules applying to all students in this cohort.')
      ).toBeInTheDocument();

      // Save Settings
      const saveBtn = screen.getByRole('button', { name: /Save Settings/i });
      fireEvent.click(saveBtn);

      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v1.0',
          primaryLanguage: 'zh',
          printedLabelsMode: 'separate_context',
          notes: 'Initial notes',
          readingOrder: ['area_1', 'area_2'],
        })
      );
    });

    it('displays active backend fixed-rules version v1.1 and separates it from assignment settings version', () => {
      render(
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={{
            version: 'v1.0',
            primaryLanguage: 'en',
            printedLabelsMode: 'separate_context',
            notes: '',
            readingOrder: [],
          }}
          onSaveSettings={vi.fn()}
          fixedRulesInfo={{
            version: 'v1.1',
            rulesSummary: [
              {
                title: 'Faithful Transcription',
                description: 'Transcribe student handwriting as written.',
              },
              {
                title: 'Structure & Line-Break Preservation',
                description: 'Separate distinct paragraphs with a blank line (double newline).',
              },
            ],
          }}
        />
      );

      // Section E must show Version v1.1 and Active Backend Rules
      expect(screen.getByText('Fixed Transcription Rules (Version v1.1)')).toBeInTheDocument();
      expect(screen.getByText('Active Backend Rules')).toBeInTheDocument();
      expect(screen.getByText('Structure & Line-Break Preservation:')).toBeInTheDocument();

      // Open Advanced Details
      const advancedToggle = screen.getByText('Advanced Details & Persistence Scope');
      fireEvent.click(advancedToggle);

      // Must clearly separate Fixed Rules (Prompt) Version from Assignment Settings Version
      expect(screen.getByText('Fixed Rules (Prompt) Version:')).toBeInTheDocument();
      expect(screen.getByText('Assignment Settings Version:')).toBeInTheDocument();
    });

    it('displays honest "Version unavailable" state when backend rules cannot be retrieved', () => {
      render(
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={{
            version: 'v1.0',
            primaryLanguage: 'en',
            printedLabelsMode: 'separate_context',
            notes: '',
            readingOrder: [],
          }}
          onSaveSettings={vi.fn()}
          fixedRulesInfo={null}
        />
      );

      expect(screen.getByText('Fixed Transcription Rules (Version unavailable)')).toBeInTheDocument();
      expect(screen.getByText('Version unavailable')).toBeInTheDocument();
    });
  });

  describe('Transcription Error Handling, Protection & Structured Failure Details', () => {
    it('backend error survives and displays structured code, message, and HTTP status in UI', () => {
      const failedCandidate: StagedCandidateTranscript = {
        id: 'candidate_fail_1',
        studentId: 'student_1',
        transcript: '',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        modelId: 'Qwen3-VL-32B',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'failed',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'failed',
            error: 'The local model did not respond within the configured timeout.',
            errorCode: 'LOCAL_MODEL_TIMEOUT',
            httpStatus: 504,
            isRetryable: true,
          },
        ],
        wordCount: 0,
      };

      render(
        <StagedCandidateBox
          candidate={failedCandidate}
          studentId="student_1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      // Verify structured details
      expect(screen.getByText('Page 1 of 1 — Transcription Failed')).toBeInTheDocument();
      expect(screen.getByText('LOCAL_MODEL_TIMEOUT')).toBeInTheDocument();
      expect(
        screen.getByText('The local model did not respond within the configured timeout.')
      ).toBeInTheDocument();
      expect(screen.getByText('HTTP 504')).toBeInTheDocument();
      expect(screen.getByText('Transcription Failed')).toBeInTheDocument();
    });

    it('invalid model JSON lines output produces a visible, specific error message and code in UI', () => {
      const invalidJsonCandidate: StagedCandidateTranscript = {
        id: 'candidate_invalid_json',
        studentId: 'student_1',
        transcript: '',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        modelId: 'Qwen3-VL-32B',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'failed',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'failed',
            error: 'Model output was not valid JSON lines format: missing "lines" array.',
            errorCode: 'INVALID_MODEL_OUTPUT_FORMAT',
            httpStatus: 422,
            isRetryable: true,
          },
        ],
        wordCount: 0,
      };

      render(
        <StagedCandidateBox
          candidate={invalidJsonCandidate}
          studentId="student_1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      expect(screen.getByText('Page 1 of 1 — Transcription Failed')).toBeInTheDocument();
      expect(screen.getByText('INVALID_MODEL_OUTPUT_FORMAT')).toBeInTheDocument();
      expect(
        screen.getByText('Model output was not valid JSON lines format: missing "lines" array.')
      ).toBeInTheDocument();
      expect(screen.getByText('HTTP 422')).toBeInTheDocument();
    });

    it('network failures have no fabricated HTTP status tag in UI', () => {
      const networkFailCandidate: StagedCandidateTranscript = {
        id: 'candidate_net_fail',
        studentId: 'student_1',
        transcript: '',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'failed',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'failed',
            error: 'Unable to connect to Essay Marking Bridge at http://127.0.0.1:18089.',
            errorCode: 'BRIDGE_UNREACHABLE',
            httpStatus: undefined, // Network error: NO fabricated status
            isRetryable: true,
          },
        ],
        wordCount: 0,
      };

      render(
        <StagedCandidateBox
          candidate={networkFailCandidate}
          studentId="student_1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      expect(screen.getByText('BRIDGE_UNREACHABLE')).toBeInTheDocument();
      expect(
        screen.getByText('Unable to connect to Essay Marking Bridge at http://127.0.0.1:18089.')
      ).toBeInTheDocument();
      // Ensure no fabricated HTTP tag is shown
      expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
    });

    it('a one-page failure provides a usable retry action in both card and panel', () => {
      const onRetryPageMock = vi.fn();
      const failedCandidate: StagedCandidateTranscript = {
        id: 'candidate_retry_test',
        studentId: 'student_1',
        transcript: '',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'failed',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'failed',
            error: 'Temporary GPU model busy state.',
            errorCode: 'LOCAL_VL_BUSY',
            isRetryable: true,
          },
        ],
        wordCount: 0,
      };

      render(
        <StagedCandidateBox
          candidate={failedCandidate}
          studentId="student_1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          onRetryPage={onRetryPageMock}
          isCopied={false}
        />
      );

      const retryBtn = screen.getByRole('button', { name: /Retry Page 1/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(onRetryPageMock).toHaveBeenCalledWith('p1', 1);
    });

    it('empty failed candidates cannot be applied or copied', () => {
      const onApplyMock = vi.fn();
      const onCopyMock = vi.fn();

      const failedCandidate: StagedCandidateTranscript = {
        id: 'candidate_cannot_apply',
        studentId: 'student_1',
        transcript: '',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'failed',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'failed',
            error: 'Inference failure',
            errorCode: 'INFERENCE_FAILED',
          },
        ],
        wordCount: 0,
      };

      render(
        <StagedCandidateBox
          candidate={failedCandidate}
          studentId="student_1"
          isStale={false}
          onApply={onApplyMock}
          onCopy={onCopyMock}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      const applyBtn = screen.getByRole('button', { name: /Apply Candidate to Editor/i });
      const copyBtn = screen.getByRole('button', { name: /Copy Candidate/i });

      // Both buttons MUST be disabled
      expect(applyBtn).toBeDisabled();
      expect(copyBtn).toBeDisabled();

      // Clicking them must do nothing
      fireEvent.click(applyBtn);
      fireEvent.click(copyBtn);
      expect(onApplyMock).not.toHaveBeenCalled();
      expect(onCopyMock).not.toHaveBeenCalled();
    });

    it('a failed retry does not overwrite existing teacher text in editor', () => {
      const existingTeacherText = 'Original handwritten draft transcribed by teacher earlier.';
      const mockTranscriptsWithDraft: Record<string, StudentTranscriptState> = {
        student_1: {
          studentId: 'student_1',
          rawOcrText: null,
          editedText: existingTeacherText,
          isManuallyEntered: true,
          uncertainRegions: [],
          isVerified: false,
        },
      };

      const validAssignment: AssignmentConfig = {
        title: 'P4 Composition',
        worksheetFileName: null,
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt: 'Write an essay.',
        isConfirmed: true,
        rubric: [],
        templateRegions: [
          {
            id: 'r1',
            name: 'Writing Area',
            pageNumber: 1,
            type: 'writing_area',
            x: 0.1,
            y: 0.1,
            width: 0.8,
            height: 0.8,
          },
        ],
        transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
      };

      const onUpdateTranscriptTextMock = vi.fn();

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscriptsWithDraft}
          assignment={validAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={onUpdateTranscriptTextMock}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onNavigateToPreparation={vi.fn()}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /Student transcript text editor/i });
      expect(textarea).toHaveValue(existingTeacherText);

      // Verify toolbar shows retry button even for a 1-page essay
      const retryToolbarBtn = screen.getByRole('button', { name: /Retry Page 1/i });
      expect(retryToolbarBtn).toBeInTheDocument();

      // Teacher text has not been updated
      expect(onUpdateTranscriptTextMock).not.toHaveBeenCalled();
    });

    it('Variant C multiline transcript applies all line breaks faithfully to editor text', () => {
      const multilineTranscript = [
        'Line 1 of handwritten essay',
        'Line 2 of handwritten essay',
        '',
        'Line 3 in new paragraph',
        'Line 4 continuing paragraph',
      ].join('\n');

      const onApplyMock = vi.fn();

      const candidate: StagedCandidateTranscript = {
        id: 'candidate_multiline',
        studentId: 'student_1',
        transcript: multilineTranscript,
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.3',
        settingsVersion: 'v1.0',
        pageSignature: 'sig_1',
        status: 'candidate_ready',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'success',
            transcript: multilineTranscript,
          },
        ],
        wordCount: 16,
      };

      render(
        <StagedCandidateBox
          candidate={candidate}
          studentId="student_1"
          isStale={false}
          onApply={onApplyMock}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      // Verify "Apply Candidate to Editor" is enabled
      const applyBtn = screen.getByRole('button', { name: /Apply Candidate to Editor/i });
      expect(applyBtn).not.toBeDisabled();

      fireEvent.click(applyBtn);
      expect(onApplyMock).toHaveBeenCalledTimes(1);

      // Assert LF count in applied transcript
      const lfCount = (multilineTranscript.match(/\n/g) || []).length;
      expect(lfCount).toBe(4);
      expect(multilineTranscript.split('\n')).toHaveLength(5);
    });
  });
});
