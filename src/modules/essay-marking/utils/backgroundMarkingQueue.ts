import {
  RubricDimension,
  MarkingFinding,
  FindingDecision,
  PrimaryGrade,
  MarkingJobContext,
  computeRubricFingerprint,
  AppliedMatching,
  ScanPage,
  StudentRosterItem,
  AssignmentConfig,
  StudentTranscriptState,
  StagedCandidateTranscript,
  resolveEffectiveGrade,
} from '../types';
import { essayServices } from '../services/essayServiceRegistry';
import { MarkingPromptSnapshot } from '../services/essayServiceTypes';
import { computeStudentPageSignature } from './transcriptionBatchQueue';

export type AiMarkingFreshness =
  | 'initial_pending'
  | 'up_to_date'
  | 'needs_refresh'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface MarkingQueueJob {
  jobId: string;
  studentId: string;
  studentName: string;
  studentClassNumber?: number;
  yearLevel: PrimaryGrade;
  transcriptRevision: number;
  transcriptText: string;
  transcriptHash: string;
  assignmentTitle: string;
  scopePrompt: string;
  rubric: RubricDimension[];
  rubricFingerprint: string;
  promptSnapshot?: MarkingPromptSnapshot | null;
  contextIdentity?: MarkingJobContext;
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: 'normal' | 'high';
  error?: string;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface BackgroundMarkingQueueOptions {
  onJobStatusChange?: (studentId: string, freshness: AiMarkingFreshness, job?: MarkingQueueJob) => void;
  onJobCompleted?: (
    job: MarkingQueueJob,
    newAiFindings: MarkingFinding[],
    isCurrentRevision: boolean,
    assessment?: any
  ) => void;
  onJobFailed?: (job: MarkingQueueJob, error: string) => void;
  getCurrentRevision?: (studentId: string) => number;
}

/**
 * Controller for sequential background AI marking jobs.
 * Enforces:
 * 1. Exactly 1 request in flight at a time (protects local model on port 18086).
 * 2. Non-blocking UI operation (user can review/edit other students).
 * 3. Priority queue: High priority teacher re-marks run before waiting normal initial jobs.
 * 4. FIFO ordering within each priority level.
 * 5. Non-interrupting: Never aborts an active in-flight request.
 * 6. Waiting job deduplication: Replacing a waiting job retains or upgrades to highest priority.
 * 7. Race condition safety: compares job revision against current transcript revision on completion.
 * 8. Failure resilience: failed job does not block subsequent jobs in the queue.
 */
export class BackgroundMarkingQueueController {
  private queue: MarkingQueueJob[] = [];
  private activeJob: MarkingQueueJob | null = null;
  private isProcessing = false;
  private options: BackgroundMarkingQueueOptions;

  constructor(options: BackgroundMarkingQueueOptions = {}) {
    this.options = options;
  }

  public setOptions(options: Partial<BackgroundMarkingQueueOptions>) {
    this.options = { ...this.options, ...options };
  }

  public getQueue(): MarkingQueueJob[] {
    return [...this.queue];
  }

  public getActiveJob(): MarkingQueueJob | null {
    return this.activeJob ? { ...this.activeJob } : null;
  }

  public isBusy(): boolean {
    return this.isProcessing || this.activeJob !== null || this.queue.length > 0;
  }

  /**
   * Enqueue a marking job for a student.
   * If a job is already queued for this student, replace it with the latest revision and text.
   * Retains or sets priority ('high' > 'normal').
   */
  public enqueueJob(jobData: {
    studentId: string;
    studentName: string;
    studentClassNumber?: number;
    yearLevel?: PrimaryGrade;
    transcriptRevision: number;
    transcriptText: string;
    assignmentTitle: string;
    scopePrompt: string;
    rubric: RubricDimension[];
    promptSnapshot?: MarkingPromptSnapshot | null;
    priority?: 'normal' | 'high';
  }): MarkingQueueJob {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const rubricFingerprint = computeRubricFingerprint(jobData.rubric);
    const transcriptHash = jobData.transcriptText.trim();
    const effectiveYearLevel = jobData.yearLevel || 'P4';
    const contextIdentity: MarkingJobContext = {
      studentId: jobData.studentId,
      yearLevel: effectiveYearLevel,
      transcriptRevision: jobData.transcriptRevision,
      transcriptHash,
      assignmentTitle: jobData.assignmentTitle,
      scopePrompt: jobData.scopePrompt,
      rubricFingerprint,
      promptSnapshot: jobData.promptSnapshot
        ? {
            promptVersion: jobData.promptSnapshot.promptVersion,
            promptHash: jobData.promptSnapshot.promptHash,
          }
        : null,
    };

    const existingWaitingIndex = this.queue.findIndex((q) => q.studentId === jobData.studentId);
    let effectivePriority: 'normal' | 'high' = jobData.priority || 'normal';
    if (existingWaitingIndex !== -1) {
      if (this.queue[existingWaitingIndex].priority === 'high' && !jobData.priority) {
        effectivePriority = 'high';
      }
      this.queue.splice(existingWaitingIndex, 1);
    }

    const job: MarkingQueueJob = {
      ...jobData,
      yearLevel: effectiveYearLevel,
      priority: effectivePriority,
      jobId,
      transcriptHash,
      rubricFingerprint,
      contextIdentity,
      status: 'queued',
      queuedAt: Date.now(),
    };

    this.queue.push(job);

    this.options.onJobStatusChange?.(job.studentId, 'queued', job);

    // Kick off processing loop asynchronously
    this.processNext();

    return job;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.activeJob !== null) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    // High-priority jobs run first; FIFO within same priority
    const highIdx = this.queue.findIndex((j) => j.priority === 'high');
    const nextIdx = highIdx !== -1 ? highIdx : 0;
    const [nextJob] = this.queue.splice(nextIdx, 1);
    if (!nextJob) return;

    this.isProcessing = true;
    this.activeJob = nextJob;
    nextJob.status = 'running';
    nextJob.startedAt = Date.now();

    this.options.onJobStatusChange?.(nextJob.studentId, 'running', nextJob);

    try {
      const markingService = essayServices.getMarkingService();
      const res = await markingService.mark({
        transcript: nextJob.transcriptText,
        studentId: nextJob.studentId,
        assignmentTitle: nextJob.assignmentTitle,
        scopePrompt: nextJob.scopePrompt,
        rubric: nextJob.rubric,
        promptSnapshot: nextJob.promptSnapshot,
        yearLevel: nextJob.yearLevel,
      });

      nextJob.completedAt = Date.now();

      if (res.status === 'success') {
        nextJob.status = 'completed';

        // Check race condition: Is current transcript revision still the same as when job was queued?
        const currentRev = this.options.getCurrentRevision
          ? this.options.getCurrentRevision(nextJob.studentId)
          : nextJob.transcriptRevision;

        const isCurrentRevision = currentRev === nextJob.transcriptRevision;

        const newFindings: MarkingFinding[] = res.findings.map((f, idx) => ({
          id: `f-ai-${Date.now()}-${idx}`,
          type: f.type,
          feedbackType: f.feedbackType || 'correction',
          originalText: f.originalText,
          replacementText: f.replacementText,
          explanation: f.explanation,
          decision: 'pending',
          paragraphIndex: (f as any).paragraphIndex,
          lineIndex: (f as any).lineIndex,
          occurrenceIndex: (f as any).occurrenceIndex,
          promptVersion: (f as any).promptVersion || res.promptVersion,
          schemaVersion: (f as any).schemaVersion || res.schemaVersion,
          isManual: false,
          source: 'ai',
        }));

        this.options.onJobCompleted?.(nextJob, newFindings, isCurrentRevision, res.assessment);
        this.options.onJobStatusChange?.(
          nextJob.studentId,
          isCurrentRevision ? 'up_to_date' : 'needs_refresh',
          nextJob
        );
      } else {
        nextJob.status = 'failed';
        nextJob.error = res.message || 'Marking failed';
        this.options.onJobFailed?.(nextJob, nextJob.error);
        this.options.onJobStatusChange?.(nextJob.studentId, 'failed', nextJob);
      }
    } catch (err: any) {
      nextJob.status = 'failed';
      nextJob.error = err?.message || 'Connection to marking model failed';
      this.options.onJobFailed?.(nextJob, nextJob.error);
      this.options.onJobStatusChange?.(nextJob.studentId, 'failed', nextJob);
    } finally {
      this.activeJob = null;
      this.isProcessing = false;
      // Continue next job in queue immediately
      this.processNext();
    }
  }

  public clearQueue(): void {
    this.queue = [];
  }
}

export interface StudentAssignedPageItem {
  page: ScanPage;
  part: number;
  total: number;
  pageIndex: number;
}

export function getStudentAssignedPages(
  studentId: string,
  students: StudentRosterItem[],
  appliedMatching: AppliedMatching | null,
  pages: ScanPage[]
): StudentAssignedPageItem[] {
  if (!appliedMatching || !appliedMatching.map) return [];
  const sIdx = students.findIndex((s) => s.id === studentId);
  if (sIdx === -1) return [];

  const result: StudentAssignedPageItem[] = [];
  appliedMatching.map.forEach((item, pageIndex) => {
    if (item && item.studentIndex === sIdx && pages[pageIndex]) {
      result.push({
        page: pages[pageIndex],
        part: (item as any).partIndex || (item as any).part || result.length + 1,
        total: (item as any).totalParts || (item as any).total || 1,
        pageIndex,
      });
    }
  });
  return result;
}

export function isEffectiveTranscriptPresent(
  transcript?: StudentTranscriptState | null
): boolean {
  if (!transcript) return false;
  const effectiveText = (transcript.editedText ?? transcript.rawOcrText ?? '').trim();
  return effectiveText.length > 0;
}

/**
 * Context required to validate a restored (previously staged) candidate before
 * auto-import. Owns no state; purely a value object.
 */
export interface RestoredCandidateImportContext {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching | null;
  transcripts: Record<string, StudentTranscriptState>;
}

export type RestoredCandidateImportDecision =
  | { action: 'import' }
  | { action: 'keep_staged'; reason: string };

/**
 * Validates whether a restored candidate may be auto-imported. A candidate is
 * imported only when ALL of the following hold:
 *   1. Ownership: student exists and is still assigned pages.
 *   2. Existing text: no effective transcript already committed (never overwrite).
 *   3. Provenance: candidate.pageSignature matches the current page signature.
 *      The signature is compared, never rewritten, to prevent accepting a stale
 *      candidate by force.
 *   4. Page configuration: every required non-blank page succeeded, and the
 *      candidate's page set matches the current assignment (no foreign/missing).
 *   5. Non-empty transcript text.
 */
export function evaluateRestoredCandidateImport(
  studentId: string,
  candidate: StagedCandidateTranscript,
  context: RestoredCandidateImportContext
): RestoredCandidateImportDecision {
  // 1. Ownership
  const sIdx = context.students.findIndex((s) => s.id === studentId);
  if (sIdx === -1) {
    return { action: 'keep_staged', reason: '找不到學生資料' };
  }
  const assignedPages = getStudentAssignedPages(
    studentId,
    context.students,
    context.appliedMatching,
    context.pages
  );
  if (assignedPages.length === 0) {
    return { action: 'keep_staged', reason: '找不到該學生的掃描頁面分配' };
  }

  // 2. Existing teacher-edited/OCR text must not be silently overwritten.
  if (isEffectiveTranscriptPresent(context.transcripts[studentId])) {
    return { action: 'keep_staged', reason: '謄本已有文字，避免覆蓋教師編輯' };
  }

  // 3. Provenance / stale check. Compare only; never rewrite pageSignature.
  if (!context.appliedMatching) {
    return { action: 'keep_staged', reason: '缺少頁面配對資料' };
  }
  const currentSignature = computeStudentPageSignature(
    sIdx,
    context.appliedMatching,
    context.pages
  );
  if (candidate.pageSignature !== currentSignature) {
    return { action: 'keep_staged', reason: '候選文字已過時（頁面分配已變更）' };
  }

  // 4. Page configuration: required non-blank pages all succeeded and the
  //    candidate covers exactly the currently assigned pages.
  const requiredPages = assignedPages.filter((p) => !p.page.isBlank);
  for (const req of requiredPages) {
    const pr = candidate.pageResults?.find((p) => p.scanPageId === req.page.id);
    if (!pr || pr.status !== 'success') {
      return {
        action: 'keep_staged',
        reason: `尚有未完成的掃描頁面 (Page ${req.part} failed/pending)`,
      };
    }
  }
  const assignedIds = assignedPages.map((p) => p.page.id).sort();
  const candidateIds = (candidate.pageResults ?? []).map((pr) => pr.scanPageId).sort();
  if (assignedIds.join(',') !== candidateIds.join(',')) {
    return { action: 'keep_staged', reason: '候選頁面與學生分配頁面不一致' };
  }

  // 5. Non-empty transcript.
  if (!candidate.transcript?.trim()) {
    return { action: 'keep_staged', reason: '謄本文字為空' };
  }

  return { action: 'import' };
}

export interface ReconcileRestoredCandidatesResult {
  imported: string[];
  skipped: { studentId: string; reason: string }[];
}

/**
 * Idempotently reconciles restored staged candidates. Each candidate is processed
 * at most once (guarded by `reconciledIds` keyed on candidate.id), so repeated
 * invocations cannot cause duplicate imports, revision increments, or marking jobs.
 */
export function reconcileRestoredCandidates(
  stagedCandidates: Record<string, StagedCandidateTranscript>,
  context: RestoredCandidateImportContext,
  reconciledIds: Set<string>,
  onImport: (studentId: string, candidate: StagedCandidateTranscript) => void
): ReconcileRestoredCandidatesResult {
  const imported: string[] = [];
  const skipped: { studentId: string; reason: string }[] = [];

  Object.entries(stagedCandidates).forEach(([studentId, candidate]) => {
    if (reconciledIds.has(candidate.id)) {
      return;
    }
    const decision = evaluateRestoredCandidateImport(studentId, candidate, context);
    if (decision.action === 'keep_staged') {
      skipped.push({ studentId, reason: decision.reason });
      return;
    }
    reconciledIds.add(candidate.id);
    onImport(studentId, candidate);
    imported.push(studentId);
  });

  return { imported, skipped };
}

export interface MarkingReadinessContext {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching | null;
  transcripts: Record<string, StudentTranscriptState>;
  stagedCandidates?: Record<string, StagedCandidateTranscript>;
  assignment: AssignmentConfig;
}

export interface MarkingReadinessResult {
  ready: boolean;
  reason?: string;
  grade?: PrimaryGrade;
}

/**
 * Strict marking readiness evaluation:
 * A student is ready for AI marking if and only if all of the following hold:
 * 1. All required non-blank pages complete:
 *    Every page assigned to the student that is not marked isBlank has completed OCR successfully.
 *    Any pending or failed page blocks marking ("尚有未完成的掃描頁面 (Page X failed/pending)").
 * 2. No unapplied replacement candidate:
 *    stagedCandidates[studentId] must be empty or resolved. If a replacement candidate is staged,
 *    marking is blocked until applied or discarded ("有尚未確認套用的 OCR 候選文字").
 * 3. Non-empty effective transcript:
 *    Committed transcript text must be non-empty ("謄本文字為空").
 * 4. Assessment context valid:
 *    resolveEffectiveGrade resolves to a valid grade without conflict.
 */
export function checkStudentMarkingReadiness(
  studentId: string,
  context: MarkingReadinessContext
): MarkingReadinessResult {
  const student = context.students.find((s) => s.id === studentId);
  if (!student) {
    return { ready: false, reason: '找不到學生資料' };
  }

  // 1. Assessment context valid
  const gradeRes = resolveEffectiveGrade(context.assignment.grade, student.className);
  if (!gradeRes.grade || gradeRes.conflict) {
    return { ready: false, reason: gradeRes.error || '無法判斷學生年級或年級設定衝突' };
  }

  // 2. Derive assigned pages for this student
  const assignedPages = getStudentAssignedPages(
    studentId,
    context.students,
    context.appliedMatching,
    context.pages
  );
  const requiredPages = assignedPages.filter((p) => !p.page.isBlank);

  // 3. Staged candidate check
  const candidate = context.stagedCandidates?.[studentId];
  if (candidate) {
    // If there are required pages, check if any failed or is missing/pending in staged candidate
    if (requiredPages.length > 0) {
      for (const req of requiredPages) {
        const pr = candidate.pageResults?.find((p) => p.scanPageId === req.page.id);
        if (!pr || pr.status !== 'success') {
          return {
            ready: false,
            reason: `尚有未完成的掃描頁面 (Page ${req.part} failed/pending)`,
          };
        }
      }
    }
    // All pages in candidate succeeded, but it's an unapplied replacement!
    return {
      ready: false,
      reason: '有尚未確認套用的 OCR 候選文字',
    };
  }

  // 4. Committed transcript text check
  const transcript = context.transcripts[studentId];
  const effectiveText = (transcript?.editedText ?? transcript?.rawOcrText ?? '').trim();
  if (!effectiveText) {
    return { ready: false, reason: '謄本文字為空' };
  }

  // 5. If scans are assigned, ensure all required pages are completed
  if (requiredPages.length > 0 && !transcript.isManuallyEntered) {
    if (transcript.completedPageIds && transcript.completedPageIds.length > 0) {
      for (const req of requiredPages) {
        if (!transcript.completedPageIds.includes(req.page.id)) {
          return {
            ready: false,
            reason: `尚有未完成的掃描頁面 (Page ${req.part} failed/pending)`,
          };
        }
      }
    }
  }

  return {
    ready: true,
    grade: gradeRes.grade,
  };
}
