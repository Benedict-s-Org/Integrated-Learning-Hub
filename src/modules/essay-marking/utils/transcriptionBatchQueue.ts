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
  EssayOcrService,
} from '../services/essayServiceTypes';
import { prepareOcrImageFromRegions, prepareOcrRegionsInReadingOrder } from './regionAwareOcr';

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
  ocrMode?: TranscriptionProvider;
  mathpixRawTranscript?: string;
  qwenVerifiedTranscript?: string;
  qwenVerificationStatus?: 'success' | 'incomplete' | 'failed' | 'skipped';
  qwenChanges?: Array<{ ocrOriginal: string; verified: string; reason: string }>;
  isDryRun?: boolean;
  ocrRegionImageUrl?: string;
  isRegionCrop?: boolean;
  isBlank?: boolean;
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
  if (Array.isArray(appliedMatching?.map)) {
    appliedMatching.map.forEach((item, pageIndex) => {
      if (item && item.studentIndex === studentIndex && pages[pageIndex]) {
        pageIds.push(pages[pageIndex].id);
      }
    });
  } else if (appliedMatching?.studentPageOrders) {
    const studentKeys = Object.keys(appliedMatching.studentPageOrders);
    const sId = studentKeys[studentIndex];
    if (sId && appliedMatching.studentPageOrders[sId]) {
      pageIds.push(...appliedMatching.studentPageOrders[sId]);
    }
  }
  return pageIds.join(',');
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
  isBlank?: boolean;
  hasError: boolean;
  errorMessage?: string;
} {
  // 1. If page is marked blank: skip OCR and do not require custom regions
  if (scanPage?.isBlank) {
    return { regions: [], isBlank: true, hasError: false };
  }

  // 2. Page 3 onward (continuation page):
  // Must use saved custom regions for this page; never falls back to full page or page 1/2 templates
  if (part >= 3) {
    if (Array.isArray(scanPage?.customRegions) && scanPage.customRegions.length > 0) {
      const customAreas = scanPage.customRegions.filter(
        (r) => r && (r.type === 'writing_area' || !r.type)
      );
      if (customAreas.length > 0) {
        const sorted = [...customAreas].sort(
          (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
        );
        return { regions: sorted, hasError: false };
      }
    }

    return {
      regions: [],
      hasError: true,
      errorMessage: `Page ${part} setup incomplete: Non-blank continuation page requires custom OCR regions to be set in Match Students.`,
    };
  }

  const safeTemplateRegions = Array.isArray(templateRegions) ? templateRegions : [];

  // 3. For pages 1-2: if page has custom adjusted regions, use those
  if (Array.isArray(scanPage?.customRegions) && scanPage.customRegions.length > 0) {
    const customAreas = scanPage.customRegions.filter(
      (r) => r && (r.type === 'writing_area' || !r.type)
    );
    if (customAreas.length > 0) {
      const sorted = [...customAreas].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      return { regions: customAreas, hasError: false };
    }
  }

  // 4. Check template regions defined for this exact page part
  const matchingTemplateAreas = safeTemplateRegions.filter(
    (r) => r && r.type === 'writing_area' && r.pageNumber === part
  );

  if (matchingTemplateAreas.length > 0) {
    const sorted = [...matchingTemplateAreas].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    );
    return { regions: sorted, hasError: false };
  }

  // 5. Check if template has writing areas defined on other pages
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

  // 6. Pages 1-2 with no template writing areas defined: retain existing OCR behavior (full page)
  return {
    regions: [],
    hasError: false,
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

  const assignedIndices = Array.isArray(appliedMatching?.assignedStudentIndices)
    ? appliedMatching.assignedStudentIndices
    : students.map((_, idx) => idx);

  assignedIndices.forEach((studentIdx) => {
    const student = students[studentIdx];
    if (!student) return;

    // Check existing transcript state
    const existing = transcripts ? transcripts[student.id] : undefined;
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
    if (Array.isArray(appliedMatching?.map)) {
      appliedMatching.map.forEach((item, pageIndex) => {
        if (item && item.studentIndex === studentIdx && pages[pageIndex]) {
          studentPageItems.push({
            page: pages[pageIndex],
            part: item.part,
            total: item.total,
          });
        }
      });
    } else if (appliedMatching?.studentPageOrders && appliedMatching.studentPageOrders[student.id]) {
      const order = appliedMatching.studentPageOrders[student.id];
      const pageMap = new Map<string, ScanPage>();
      pages.forEach((p) => pageMap.set(p.id, p));
      order.forEach((pId, idx) => {
        const p = pageMap.get(pId);
        if (p) {
          studentPageItems.push({
            page: p,
            part: idx + 1,
            total: order.length,
          });
        }
      });
    }

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
      // Confirmed blank page:
      // "For confirmed blank pages:
      // - Submit no OCR request.
      // - Exclude their text from transcript assembly.
      // - Do not count them as unfinished OCR."
      if (item.page.isBlank) {
        tasks.push({
          taskId: `${student.id}_p${item.part}_${item.page.id}`,
          studentId: student.id,
          studentIndex: studentIdx,
          studentName: student.displayName,
          classNumber: student.classNumber,
          scanPage: item.page,
          part: item.part,
          totalParts: item.total,
          regions: [],
          status: 'success', // Resolved without OCR request
          transcript: '',
          isBlank: true,
        });
        return;
      }

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
        isBlank: false,
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
        ocrMode: t.ocrMode,
        mathpixRawTranscript: t.mathpixRawTranscript,
        qwenVerifiedTranscript: t.qwenVerifiedTranscript,
        qwenVerificationStatus: t.qwenVerificationStatus,
        qwenChanges: t.qwenChanges,
        isDryRun: t.isDryRun,
        ocrRegionImageUrl: t.ocrRegionImageUrl,
        isRegionCrop: t.isRegionCrop,
        isBlank: t.isBlank || t.scanPage?.isBlank,
      }));
    }
  }

  // Sort tasks in strict part order
  const sorted = [...pageResults].sort((a, b) => a.part - b.part);

  const nonBlankSorted = sorted.filter((t) => !t.isBlank);
  const isEntireScriptBlank = sorted.length > 0 && sorted.every((t) => Boolean(t.isBlank));
  const allSuccess =
    sorted.length > 0 &&
    (isEntireScriptBlank || (nonBlankSorted.length > 0 && nonBlankSorted.every((t) => t.status === 'success')));
  const anySuccess = nonBlankSorted.some((t) => t.status === 'success');

  // Preserve faithful line breaks and paragraph structure across pages
  // Normalize CRLF to LF and trim leading/trailing empty lines
  // Join multi-page text with '\n' to prevent inventing blank-line paragraphs at page boundaries
  // Blank pages are excluded from transcript text assembly
  const combinedText = sorted
    .filter((t) => t.status === 'success' && !t.isBlank && t.transcript && t.transcript.trim())
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
    if (pr.status === 'success' && !pr.isBlank && Array.isArray(pr.linesWithBboxes)) {
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
    status: isEntireScriptBlank
      ? 'candidate_ready'
      : allSuccess
      ? 'candidate_ready'
      : anySuccess
      ? 'partially_transcribed'
      : 'failed',
    pageResults: sorted,
    hasUnreadable: sorted.some((t) => t.hasUnreadable),
    wordCount: words.length,
    isEntireScriptBlank,
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
    provider: runProvider,
    ocrService: runOcrService,
  }: {
    transcriptionService: EssayTranscriptionService;
    appliedMatching: AppliedMatching;
    pages: ScanPage[];
    assignmentId?: string;
    provider?: TranscriptionProvider;
    ocrService?: EssayOcrService;
  }): Promise<void> {
    if (this.isExecuting) return; // Prevent duplicate concurrent runs

    // Selected OCR mode frozen for this run. Defaults to legacy local Qwen VL
    // behavior when no provider is supplied (backward compatibility).
    const provider: TranscriptionProvider = runProvider || 'local_qwen_vl';
    const ocrService = runOcrService;

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
          if (provider === 'mathpix_only' || provider === 'mathpix_qwen_verify') {
            // Mathpix-first flow. NEVER calls local Qwen transcription in
            // mathpix_only mode; Qwen VL is only used for verification in
            // combined mode, AFTER Mathpix has produced a transcript.
            if (!ocrService) {
              task.status = 'failed';
              task.error = 'Mathpix OCR service is unavailable for the selected mode.';
              task.errorCode = 'OCR_SERVICE_UNAVAILABLE';
              task.isRetryable = false;
              this.progress.failedTasks++;
              this.notifyProgress();
              continue;
            }

            // Shared region-aware preparation:
            // When multiple regions are configured on a page (e.g. continuation page),
            // process each region sequentially in configured reading order and join with '\n\n'.
            if (Array.isArray(task.regions) && task.regions.length > 1) {
              const preparedList = await prepareOcrRegionsInReadingOrder(
                task.scanPage.previewUrl,
                task.regions
              );
              const anyError = preparedList.find((p) => p.error);
              if (anyError) {
                task.status = 'failed';
                task.error = anyError.error;
                task.errorCode = 'INVALID_OCR_REGION';
                task.isRetryable = false;
                this.progress.failedTasks++;
                this.notifyProgress();
                continue;
              }

              const regionTexts: string[] = [];
              let regionFailed = false;

              for (let rIdx = 0; rIdx < preparedList.length; rIdx++) {
                const prep = preparedList[rIdx];
                const ocrRes = await ocrService.recognize({
                  imageUrls: [prep.imageUrl],
                  studentId: task.studentId,
                  assignmentId,
                });

                if (ocrRes.status !== 'success') {
                  task.status = 'failed';
                  task.error = ocrRes.message || `OCR recognition failed for region #${rIdx + 1}.`;
                  task.errorCode = (ocrRes as any).code || 'OCR_ERROR';
                  task.ocrMode = provider;
                  this.progress.failedTasks++;
                  this.notifyProgress();
                  regionFailed = true;
                  break;
                }
                regionTexts.push(ocrRes.transcript.trim());
              }

              if (regionFailed) continue;

              const combinedRegionText = regionTexts.join('\n\n').trim();
              task.status = 'success';
              task.transcript = combinedRegionText;
              task.mathpixRawTranscript = combinedRegionText;
              task.linesWithBboxes = combinedRegionText.split('\n').map((l) => ({
                text: l,
                bbox: null,
                scanPageId: task.scanPage.id,
                pageNumber: task.part,
              }));
              task.ocrMode = 'mathpix_only';
              task.isRegionCrop = true;
              this.progress.completedTasks++;
              this.notifyProgress();
              continue;
            }

            // Single region or full-page fallback for pages 1-2
            const prepared = await prepareOcrImageFromRegions(
              task.scanPage.previewUrl,
              task.regions
            );

            if (prepared.error) {
              task.status = 'failed';
              task.error = prepared.error;
              task.errorCode = 'INVALID_OCR_REGION';
              task.isRetryable = false;
              this.progress.failedTasks++;
              this.notifyProgress();
              continue;
            }

            task.ocrRegionImageUrl = prepared.imageUrl;
            task.isRegionCrop = prepared.isRegionCrop;

            const ocrRes = await ocrService.recognize({
              imageUrls: [prepared.imageUrl],
              studentId: task.studentId,
              assignmentId,
            });

            if (ocrRes.status === 'dry_run_ready') {
              task.status = 'failed';
              task.error = ocrRes.message || 'Mathpix DRY_RUN active: live billing requests are blocked.';
              task.errorCode = ocrRes.code || 'DRY_RUN_ACTIVE';
              task.isRetryable = false;
              task.isDryRun = true;
              task.ocrMode = provider;
              this.progress.failedTasks++;
              this.notifyProgress();
              continue;
            }

            if (ocrRes.status !== 'success') {
              task.status = 'failed';
              task.error = ocrRes.message || 'Mathpix OCR recognition failed.';
              task.errorCode = (ocrRes as any).code || 'OCR_ERROR';
              task.ocrMode = provider;
              this.progress.failedTasks++;
              this.notifyProgress();
              continue;
            }

            const mathpixText = ocrRes.transcript.trim();
            const mathpixLines = mathpixText
              .replace(/\r\n/g, '\n')
              .split('\n')
              .map((l) => ({
                text: l,
                bbox: null as [number, number, number, number] | null,
                scanPageId: task.scanPage.id,
                pageNumber: task.part,
              }));

            if (provider === 'mathpix_only') {
              task.status = 'success';
              task.transcript = mathpixText;
              task.mathpixRawTranscript = mathpixText;
              task.linesWithBboxes = mathpixLines;
              task.ocrMode = 'mathpix_only';
              this.progress.completedTasks++;
              this.notifyProgress();
              continue;
            }

            // Combined mode: verify with Qwen VL (Mathpix output is preserved
            // even if verification fails, enabling verification-only retry).
            let qwenRes: any = null;
            if (transcriptionService.verifyTranscription) {
              try {
                qwenRes = await transcriptionService.verifyTranscription({
                  scanPageId: task.scanPage.id,
                  studentId: task.studentId,
                  pageNumber: task.part,
                  // Verify the SAME image Mathpix OCR ran on (selected region crop when applicable).
                  imageDataUri: prepared.imageUrl,
                  mathpixTranscript: mathpixText,
                  settings: this.settingsSnapshot,
                });
              } catch (qwenErr: any) {
                qwenRes = {
                  status: 'error',
                  message: qwenErr?.message || 'Qwen verification request failed',
                };
              }
            }

            if (qwenRes && qwenRes.status === 'success' && qwenRes.verifiedTranscript) {
              const verifiedText = qwenRes.verifiedTranscript.trim();
              task.status = 'success';
              task.transcript = verifiedText;
              task.mathpixRawTranscript = mathpixText;
              task.qwenVerifiedTranscript = verifiedText;
              task.qwenVerificationStatus = 'success';
              task.qwenChanges = qwenRes.changes || [];
              task.linesWithBboxes = verifiedText
                .replace(/\r\n/g, '\n')
                .split('\n')
                .map((l: string) => ({
                  text: l,
                  bbox: null as [number, number, number, number] | null,
                  scanPageId: task.scanPage.id,
                  pageNumber: task.part,
                }));
              task.modelId = qwenRes.modelId;
              task.ocrMode = 'mathpix_qwen_verify';
              this.progress.completedTasks++;
            } else {
              // Mathpix succeeded -> RETAIN MATHPIX TRANSCRIPT
              const qwenErrMsg =
                qwenRes?.message || 'Qwen VL verification incomplete on port 18088';
              task.status = 'success';
              task.transcript = mathpixText;
              task.mathpixRawTranscript = mathpixText;
              task.qwenVerificationStatus = 'failed';
              task.error = `Qwen VL verification incomplete: ${qwenErrMsg}`;
              task.linesWithBboxes = mathpixLines;
              task.ocrMode = 'mathpix_qwen_verify';
              this.progress.completedTasks++;
            }
            this.notifyProgress();
            continue;
          }

          // Legacy/direct mode: local Qwen VL transcription via bridge.
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
          provider,
        });

        // Mirror single-page flow: if any page kept its Mathpix transcript
        // because Qwen verification failed, surface verification_pending
        // state so the teacher can retry verification without re-billing
        // Mathpix.
        const anyQwenIncomplete = studentTasks.some(
          (t) => t.qwenVerificationStatus === 'failed'
        );

        if (anyQwenIncomplete) {
          candidate.status = 'partially_transcribed';
          candidate.qwenVerificationStatus = 'failed';
        } else if (provider === 'mathpix_qwen_verify' && candidate.status === 'candidate_ready') {
          candidate.qwenVerificationStatus = 'success';
        }

        // Attach Mathpix transcript & Qwen metadata from first successful page
        const firstSuccess = studentTasks.find((t) => t.status === 'success');
        if (firstSuccess) {
          candidate.mathpixTranscript = firstSuccess.mathpixRawTranscript;
          candidate.qwenVerifiedTranscript = firstSuccess.qwenVerifiedTranscript;
          candidate.qwenChanges = firstSuccess.qwenChanges;
          candidate.isDryRun = firstSuccess.isDryRun;
        }
        candidate.ocrMode = firstSuccess?.ocrMode || provider;

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
