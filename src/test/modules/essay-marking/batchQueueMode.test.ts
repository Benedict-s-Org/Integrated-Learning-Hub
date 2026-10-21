import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildBatchTasks,
  BatchTranscriptionQueueController,
} from '../../../modules/essay-marking/utils/transcriptionBatchQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  TemplateRegion,
  DEFAULT_TRANSCRIPTION_SETTINGS,
} from '../../../modules/essay-marking/types';
import { essayServices } from '../../../modules/essay-marking/services/essayServiceRegistry';
import { prepareOcrImageFromRegions } from '../../../modules/essay-marking/utils/regionAwareOcr';
import { loadImage, cropRegionFromImage } from '../../../modules/essay-marking/utils/scanRegionCropper';

// IMPORTANT: the regionAwareOcr module connection is NOT mocked — these tests
// exercise the real transcriptionBatchQueue -> regionAwareOcr import wiring.
// Only the image operations (canvas/image loading) are mocked, since jsdom
// cannot decode images.
vi.mock('../../../modules/essay-marking/utils/scanRegionCropper', () => ({
  loadImage: vi.fn(),
  cropRegionFromImage: vi.fn(),
}));
const loadImageMock = vi.mocked(loadImage);
const cropMock = vi.mocked(cropRegionFromImage);

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
];

const mockPages: ScanPage[] = [
  {
    id: 'page-1',
    assignmentId: 'assign-1',
    fileName: 'scan_01.jpg',
    pageNumber: 1,
    previewUrl: 'data:image/png;base64,AAAA',
    fileSize: 1024,
  },
];

const mockAppliedMatching: AppliedMatching = {
  assignmentId: 'assign-1',
  classId: 'Class 4A',
  assignedStudentIndices: [0],
  map: [{ studentIndex: 0, part: 1, total: 1 }],
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
};

const templateRegions: TemplateRegion[] = [
  {
    id: 'region-1',
    type: 'writing_area' as any,
    pageNumber: 1,
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  },
];

function buildTasks() {
  return buildBatchTasks({
    students: mockStudents,
    pages: mockPages,
    appliedMatching: mockAppliedMatching,
    transcripts: mockTranscripts,
    templateRegions,
    skipExisting: true,
  });
}

describe('Batch transcription queue respects selected OCR mode', () => {
  let mockOcrRecognize: any;
  let mockTranscribePage: any;
  let mockVerifyTranscription: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOcrRecognize = vi.fn().mockResolvedValue({
      status: 'success',
      transcript: 'Yesterday, I saw a big dog.\nIt bark at me.',
    });
    mockTranscribePage = vi.fn();
    mockVerifyTranscription = vi.fn().mockResolvedValue({
      status: 'success',
      verifiedTranscript: 'Yesterday, I saw a big dog.\nIt barked at me.',
      changes: [],
    });

    essayServices.setOcrService({ recognize: mockOcrRecognize } as any);
    essayServices.setTranscriptionService({
      transcribePage: mockTranscribePage,
      verifyTranscription: mockVerifyTranscription,
    } as any);

    // Real region-aware prep with mocked image ops. loadImage returns a
    // 1000x800 image; crop identity-returns the requested URL so the default
    // full-page fixtures keep their existing expectations.
    loadImageMock.mockResolvedValue({ naturalWidth: 1000, naturalHeight: 800 } as any);
    cropMock.mockImplementation((_img: any, _region: any) => 'data:image/jpeg;base64,CROPPED_REGION');
  });

  it('Mode A (mathpix_only): batch uses Mathpix and NEVER calls Qwen transcribePage', async () => {
    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_only',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
    expect(mockOcrRecognize).toHaveBeenCalledWith(
      expect.objectContaining({
        // Fixture page HAS a writing area -> real prep crops it (image ops mocked).
        imageUrls: ['data:image/jpeg;base64,CROPPED_REGION'],
        studentId: 'student-1',
      })
    );
    // Regression guard: Mathpix Only must never reach Qwen transcription.
    expect(mockTranscribePage).not.toHaveBeenCalled();
    expect(mockVerifyTranscription).not.toHaveBeenCalled();

    expect(completed).toHaveLength(1);
    const candidate = completed[0];
    expect(candidate.status).toBe('candidate_ready');
    expect(candidate.ocrMode).toBe('mathpix_only');
    expect(candidate.transcript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
    expect(candidate.mathpixTranscript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
    expect(candidate.provider).toBe('mathpix_only');
  });

  it('Mode B (mathpix_qwen_verify): Mathpix first, then Qwen verification succeeds', async () => {
    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_qwen_verify',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    // Order: Mathpix OCR first, then verification (no Qwen transcription).
    expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
    expect(mockVerifyTranscription).toHaveBeenCalledTimes(1);
    expect(mockVerifyTranscription).toHaveBeenCalledWith(
      expect.objectContaining({
        // Fixture page HAS a writing area -> real prep crops it (image ops mocked).
        imageDataUri: 'data:image/jpeg;base64,CROPPED_REGION',
        mathpixTranscript: 'Yesterday, I saw a big dog.\nIt bark at me.',
      })
    );
    expect(mockTranscribePage).not.toHaveBeenCalled();

    const candidate = completed[0];
    expect(candidate.status).toBe('candidate_ready');
    expect(candidate.qwenVerificationStatus).toBe('success');
    expect(candidate.transcript).toBe('Yesterday, I saw a big dog.\nIt barked at me.');
    expect(candidate.mathpixTranscript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
  });

  it('Mode B: Qwen verification failure (HTTP 502) keeps Mathpix output for verification-only retry', async () => {
    mockVerifyTranscription = vi.fn().mockResolvedValue({
      status: 'error',
      code: 'VL_VERIFICATION_FAILED',
      message: 'Local Qwen VL verification failed: fetch failed',
    });
    essayServices.setTranscriptionService({
      transcribePage: mockTranscribePage,
      verifyTranscription: mockVerifyTranscription,
    } as any);

    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_qwen_verify',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    expect(mockOcrRecognize).toHaveBeenCalledTimes(1);
    expect(mockVerifyTranscription).toHaveBeenCalledTimes(1);
    expect(mockTranscribePage).not.toHaveBeenCalled();

    const candidate = completed[0];
    // Mathpix transcript survives the Qwen failure
    expect(candidate.transcript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
    expect(candidate.mathpixTranscript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
    expect(candidate.qwenVerificationStatus).toBe('failed');
    expect(candidate.status).toBe('partially_transcribed');
    // Page result retains raw Mathpix output so verification-only retry works
    expect(candidate.pageResults[0].mathpixRawTranscript).toBe(
      'Yesterday, I saw a big dog.\nIt bark at me.'
    );
  });

  it('Legacy default (no provider): still uses transcribePage (backward compatible)', async () => {
    mockTranscribePage = vi.fn().mockResolvedValue({
      status: 'success',
      scanPageId: 'page-1',
      studentId: 'student-1',
      transcript: 'Legacy qwen output.',
      linesWithBboxes: [],
    });
    essayServices.setTranscriptionService({
      transcribePage: mockTranscribePage,
      verifyTranscription: mockVerifyTranscription,
    } as any);

    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    expect(mockTranscribePage).toHaveBeenCalledTimes(1);
    expect(mockOcrRecognize).not.toHaveBeenCalled();
    expect(completed[0].transcript).toBe('Legacy qwen output.');
  });

  it('Mode A with a selected region: batch Mathpix receives the CROP via the REAL prep helper, not the full page', async () => {
    cropMock.mockImplementation(() => 'data:image/jpeg;base64,CROPPED_REGION');
    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_only',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    // The mocked Mathpix client received the cropped image...
    expect(mockOcrRecognize).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['data:image/jpeg;base64,CROPPED_REGION'],
        studentId: 'student-1',
      })
    );
    // ...never the original full page.
    expect(mockOcrRecognize.mock.calls[0][0].imageUrls[0]).not.toBe(mockPages[0].previewUrl);
    expect(mockTranscribePage).not.toHaveBeenCalled();

    // Crop metadata retained on the page result (verification-only retry reuse).
    const candidate = completed[0];
    expect(candidate.status).toBe('candidate_ready');
    expect(candidate.pageResults[0].ocrRegionImageUrl).toBe('data:image/jpeg;base64,CROPPED_REGION');
    expect(candidate.pageResults[0].isRegionCrop).toBe(true);
    expect(candidate.mathpixTranscript).toBe('Yesterday, I saw a big dog.\nIt bark at me.');
  });

  it('Mode B with a selected region: Qwen verification verifies the SAME crop (real prep)', async () => {
    const { tasks, skippedStudents } = buildTasks();
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_qwen_verify',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    expect(mockVerifyTranscription).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUri: 'data:image/jpeg;base64,CROPPED_REGION',
        mathpixTranscript: 'Yesterday, I saw a big dog.\nIt bark at me.',
      })
    );
    expect(mockVerifyTranscription.mock.calls[0][0].imageDataUri).not.toBe(mockPages[0].previewUrl);
    expect(mockTranscribePage).not.toHaveBeenCalled();
  });

  it('Batch task WITHOUT a region: full-page OCR still works (real prep passthrough)', async () => {
    // Manually build a task with no regions and no pre-existing error.
    const task = {
      taskId: 'student-1_p1_page-1',
      studentId: 'student-1',
      studentIndex: 0,
      studentName: 'Chan Tai Man',
      classNumber: 1,
      scanPage: mockPages[0],
      part: 1,
      totalParts: 1,
      regions: [],
      status: 'pending' as const,
    };
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks: [task],
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_only',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    // No region -> full page behavior preserved
    expect(mockOcrRecognize).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrls: [mockPages[0].previewUrl] })
    );
    expect(completed[0].status).toBe('candidate_ready');
    expect(completed[0].pageResults[0].isRegionCrop).toBe(false);
  });

  it('Invalid selected region (NaN coords): explicit INVALID_OCR_REGION failure, NO OCR call (real prep)', async () => {
    const { tasks, skippedStudents } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: mockTranscripts,
      templateRegions: [
        {
          id: 'region-bad',
          type: 'writing_area' as any,
          pageNumber: 1,
          x: NaN,
          y: 0.3,
          width: 0.5,
          height: 0.4,
        },
      ],
      skipExisting: true,
    });
    const completed: any[] = [];

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
      onStudentCompleted: (candidate) => completed.push(candidate),
    });

    await controller.run({
      transcriptionService: essayServices.getTranscriptionService(),
      ocrService: essayServices.getOcrService(),
      provider: 'mathpix_only',
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      assignmentId: 'assign-1',
    });

    // No Mathpix call, no silent full-page fallback
    expect(mockOcrRecognize).not.toHaveBeenCalled();
    expect(mockTranscribePage).not.toHaveBeenCalled();

    const candidate = completed[0];
    expect(candidate.status).toBe('failed');
    expect(candidate.pageResults[0].errorCode).toBe('INVALID_OCR_REGION');
  });
});
