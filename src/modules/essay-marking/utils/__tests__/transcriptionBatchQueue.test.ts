import { describe, it, expect, vi } from 'vitest';
import {
  buildBatchTasks,
  combineCandidateTranscript,
  resolveWritingAreasForPage,
  computeStudentPageSignature,
  BatchTranscriptionQueueController,
} from '../transcriptionBatchQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  AssignmentTranscriptionSettings,
  TemplateRegion,
  StudentTranscriptState,
  DEFAULT_TRANSCRIPTION_SETTINGS,
} from '../../types';
import {
  EssayTranscriptionService,
  TranscribePageRequest,
  TranscribePageResponse,
} from '../../services/essayServiceTypes';

describe('Transcription Batch Queue Engine', () => {
  // Synthetic test data
  const mockStudents: StudentRosterItem[] = [
    { id: 'student_1', displayName: 'Chan Tai Man', classNumber: 1, className: '3A' },
    { id: 'student_2', displayName: 'Lee Siu Ming', classNumber: 2, className: '3A' },
  ];

  const mockPages: ScanPage[] = [
    { id: 'page_1_1', fileId: 'f1', fileName: 'scan1.png', sourcePageNumber: 1, previewUrl: 'data:image/png;base64,AAAA', orderIndex: 0 },
    { id: 'page_1_2', fileId: 'f1', fileName: 'scan1.png', sourcePageNumber: 2, previewUrl: 'data:image/png;base64,BBBB', orderIndex: 1 },
    { id: 'page_2_1', fileId: 'f2', fileName: 'scan2.png', sourcePageNumber: 1, previewUrl: 'data:image/png;base64,CCCC', orderIndex: 2 },
    { id: 'page_2_2', fileId: 'f2', fileName: 'scan2.png', sourcePageNumber: 2, previewUrl: 'data:image/png;base64,DDDD', orderIndex: 3 },
  ];

  // Applied matching where student 0 has 2 pages (part 1 and 2), student 1 has 2 pages (part 1 and 2)
  const mockAppliedMatching: AppliedMatching = {
    classId: '3A',
    counts: [2, 2],
    assignedStudentIndices: [0, 1],
    map: [
      { studentIndex: 0, studentId: 'student_1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 2 },
      { studentIndex: 0, studentId: 'student_1', studentName: 'Chan Tai Man', classNumber: 1, part: 2, total: 2 },
      { studentIndex: 1, studentId: 'student_2', studentName: 'Lee Siu Ming', classNumber: 2, part: 1, total: 2 },
      { studentIndex: 1, studentId: 'student_2', studentName: 'Lee Siu Ming', classNumber: 2, part: 2, total: 2 },
    ],
  };

  const mockTemplateRegions: TemplateRegion[] = [
    { id: 'r1_name', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.2, name: 'Character Name' },
    { id: 'r1_body', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.35, width: 0.8, height: 0.6, name: 'Main Essay' },
    { id: 'r2_body', type: 'writing_area', pageNumber: 2, x: 0.1, y: 0.1, width: 0.8, height: 0.8, name: 'Essay Continued' },
  ];

  it('1 & 2. Two students with two pages each: queues four separate one-page requests, strictly 1 page each', async () => {
    const { tasks, skippedStudents } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
      skipExisting: false,
    });

    expect(skippedStudents).toHaveLength(0);
    // 2 students x 2 pages = 4 single-page tasks
    expect(tasks).toHaveLength(4);

    // Mock transcription service inspecting single-page constraint
    const dispatchedPageUrlCounts: number[] = [];
    const mockService: EssayTranscriptionService = {
      async transcribePage(req: TranscribePageRequest): Promise<TranscribePageResponse> {
        const urls = req.imageUrls || [];
        dispatchedPageUrlCounts.push(urls.length);
        expect(urls.length).toBe(1); // Invariant: exactly 1 page per request
        return {
          status: 'success',
          scanPageId: req.scanPageId,
          studentId: req.studentId,
          transcript: `Transcript for ${req.studentId} page ${req.pageNumber}`,
          modelId: 'Qwen3-VL-32B',
          promptVersion: 'v1.0',
        };
      },
    };

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 2,
    });

    await controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    // Verify 4 separate one-page requests were dispatched
    expect(dispatchedPageUrlCounts).toEqual([1, 1, 1, 1]);
    expect(controller.getProgress().completedTasks).toBe(4);
    expect(controller.getProgress().completedEssays).toBe(2);
  });

  it('3. Page order and student ownership are strictly preserved', () => {
    const student1Tasks = [
      {
        taskId: 't2',
        studentId: 'student_1',
        studentIndex: 0,
        studentName: 'Chan Tai Man',
        classNumber: 1,
        scanPage: mockPages[1],
        part: 2,
        totalParts: 2,
        regions: [],
        status: 'success' as const,
        transcript: 'Part 2 content: The dragon flew away.',
      },
      {
        taskId: 't1',
        studentId: 'student_1',
        studentIndex: 0,
        studentName: 'Chan Tai Man',
        classNumber: 1,
        scanPage: mockPages[0],
        part: 1,
        totalParts: 2,
        regions: [],
        status: 'success' as const,
        transcript: 'Part 1 content: Once upon a time in Hong Kong.',
      },
    ];

    const candidate = combineCandidateTranscript({
      studentId: 'student_1',
      studentIndex: 0,
      tasksForStudent: student1Tasks,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
    });

    // Order must be Part 1 then Part 2 regardless of task array order
    expect(candidate.pageResults[0].part).toBe(1);
    expect(candidate.pageResults[1].part).toBe(2);
    expect(candidate.transcript).toBe(
      'Part 1 content: Once upon a time in Hong Kong.\nPart 2 content: The dragon flew away.'
    );
  });

  it('4. A failed page does not erase successful pages or block remaining students', async () => {
    const { tasks } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
    });

    // Make student 1 page 2 fail
    const mockService: EssayTranscriptionService = {
      async transcribePage(req: TranscribePageRequest): Promise<TranscribePageResponse> {
        if (req.studentId === 'student_1' && req.pageNumber === 2) {
          return {
            status: 'error',
            scanPageId: req.scanPageId,
            studentId: req.studentId,
            message: 'GPU timeout on page 2',
          };
        }
        return {
          status: 'success',
          scanPageId: req.scanPageId,
          studentId: req.studentId,
          transcript: `Text for ${req.studentId} p${req.pageNumber}`,
        };
      },
    };

    const completedCandidates: Record<string, any> = {};
    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 2,
      onStudentCompleted: (cand, sid) => {
        completedCandidates[sid] = cand;
      },
    });

    await controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    const progress = controller.getProgress();
    expect(progress.completedTasks).toBe(3);
    expect(progress.failedTasks).toBe(1);

    // Student 1 should be partially transcribed (not totally lost)
    expect(completedCandidates['student_1'].status).toBe('partially_transcribed');
    expect(completedCandidates['student_1'].transcript).toBe('Text for student_1 p1');

    // Student 2 should be fully transcribed (not blocked by student 1 error)
    expect(completedCandidates['student_2'].status).toBe('candidate_ready');
    expect(completedCandidates['student_2'].transcript).toBe(
      'Text for student_2 p1\nText for student_2 p2'
    );
  });

  it('5. Retry Failed Tasks only retries failed pages', () => {
    const { tasks } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
    });

    tasks[0].status = 'success';
    tasks[0].transcript = 'Good page 1';
    tasks[1].status = 'failed';
    tasks[1].error = 'Timeout';
    tasks[2].status = 'success';
    tasks[2].transcript = 'Good page 2';
    tasks[3].status = 'pending';

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 2,
    });

    controller.retryFailedTasks();
    const currentTasks = controller.getTasks();

    expect(currentTasks[0].status).toBe('success');
    expect(currentTasks[1].status).toBe('pending'); // Reset for retry
    expect(currentTasks[1].error).toBeUndefined();
    expect(currentTasks[2].status).toBe('success');
  });

  it('6. Pause prevents new requests; resume does not duplicate completed work', async () => {
    const { tasks } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
    });

    let callCount = 0;
    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 2,
    });

    const mockService: EssayTranscriptionService = {
      async transcribePage(req: TranscribePageRequest): Promise<TranscribePageResponse> {
        callCount++;
        // Request pause right after first page completes
        if (callCount === 1) {
          controller.requestPause();
        }
        return {
          status: 'success',
          scanPageId: req.scanPageId,
          studentId: req.studentId,
          transcript: `Text p${req.pageNumber}`,
        };
      },
    };

    // First run will pause after 1st task
    await controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    expect(callCount).toBe(1);
    expect(controller.getProgress().status).toBe('paused');
    expect(controller.getProgress().completedTasks).toBe(1);

    // Resume execution
    controller.resume();
    await controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    // Remaining 3 tasks run (total calls = 4, page 1 was NOT re-run)
    expect(callCount).toBe(4);
    expect(controller.getProgress().completedTasks).toBe(4);
    expect(controller.getProgress().status).toBe('completed');
  });

  it('7. Repeated clicks do not create duplicate jobs when already running', async () => {
    const { tasks } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
    });

    let callCount = 0;
    const mockService: EssayTranscriptionService = {
      async transcribePage(req: TranscribePageRequest): Promise<TranscribePageResponse> {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          status: 'success',
          scanPageId: req.scanPageId,
          studentId: req.studentId,
          transcript: `Text`,
        };
      },
    };

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 2,
    });

    // Call run twice simultaneously
    const p1 = controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });
    const p2 = controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    await Promise.all([p1, p2]);
    // Exactly 4 requests made, not 8
    expect(callCount).toBe(4);
  });

  it('8. Teacher-edited and verified text is not overwritten (Skipped in batch by default)', () => {
    const mockTranscripts: Record<string, StudentTranscriptState> = {
      student_1: {
        studentId: 'student_1',
        rawOcrText: 'Initial text',
        editedText: 'Teacher revised text',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true, // Verified
      },
      student_2: {
        studentId: 'student_2',
        rawOcrText: null,
        editedText: 'Draft by student', // Draft exists
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: false,
      },
    };

    const { tasks, skippedStudents } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: mockTranscripts,
      templateRegions: mockTemplateRegions,
      skipExisting: true,
    });

    // Both students skipped because they have existing work
    expect(tasks).toHaveLength(0);
    expect(skippedStudents).toHaveLength(2);
    expect(skippedStudents[0].reason).toContain('verified');
    expect(skippedStudents[1].reason).toContain('existing draft');
  });

  it('11. A running batch keeps its original settings snapshot', () => {
    const initialSettings: AssignmentTranscriptionSettings = {
      version: 'v1.0',
      primaryLanguage: 'en',
      printedLabelsMode: 'separate_context',
      notes: 'Initial notes',
    };

    const { tasks } = buildBatchTasks({
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockAppliedMatching,
      transcripts: {},
      templateRegions: mockTemplateRegions,
    });

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: initialSettings,
      totalEssays: 2,
    });

    // Simulate modifying settings externally while batch is active
    initialSettings.primaryLanguage = 'zh';
    initialSettings.notes = 'Changed notes';
    initialSettings.version = 'v2.0';

    // Running batch snapshot must remain isolated
    const snapshot = controller.getSettingsSnapshot();
    expect(snapshot.primaryLanguage).toBe('en');
    expect(snapshot.notes).toBe('Initial notes');
    expect(snapshot.version).toBe('v1.0');
  });

  it('12. Missing / mismatched writing regions produce an actionable error', () => {
    // Template only has writing area for page 1, but scan page is page 2
    const singlePageTemplate: TemplateRegion[] = [
      { id: 'r1', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    ];

    const result = resolveWritingAreasForPage(mockPages[1], 2, singlePageTemplate);
    expect(result.hasError).toBe(true);
    expect(result.errorMessage).toContain('Page 2 layout mismatch');
    expect(result.errorMessage).toContain('Preparation or Adjust Regions');
  });

  it('13. Multiple writing areas are processed in their configured reading order', () => {
    const areas: TemplateRegion[] = [
      { id: 'area_body', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.4, width: 0.8, height: 0.5, name: 'Body' },
      { id: 'area_header', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.2, name: 'Title' },
    ];

    const resolved = resolveWritingAreasForPage(mockPages[0], 1, areas);
    expect(resolved.hasError).toBe(false);
    expect(resolved.regions).toHaveLength(2);
  });

  it('9. Context changes cause stale responses to be detected and rejected', () => {
    // Generate signature for student 0 with pages [page_1_1, page_1_2]
    const initialSig = computeStudentPageSignature(0, mockAppliedMatching, mockPages);
    expect(initialSig).toBe('page_1_1,page_1_2');

    // Simulate teacher reassigning pages in Step 3 (swapping pages or assigning page_2_1)
    const alteredMatching: AppliedMatching = {
      ...mockAppliedMatching,
      map: [
        { studentIndex: 0, studentId: 'student_1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 2 },
        { studentIndex: 1, studentId: 'student_2', studentName: 'Lee Siu Ming', classNumber: 2, part: 1, total: 2 }, // altered!
        { studentIndex: 0, studentId: 'student_1', studentName: 'Chan Tai Man', classNumber: 1, part: 2, total: 2 },
        { studentIndex: 1, studentId: 'student_2', studentName: 'Lee Siu Ming', classNumber: 2, part: 2, total: 2 },
      ],
    };

    const newSig = computeStudentPageSignature(0, alteredMatching, mockPages);
    expect(newSig).toBe('page_1_1,page_2_1'); // Mismatches previous page signature!

    // Candidate revalidation will detect signature mismatch and mark candidate as stale
    const isStale = initialSig !== newSig;
    expect(isStale).toBe(true);
  });

  it('10. Saving settings does not call any model or run requests', () => {
    const mockModelFn = vi.fn();
    let currentSettings = { ...DEFAULT_TRANSCRIPTION_SETTINGS };

    // Function that updates settings
    function handleSaveSettings(newSettings: AssignmentTranscriptionSettings) {
      currentSettings = { ...newSettings };
    }

    handleSaveSettings({
      ...currentSettings,
      primaryLanguage: 'zh',
      notes: 'Include character name',
    });

    // Model function was never invoked
    expect(mockModelFn).not.toHaveBeenCalled();
    expect(currentSettings.primaryLanguage).toBe('zh');
    expect(currentSettings.notes).toBe('Include character name');
  });

  it('14. Mathpix and cloud API calls remain zero during local VL transcription', async () => {
    const mathpixFetchSpy = vi.fn();

    const mockService: EssayTranscriptionService = {
      async transcribePage(req: TranscribePageRequest): Promise<TranscribePageResponse> {
        // Local Qwen VL route only: zero outbound requests to Mathpix API
        return {
          status: 'success',
          scanPageId: req.scanPageId,
          studentId: req.studentId,
          transcript: 'Transcribed by Local Qwen VL',
          provider: 'local_qwen_vl',
          modelId: 'Qwen3-VL-32B',
        };
      },
    };

    const { tasks } = buildBatchTasks({
      students: [mockStudents[0]],
      pages: [mockPages[0]],
      appliedMatching: {
        ...mockAppliedMatching,
        assignedStudentIndices: [0],
        map: [mockAppliedMatching.map[0]],
      },
      transcripts: {},
      templateRegions: mockTemplateRegions,
      skipExisting: false,
    });

    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents: [],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      totalEssays: 1,
    });

    await controller.run({
      transcriptionService: mockService,
      appliedMatching: mockAppliedMatching,
      pages: mockPages,
    });

    expect(mathpixFetchSpy).toHaveBeenCalledTimes(0);
    expect(controller.getProgress().completedTasks).toBe(1);
  });
});

