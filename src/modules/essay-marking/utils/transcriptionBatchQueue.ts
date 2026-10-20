import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  AssignmentTranscriptionSettings,
  TemplateRegion,
  StagedCandidateTranscript,
  PageTranscriptionResult,
  StudentTranscriptState,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  TranscriptionProvider,
} from '../types';
import {
  TranscribePageRequest,
  EssayTranscriptionService,
} from '../services/essayServiceTypes';

export interface BatchPageTask {
  taskId: string;
  studentId: string;
  studentIndex: number;
  studentName: string;
  classNumber: number;
  scanPage: ScanPage;
  part: number;
  totalParts: number;
  regions: TemplateRegion[];
  status: 'pending' | 'processing' | 'success' | 'failed';
  transcript?: string;
  linesWithBboxes?: Array<{
    text: string;
    bbox: [number, number, number, number] | null;
    scanPageId?: string;
    pageNumber?: number;
  }>;
  error?: string;
  errorCode?: string;
  httpStatus?: number;
  isRetryable?: boolean;
  modelId?: string;
  promptVersion?: string;
  settingsVersion?: string;
  hasUnreadable?: boolean;
}

export interface SkippedStudentReport {
  studentId: string;
  studentName: string;
  classNumber: number;
  reason: string;
}

export interface BatchQueueProgress {
  status: 'idle' | 'running' | 'pausing' | 'paused' | 'completed' | 'stopped';
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalEssays: number;
  completedEssays: number;
  currentStudentName: string | null;
  currentPageNumber: number | null;
  currentTotalParts: number | null;
  activeTaskId: string | null;
  skippedStudents: SkippedStudentReport[];
}

/**
 * Computes a deterministic signature of page IDs assigned to a student.
 */
export function computeStudentPageSignature(
  studentIndex: number,
  appliedMatching: AppliedMatching,
  pages: ScanPage[]
): string {
  const pageIds: string[] = [];
  appliedMatching.map.forEach((item, pageIndex) => {
    if (item && item.studentIndex === studentIndex && pages[pageIndex]) {
      pageIds.push(pages[pageIndex].id);
    }
  });
  return pageIds.sort().join(',');
}

/**
 * Resolves writing areas applicable to a specific scan page.
 * Strictly verifies page-to-template alignment:
 * - Checks scanPage.customRegions first.
 * - If not present, checks templateRegions matching pageNumber === part.
 * - Does NOT silently apply template page 1's regions to page 2 if page 2 has different or missing layout.
 */
export function resolveWritingAreasForPage(
  scanPage: ScanPage,
  part: number,
  templateRegions?: TemplateRegion[]
): {
  regions: TemplateRegion[];
  hasError: boolean;
  errorMessage?: string;
} {
  const safeTemplateRegions = Array.isArray(templateRegions) ? templateRegions : [];

  // 1. If page has custom adjusted regions, use those
  if (Array.isArray(scanPage?.customRegions) && scanPage.customRegions.length > 0) {
    const customAreas = scanPage.customRegions.filter(
      (r) => r && (r.type === 'writing_area' || !r.type)
    );
    if (customAreas.length > 0) {
      return { regions: customAreas, hasError: false };
    }
  }

  // 2. Check template regions defined for this exact page part
  const matchingTemplateAreas = safeTemplateRegions.filter(
    (r) => r && r.type === 'writing_area' && r.pageNumber === part
  );

  if (matchingTemplateAreas.length > 0) {
    return { regions: matchingTemplateAreas, hasError: false };
  }

  // 3. Check if template has writing areas defined on other pages
  const totalTemplateWritingAreas = safeTemplateRegions.filter(
    (r) => r && r.type === 'writing_area'
  );

  if (totalTemplateWritingAreas.length > 0) {
    // Other pages have areas, but THIS page has none defined
    return {
      regions: [],
      hasError: true,
      errorMessage: `Page ${part} layout mismatch: Template has writing areas on other pages, but none defined for Page ${part}. Please configure writing areas in Preparation or Adjust Regions.`,
    };
  }

  // 4. Missing required writing areas: No writing areas exist anywhere on the template
  return {
    regions: [],
    hasError: true,
    errorMessage: `Missing required writing areas: No writing areas have been defined on the worksheet template. Please configure writing areas in Preparation before transcribing.`,
  };
}

/**
 * Builds the list of single-page tasks for all eligible students.
 * Skips students who already have verified transcripts or complete drafts (unless retrying).
 */
export function buildBatchTasks({
  students,
  pages,
  appliedMatching,
  transcripts,
  templateRegions,
  skipExisting = true,
}: {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching;
  transcripts: Record<string, StudentTranscriptState>;
  templateRegions?: TemplateRegion[];
  skipExisting?: boolean;
}): {
  tasks: BatchPageTask[];
  skippedStudents: SkippedStudentReport[];
} {
  const tasks: BatchPageTask[] = [];
  const skippedStudents: SkippedStudentReport[] = [];

  appliedMatching.assignedStudentIndices.forEach((studentIdx) => {
    const student = students[studentIdx];
    if (!student) return;

    // Check existing transcript state
    const existing = transcripts[student.id];
    if (skipExisting && existing) {
      if (existing.isVerified) {
        skippedStudents.push({
          studentId: student.id,
          studentName: student.displayName,
          classNumber: student.classNumber,
          reason: 'Transcript already verified by teacher',
        });
        return;
      }
      if (existing.editedText && existing.editedText.trim().length > 0) {
        skippedStudents.push({
          studentId: student.id,
          studentName: student.displayName,
          classNumber: student.classNumber,
          reason: 'Student has existing draft transcript',
        });
        return;
      }
    }

    // Collect all pages assigned to this student in confirmed order
    const studentPageItems: Array<{ page: ScanPage; part: number; total: number }> = [];
    appliedMatching.map.forEach((item, pageIndex) => {
      if (item && item.studentIndex === studentIdx && pages[pageIndex]) {
        studentPageItems.push({
          page: pages[pageIndex],
          part: item.part,
          total: item.total,
        });
      }
    });

    if (studentPageItems.length === 0) {
      skippedStudents.push({
        studentId: student.id,
        studentName: student.displayName,
        classNumber: student.classNumber,
        reason: 'No scan pages assigned in matching',
      });
      return;
    }

    // Sort by confirmed part order (Page 1, Page 2, ...)
    studentPageItems.sort((a, b) => a.part - b.part);

    studentPageItems.forEach((item) => {
      const areaCheck = resolveWritingAreasForPage(
        item.page,
        item.part,
        templateRegions
      );

      tasks.push({
        taskId: `${student.id}_p${item.part}_${item.page.id}`,
        studentId: student.id,
        studentIndex: studentIdx,
        studentName: student.displayName,
        classNumber: student.classNumber,
        scanPage: item.page,
        part: item.part,
        totalParts: item.total,
        regions: areaCheck.regions,
        status: areaCheck.hasError ? 'failed' : 'pending',
        error: areaCheck.errorMessage,
      });
    });
  });

  return { tasks, skippedStudents };
}

/**
 * Combines page-level results into a structured student candidate transcript.
 * Retains page results in confirmed part order.
 */
export function combineCandidateTranscript(
  arg1:
    | {
        studentId: string;
        studentIndex?: number;
        tasksForStudent?: BatchPageTask[];
        pageResults?: PageTranscriptionResult[];
        appliedMatching?: AppliedMatching;
        pages?: ScanPage[];
        settings?: AssignmentTranscriptionSettings;
        assignmentId?: string;
        pageSignature?: string;
        provider?: TranscriptionProvider;
      }
    | string,
  arg2?: PageTranscriptionResult[],
  arg3?: AssignmentTranscriptionSettings,
  arg4?: TranscriptionProvider,
  arg5?: string,
  arg6?: string
): StagedCandidateTranscript {
  let studentId = '';
  let studentIndex = 0;
  let pageResults: PageTranscriptionResult[] = [];
  let settings: AssignmentTranscriptionSettings = DEFAULT_TRANSCRIPTION_SETTINGS;
  let provider: TranscriptionProvider = 'local_qwen_vl';
  let pageSignature = '';
  let assignmentId: string | undefined = undefined;

  if (typeof arg1 === 'string') {
    // Positional call: (studentId, pageResults, settings, provider, signature, assignmentId)
    studentId = arg1;
    pageResults = Array.isArray(arg2) ? [...arg2] : [];
    if (arg3) settings = arg3;
    if (arg4) provider = arg4;
    if (typeof arg5 === 'string') pageSignature = arg5;
    if (typeof arg6 === 'string') assignmentId = arg6;
  } else if (arg1 && typeof arg1 === 'object') {
    studentId = arg1.studentId;
    studentIndex = arg1.studentIndex ?? 0;
    assignmentId = arg1.assignmentId;
    if (arg1.settings) settings = arg1.settings;
    if (arg1.provider) provider = arg1.provider;
    if (arg1.pageSignature) {
      pageSignature = arg1.pageSignature;
    } else if (arg1.appliedMatching && arg1.pages) {
      pageSignature = computeStudentPageSignature(studentIndex, arg1.appliedMatching, arg1.pages);
    }

    if (Array.isArray(arg1.pageResults)) {
      pageResults = [...arg1.pageResults];
    } else if (Array.isArray(arg1.tasksForStudent)) {
      pageResults = arg1.tasksForStudent.map((t) => ({
        scanPageId: t.scanPage.id,
        part: t.part,
        totalParts: t.totalParts,
        status: t.status === 'success' ? 'success' : 'failed',
        transcript: t.transcript,
        linesWithBboxes: t.linesWithBboxes,
        error: t.error,
        errorCode: t.errorCode,
        httpStatus: t.httpStatus,
        isRetryable: t.isRetryable,
        modelId: t.modelId,
        promptVersion: t.promptVersion,
        settingsVersion: t.settingsVersion,
        hasUnreadable: t.hasUnreadable,
      }));
    }
  }

  // Sort tasks in strict part order
  const sorted = [...pageResults].sort((a, b) => a.part - b.part);

  const allSuccess = sorted.length > 0 && sorted.every((t) => t.status === 'success');
  const anySuccess = sorted.some((t) => t.status === 'success');

  // Preserve faithful line breaks and paragraph structure across pages
  // Normalize CRLF to LF and trim leading/trailing empty lines
  // Join multi-page text with '\n' to prevent inventing blank-line paragraphs at page boundaries
  const combinedText = sorted
    .filter((t) => t.status === 'success' && t.transcript && t.transcript.trim())
    .map((t) => (t.transcript || '').replace(/\r\n/g, '\n').trim())
    .join('\n');

  const words = combinedText.trim().split(/\s+/).filter(Boolean);

  const allLinesWithBboxes: Array<{
    text: string;
    bbox: [number, number, number, number] | null;
    scanPageId?: string;
    pageNumber?: number;
  }> = [];

  sorted.forEach((pr) => {
    if (pr.status === 'success' && Array.isArray(pr.linesWithBboxes)) {
      pr.linesWithBboxes.forEach((l) => {
        allLinesWithBboxes.push({
          ...l,
          scanPageId: pr.scanPageId,
          pageNumber: pr.part,
        });
      });
    }
  });

  return {
    id: `candidate_${studentId}_${Date.now()}`,
    studentId,
    assignmentId,
    transcript: combinedText,
    linesWithBboxes: allLinesWithBboxes,
    receivedAt: Date.now(),
    provider,
    modelId: sorted[0]?.modelId,
    promptVersion: sorted[0]?.promptVersion || 'Version unavailable',
    settingsVersion: settings.version || 'v1.0',
    pageSignature,
    status: allSuccess
      ? 'candidate_ready'
      : anySuccess
      ? 'partially_transcribed'
      : 'failed',
    pageResults: sorted,
    hasUnreadable: sorted.some((t) => t.hasUnreadable),
    wordCount: words.length,
  };
}

/**
 * Batch Queue Controller that manages serial page execution with pause, resume,
 * retry, and settings snapshot.
 */
export class BatchTranscriptionQueueController {
  private tasks: BatchPageTask[] = [];
  private progress: BatchQueueProgress = {
    status: 'idle',
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalEssays: 0,
    completedEssays: 0,
    currentStudentName: null,
    currentPageNumber: null,
    currentTotalParts: null,
    activeTaskId: null,
    skippedStudents: [],
  };

  private isPauseRequested = false;
  private isStopped = false;
  private isExecuting = false;
  private settingsSnapshot: AssignmentTranscriptionSettings;
  private onProgressCallback?: (progress: BatchQueueProgress) => void;
  private onStudentCompletedCallback?: (
    candidate: StagedCandidateTranscript,
    studentId: string
  ) => void;

  constructor({
    tasks,
    skippedStudents,
    settings,
    totalEssays,
    onProgress,
    onStudentCompleted,
  }: {
    tasks: BatchPageTask[];
    skippedStudents: SkippedStudentReport[];
    settings: AssignmentTranscriptionSettings;
    totalEssays: number;
    onProgress?: (progress: BatchQueueProgress) => void;
    onStudentCompleted?: (
      candidate: StagedCandidateTranscript,
      studentId: string
    ) => void;
  }) {
    this.tasks = tasks;
    // Freeze settings snapshot for running batch
    this.settingsSnapshot = { ...settings };
    this.onProgressCallback = onProgress;
    this.onStudentCompletedCallback = onStudentCompleted;

    const failedInitial = tasks.filter((t) => t.status === 'failed').length;

    this.progress = {
      status: 'idle',
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: failedInitial,
      totalEssays,
      completedEssays: 0,
      currentStudentName: null,
      currentPageNumber: null,
      currentTotalParts: null,
      activeTaskId: null,
      skippedStudents,
    };
  }

  getProgress(): BatchQueueProgress {
    return { ...this.progress };
  }

  getTasks(): BatchPageTask[] {
    return [...this.tasks];
  }

  getSettingsSnapshot(): AssignmentTranscriptionSettings {
    return { ...this.settingsSnapshot };
  }

  requestPause() {
    if (this.progress.status === 'running') {
      this.isPauseRequested = true;
      this.progress.status = 'pausing';
      this.notifyProgress();
    }
  }

  resume() {
    if (this.progress.status === 'paused' || this.progress.status === 'pausing') {
      this.isPauseRequested = false;
      this.progress.status = 'idle';
      this.notifyProgress();
    }
  }

  stop() {
    this.isStopped = true;
    this.progress.status = 'stopped';
    this.notifyProgress();
  }

  /**
   * Resets only the failed tasks to pending so they can be retried.
   */
  retryFailedTasks() {
    this.tasks.forEach((t) => {
      if (t.status === 'failed') {
        t.status = 'pending';
        t.error = undefined;
      }
    });
    this.progress.failedTasks = 0;
    this.isPauseRequested = false;
    this.isStopped = false;
    this.notifyProgress();
  }

  /**
   * Runs the queue serially, processing ONE page per request.
   */
  async run({
    transcriptionService,
    appliedMatching,
    pages,
    assignmentId,
  }: {
    transcriptionService: EssayTranscriptionService;
    appliedMatching: AppliedMatching;
    pages: ScanPage[];
    assignmentId?: string;
  }): Promise<void> {
    if (this.isExecuting) return; // Prevent duplicate concurrent runs

    this.isExecuting = true;
    this.progress.status = 'running';
    this.isPauseRequested = false;
    this.isStopped = false;
    this.notifyProgress();

    try {


    // Group tasks by student
    const studentIds = Array.from(new Set(this.tasks.map((t) => t.studentId)));

    for (const studentId of studentIds) {
      if (this.isStopped) break;

      const studentTasks = this.tasks.filter((t) => t.studentId === studentId);

      for (const task of studentTasks) {
        if (this.isStopped) break;

        // Check if pause was requested before dispatching next request
        if (this.isPauseRequested) {
          this.progress.status = 'paused';
          this.progress.activeTaskId = null;
          this.notifyProgress();
          return; // Halts dispatching without losing completed work
        }

        // If task was already completed successfully, skip
        if (task.status === 'success') continue;

        // Update progress state for current task
        this.progress.currentStudentName = task.studentName;
        this.progress.currentPageNumber = task.part;
        this.progress.currentTotalParts = task.totalParts;
        this.progress.activeTaskId = task.taskId;
        task.status = 'processing';
        this.notifyProgress();

        // Check if task already has a pre-existing error (e.g. layout mismatch)
        if (task.error) {
          task.status = 'failed';
          this.progress.failedTasks++;
          this.notifyProgress();
          continue;
        }

        // Execute single-page request
        try {
          const req: TranscribePageRequest = {
            scanPageId: task.scanPage.id,
            studentId: task.studentId,
            assignmentId,
            imageUrls: [task.scanPage.previewUrl], // Strictly ONE page URL
            pageNumber: task.part,
            totalParts: task.totalParts,
            regions: task.regions,
            readingOrder: this.settingsSnapshot.readingOrder,
            settings: this.settingsSnapshot,
          };

          const res = await transcriptionService.transcribePage(req);

          if (res.status === 'success') {
            task.status = 'success';
            task.transcript = res.transcript;
            task.linesWithBboxes = res.linesWithBboxes;
            task.modelId = res.modelId;
            task.promptVersion = res.promptVersion;
            task.settingsVersion = res.settingsVersion;
            task.hasUnreadable = res.hasUnreadable;
            this.progress.completedTasks++;
          } else {
            task.status = 'failed';
            task.error = res.message || res.error || (res.code ? `Transcription error: ${res.code}` : 'Transcription failed');
            task.errorCode = res.code;
            task.httpStatus = res.httpStatus;
            task.isRetryable = res.isRetryable;
            this.progress.failedTasks++;
          }
        } catch (err) {
          task.status = 'failed';
          const errMsg = err instanceof Error ? err.message : 'Unknown transcription error';
          task.error = errMsg;
          task.errorCode = 'TASK_EXECUTION_ERROR';
          task.isRetryable = true;
          this.progress.failedTasks++;
        }

        this.notifyProgress();
      }

      // Check if student is finished and assemble candidate transcript
      const studentTasksDone = studentTasks.every(
        (t) => t.status === 'success' || t.status === 'failed'
      );

      if (studentTasksDone) {
        const candidate = combineCandidateTranscript({
          studentId,
          studentIndex: studentTasks[0].studentIndex,
          tasksForStudent: studentTasks,
          appliedMatching,
          pages,
          settings: this.settingsSnapshot,
          assignmentId,
        });

        this.progress.completedEssays++;
        this.onStudentCompletedCallback?.(candidate, studentId);
        this.notifyProgress();
      }
    }

    this.progress.status = this.isPauseRequested ? 'paused' : 'completed';
    this.progress.activeTaskId = null;
    this.progress.currentStudentName = null;
    this.progress.currentPageNumber = null;
    this.progress.currentTotalParts = null;
    this.notifyProgress();
  } finally {
    this.isExecuting = false;
  }
}

  private notifyProgress() {
    this.onProgressCallback?.({ ...this.progress });
  }
}
