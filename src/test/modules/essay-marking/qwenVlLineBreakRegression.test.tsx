import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  combineCandidateTranscript,
  BatchTranscriptionQueueController,
  buildBatchTasks,
} from '../../../modules/essay-marking/utils/transcriptionBatchQueue';
import { normalizeOcrTranscript } from '../../../modules/essay-marking/utils/ocrFormatNormalizer';
import { alignTranscriptWithFindings } from '../../../modules/essay-marking/utils/markingTextAlignment';
import { InlineMarkingView } from '../../../modules/essay-marking/components/InlineMarkingView';
import { TranscriptVerificationPanel } from '../../../modules/essay-marking/components/TranscriptVerificationPanel';
import { essayServices } from '../../../modules/essay-marking/services/essayServiceRegistry';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  StagedCandidateTranscript,
} from '../../../modules/essay-marking/types';

vi.mock('../../../modules/essay-marking/utils/scanRegionCropper', () => ({
  loadImage: vi.fn(),
  cropRegionFromImage: vi.fn(),
}));

describe('Qwen VL OCR Physical Line Break & Geometry Regression Tests', () => {
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
      fileName: 'page_01.jpg',
      pageNumber: 1,
      previewUrl: 'data:image/png;base64,PAGE1',
      fileSize: 1024,
    },
    {
      id: 'page-2',
      assignmentId: 'assign-1',
      fileName: 'page_02.jpg',
      pageNumber: 2,
      previewUrl: 'data:image/png;base64,PAGE2',
      fileSize: 1024,
    },
  ];

  const mockAppliedMatching: AppliedMatching = {
    assignmentId: 'assign-1',
    classId: 'Class 4A',
    assignedStudentIndices: [0],
    map: [
      { studentIndex: 0, part: 1, total: 2 },
      { studentIndex: 0, part: 2, total: 2 },
    ],
  };

  const mockAssignment: AssignmentConfig = {
    id: 'assign-1',
    title: 'English Narrative',
    worksheetFileName: 'narrative.pdf',
    worksheetFile: null,
    worksheetPreviewUrl: 'data:image/png;base64,PREVIEW',
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

  // 1. Multiple returned physical lines remain separate through parsing, assembly, normalization, and import
  it('1. preserves multiple returned physical lines through assembly, normalization, and candidate import', () => {
    const rawOcrText = 'First physical line of handwriting.\nSecond physical line of handwriting.\nThird physical line of handwriting.';
    
    // Normalization preserves \n
    const { normalizedText } = normalizeOcrTranscript(rawOcrText);
    expect(normalizedText).toBe(rawOcrText);
    expect(normalizedText.split('\n')).toHaveLength(3);

    // Assembly preserves \n
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
          linesWithBboxes: [
            { text: 'First physical line of handwriting.', bbox: [100, 200, 800, 240] },
            { text: 'Second physical line of handwriting.', bbox: [100, 250, 800, 290] },
            { text: 'Third physical line of handwriting.', bbox: [100, 300, 800, 340] },
          ],
        },
      ],
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      settings: mockAssignment.transcriptionSettings,
      assignmentId: 'assign-1',
      provider: 'local_qwen_vl',
    });

    expect(candidate.transcript).toBe(rawOcrText);
    expect(candidate.linesWithBboxes).toHaveLength(3);
    expect(candidate.transcript.split('\n')).toHaveLength(3);
  });

  // 2. Explicit empty-line entries survive
  it('2. preserves explicit empty-line entries across assembly and rendering model', () => {
    const textWithEmptyLine = 'Paragraph 1 line 1\n\nParagraph 2 line 1';
    const { normalizedText } = normalizeOcrTranscript(textWithEmptyLine);
    expect(normalizedText).toBe('Paragraph 1 line 1\n\nParagraph 2 line 1');

    const { alignedLines } = alignTranscriptWithFindings(normalizedText, []);
    expect(alignedLines).toHaveLength(3);
    expect(alignedLines[0].rawText).toBe('Paragraph 1 line 1');
    expect(alignedLines[1].isEmpty).toBe(true);
    expect(alignedLines[1].rawText).toBe('');
    expect(alignedLines[2].rawText).toBe('Paragraph 2 line 1');
  });

  // 3. A long single returned line is not artificially split
  it('3. does not artificially split a long single returned line by sentence length or punctuation', () => {
    const longSingleLine =
      'This is a single long continuous line written by the student that spans several sentences. Sentence two here. Sentence three here.';
    
    const { normalizedText } = normalizeOcrTranscript(longSingleLine);
    expect(normalizedText).toBe(longSingleLine);
    expect(normalizedText.split('\n')).toHaveLength(1);

    const { alignedLines } = alignTranscriptWithFindings(normalizedText, []);
    expect(alignedLines).toHaveLength(1);
    expect(alignedLines[0].rawText).toBe(longSingleLine);
  });

  // 4. Literal \n text is not confused with real newline characters
  it('4. preserves literal \\n sequences without confusing them with real newline characters', () => {
    const literalText = 'Student wrote path C:\\notes\\file.txt and literal \\n without line breaks.';
    
    const { normalizedText } = normalizeOcrTranscript(literalText);
    expect(normalizedText).toBe(literalText);
    expect(normalizedText.includes('\n')).toBe(false);
    expect(normalizedText.includes('\\n')).toBe(true);

    const { alignedLines } = alignTranscriptWithFindings(normalizedText, []);
    expect(alignedLines).toHaveLength(1);
    expect(alignedLines[0].rawText).toContain('\\n');
  });

  // 5. Geometry-unavailable responses retain text boundaries without fabricated boxes
  it('5. preserves line boundaries without fabricating bounding boxes when geometry is null', () => {
    const linesNoBbox = [
      { text: 'Line without geometry 1', bbox: null },
      { text: 'Line without geometry 2', bbox: null },
    ];
    const rawText = linesNoBbox.map((l) => l.text).join('\n');

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
          transcript: rawText,
          linesWithBboxes: linesNoBbox,
        },
      ],
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      settings: mockAssignment.transcriptionSettings,
      assignmentId: 'assign-1',
      provider: 'local_qwen_vl',
    });

    expect(candidate.linesWithBboxes).toHaveLength(2);
    expect(candidate.linesWithBboxes![0].bbox).toBeNull();
    expect(candidate.linesWithBboxes![1].bbox).toBeNull();
    expect(candidate.transcript).toBe('Line without geometry 1\nLine without geometry 2');
  });

  // 6. Multiple pages retain their existing ordering and provenance
  it('6. retains page ordering and pageNumber/scanPageId provenance across multiple pages', () => {
    const candidate = combineCandidateTranscript({
      studentId: 'student-1',
      studentIndex: 0,
      tasksForStudent: [
        {
          taskId: 't2',
          studentId: 'student-1',
          studentIndex: 0,
          studentName: 'Chan Tai Man',
          classNumber: 1,
          scanPage: mockPages[1],
          part: 2,
          totalParts: 2,
          regions: [],
          status: 'success',
          transcript: 'Page two line one.\nPage two line two.',
          linesWithBboxes: [
            { text: 'Page two line one.', bbox: [100, 200, 800, 240] },
            { text: 'Page two line two.', bbox: [100, 250, 800, 290] },
          ],
        },
        {
          taskId: 't1',
          studentId: 'student-1',
          studentIndex: 0,
          studentName: 'Chan Tai Man',
          classNumber: 1,
          scanPage: mockPages[0],
          part: 1,
          totalParts: 2,
          regions: [],
          status: 'success',
          transcript: 'Page one line one.\nPage one line two.',
          linesWithBboxes: [
            { text: 'Page one line one.', bbox: [100, 200, 800, 240] },
            { text: 'Page one line two.', bbox: [100, 250, 800, 290] },
          ],
        },
      ],
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      settings: mockAssignment.transcriptionSettings,
      assignmentId: 'assign-1',
      provider: 'local_qwen_vl',
    });

    // Part 1 must precede Part 2
    expect(candidate.transcript).toBe('Page one line one.\nPage one line two.\nPage two line one.\nPage two line two.');
    expect(candidate.linesWithBboxes).toHaveLength(4);
    expect(candidate.linesWithBboxes![0].pageNumber).toBe(1);
    expect(candidate.linesWithBboxes![0].scanPageId).toBe('page-1');
    expect(candidate.linesWithBboxes![2].pageNumber).toBe(2);
    expect(candidate.linesWithBboxes![2].scanPageId).toBe('page-2');
  });

  // 7. Committed line numbers reflect source newlines, not visual wraps
  it('7. renders source line numbers matching newlines, not visual wraps', () => {
    const transcriptText = 'Physical Line A\nPhysical Line B\nPhysical Line C';
    
    render(
      <InlineMarkingView
        transcript={transcriptText}
        findings={[]}
        studentId="student-1"
        studentName="Chan Tai Man"
      />
    );

    // Badges correspond to the 3 source lines
    expect(screen.getByTitle('Source Line 1')).toBeInTheDocument();
    expect(screen.getByTitle('Source Line 2')).toBeInTheDocument();
    expect(screen.getByTitle('Source Line 3')).toBeInTheDocument();
    expect(screen.queryByTitle('Source Line 4')).not.toBeInTheDocument();
  });

  // 8. Existing teacher-edited transcripts are not overwritten & Mathpix count is zero
  it('8. preserves existing teacher-edited transcripts with confirmation, and Mathpix is never invoked', async () => {
    const mockOcrRecognize = vi.fn();
    const mockTranscribePage = vi.fn().mockResolvedValue({
      status: 'success',
      transcript: 'New Qwen line 1\nNew Qwen line 2',
      linesWithBboxes: [
        { text: 'New Qwen line 1', bbox: [100, 200, 800, 240] },
        { text: 'New Qwen line 2', bbox: [100, 250, 800, 290] },
      ],
      modelId: 'qwen3-vl-32b',
      promptVersion: 'qwen-vl-ocr-test',
    });

    vi.spyOn(essayServices, 'getOcrService').mockReturnValue({
      recognizeEssay: mockOcrRecognize,
    } as any);

    vi.spyOn(essayServices, 'getTranscriptionService').mockReturnValue({
      transcribePage: mockTranscribePage,
      getOcrPromptSnapshot: vi.fn().mockResolvedValue({
        ok: true,
        snapshot: {
          promptText: 'System prompt',
          promptHash: 'abc123456789',
          promptVersion: 'qwen-vl-ocr-abc123456789',
        },
      }),
    } as any);

    vi.spyOn(essayServices, 'getAvailabilityService').mockReturnValue({
      checkStatus: vi.fn().mockResolvedValue({
        ocr: { status: 'configured', provider: 'Mathpix' },
        visualVerification: { status: 'available', model: 'Qwen3-VL-32B' },
      }),
    } as any);

    const existingTranscripts: Record<string, StudentTranscriptState> = {
      'student-1': {
        studentId: 'student-1',
        rawOcrText: 'Initial OCR text',
        editedText: 'Teacher carefully edited text that must remain intact.',
        isManuallyEntered: true,
        uncertainRegions: [],
        isVerified: false,
      },
    };

    render(
      <TranscriptVerificationPanel
        students={mockStudents}
        activeStudentIndex={0}
        pages={mockPages}
        appliedMatching={mockAppliedMatching}
        transcripts={existingTranscripts}
        onUpdateTranscriptText={vi.fn()}
        assignment={mockAssignment}
        onVerifyTranscript={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Initial view contains the existing teacher text
    expect(screen.getByDisplayValue('Teacher carefully edited text that must remain intact.')).toBeInTheDocument();

    // Select Qwen VL OCR mode
    const modeSelect = screen.getByLabelText(/OCR Mode:/i);
    fireEvent.change(modeSelect, { target: { value: 'local_qwen_vl' } });

    // Click transcribe button
    const transcribeBtn = screen.getByRole('button', { name: /Start Qwen VL OCR/i });
    fireEvent.click(transcribeBtn);

    // Confirmation dialog appears to protect teacher text
    const proceedBtn = await screen.findByRole('button', { name: /Proceed with Transcription/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(mockTranscribePage).toHaveBeenCalled();
    });

    // CRITICAL: Mathpix was NOT called!
    expect(mockOcrRecognize).not.toHaveBeenCalled();

    // Existing teacher text in textarea was NOT overwritten automatically!
    expect(screen.getByDisplayValue('Teacher carefully edited text that must remain intact.')).toBeInTheDocument();
  });
});
