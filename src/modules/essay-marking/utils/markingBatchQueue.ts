import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  MarkingFinding,
  RubricDimension,
} from '../types';
import { EssayMarkingService } from '../services/essayServiceTypes';

export interface BatchMarkingItem {
  studentId: string;
  studentIndex: number;
  studentName: string;
  classNumber: number;
  pageCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'interrupted';
  transcriptText: string;
  findingsCount?: number;
  error?: string;
  skipReason?: string;
  completedAt?: string;
  isProvisional?: boolean;
}

export interface BatchMarkingEligibilityResult {
  items: BatchMarkingItem[];
  eligibleCount: number;
  toProcessCount: number;
  skippedCount: number;
  alreadyMarkedCount: number;
  unverifiedCount: number;
  emptyContentCount: number;
  provisionalCount: number;
}

export interface BatchMarkingQueueProgress {
  status: 'idle' | 'running' | 'stopping' | 'paused' | 'completed';
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  pendingItems: number;
  activeStudentId: string | null;
  activeStudentName: string | null;
  activePageCount: number | null;
  items: BatchMarkingItem[];
  stopRequested: boolean;
  pauseReason?: string;
  startedAt?: string;
  finishedAt?: string;
}

export const BATCH_STORAGE_KEY_PREFIX = 'essay_marking_batch_';

/**
 * Evaluates the eligibility of all students in current assignment following confirmed matched order.
 * Invariants:
 * - Confirmed matched student queue order (or fallback roster order).
 * - Multi-page essays include all assigned pages.
 * - Allows initial provisional AI marking of an applied, non-empty transcript before teacher verification.
 * - Blocks marking when text is empty or page count is 0.
 * - Skips already marked essays by default to protect existing findings.
 */
export function evaluateBatchMarkingEligibility({
  students,
  appliedMatching,
  transcripts,
  markings,
  pages,
  allowProvisional = true,
}: {
  students: StudentRosterItem[];
  appliedMatching: AppliedMatching;
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  pages: ScanPage[];
  allowProvisional?: boolean;
}): BatchMarkingEligibilityResult {
  const items: BatchMarkingItem[] = [];
  let eligibleCount = 0;
  let skippedCount = 0;
  let alreadyMarkedCount = 0;
  let unverifiedCount = 0;
  let emptyContentCount = 0;
  let provisionalCount = 0;

  const orderedStudentIndices =
    appliedMatching?.assignedStudentIndices && appliedMatching.assignedStudentIndices.length > 0
      ? appliedMatching.assignedStudentIndices
      : students.map((_, i) => i);

  orderedStudentIndices.forEach((studentIndex) => {
    const student = students[studentIndex];
    if (!student) return;
    // 1. Calculate assigned scan pages
    let pageCount = 0;
    if (appliedMatching && Array.isArray(appliedMatching.map)) {
      appliedMatching.map.forEach((item, pageIndex) => {
        if (item && item.studentIndex === studentIndex && pages[pageIndex]) {
          pageCount += 1;
        }
      });
    }

    const transcriptState = transcripts[student.id];
    const transcriptText = (transcriptState?.editedText || transcriptState?.rawOcrText || '').trim();
    const existingMarking = markings[student.id];
    const hasExistingFindings = (existingMarking?.findings?.length || 0) > 0;
    const isVerified = Boolean(transcriptState?.isVerified);

    let status: BatchMarkingItem['status'] = 'pending';
    let skipReason: string | undefined = undefined;
    let isProvisional = false;

    if (pageCount === 0) {
      status = 'skipped';
      skipReason = '尚未分配掃描頁面 (缺頁)';
      skippedCount++;
    } else if (!transcriptText) {
      status = 'skipped';
      skipReason = '謄本文字為空 (尚未辨識或輸入)';
      emptyContentCount++;
      skippedCount++;
    } else if (hasExistingFindings) {
      status = 'skipped';
      skipReason = `已有 ${existingMarking.findings.length} 條批改記錄 (預設跳過，避免覆蓋)`;
      alreadyMarkedCount++;
      skippedCount++;
    } else if (!isVerified && !allowProvisional) {
      status = 'skipped';
      skipReason = '謄本尚未在 Step 4 核對完成 (未核對)';
      unverifiedCount++;
      skippedCount++;
    } else {
      status = 'pending';
      eligibleCount++;
      if (!isVerified) {
        isProvisional = true;
        unverifiedCount++;
        provisionalCount++;
      }
    }

    items.push({
      studentId: student.id,
      studentIndex,
      studentName: student.displayName,
      classNumber: student.classNumber || studentIndex + 1,
      pageCount: pageCount || 1,
      status,
      transcriptText,
      findingsCount: hasExistingFindings ? existingMarking.findings.length : undefined,
      skipReason,
      isProvisional,
    });
  });

  return {
    items,
    eligibleCount,
    toProcessCount: eligibleCount,
    skippedCount,
    alreadyMarkedCount,
    unverifiedCount,
    emptyContentCount,
    provisionalCount,
  };
}

/**
 * Loads and rehydrates batch progress from localStorage.
 * If an item was previously marked as 'running', marks it as 'interrupted'
 * to avoid assuming success or blindly resending without teacher intent.
 */
export function loadPersistedBatchState(assignmentId: string): BatchMarkingQueueProgress | null {
  if (typeof window === 'undefined' || !assignmentId) return null;
  try {
    const raw = localStorage.getItem(`${BATCH_STORAGE_KEY_PREFIX}${assignmentId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as BatchMarkingQueueProgress;
    if (!data || !Array.isArray(data.items)) return null;

    // Check if interrupted on F5
    let hasInterrupted = false;
    const sanitizedItems = data.items.map((item) => {
      if (item.status === 'running') {
        hasInterrupted = true;
        return {
          ...item,
          status: 'interrupted' as const,
          error: '上次批次被中斷（如重新整理頁面），已停止處理，未自動重發。',
        };
      }
      return item;
    });

    const status = hasInterrupted || data.status === 'running' || data.status === 'stopping'
      ? 'paused'
      : data.status;

    return {
      ...data,
      status,
      items: sanitizedItems,
      activeStudentId: null,
      activeStudentName: null,
      activePageCount: null,
      stopRequested: false,
    };
  } catch (err) {
    console.warn('[BatchMarking] Failed to parse persisted batch state:', err);
    return null;
  }
}

/**
 * Persists batch progress immediately to localStorage.
 */
export function persistBatchState(assignmentId: string, state: BatchMarkingQueueProgress): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    localStorage.setItem(`${BATCH_STORAGE_KEY_PREFIX}${assignmentId}`, JSON.stringify(state));
  } catch (err) {
    console.warn('[BatchMarking] Failed to persist batch state:', err);
  }
}

/**
 * Clears batch progress from localStorage.
 */
export function clearPersistedBatchState(assignmentId: string): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    localStorage.removeItem(`${BATCH_STORAGE_KEY_PREFIX}${assignmentId}`);
  } catch (err) {
    console.warn('[BatchMarking] Failed to clear persisted batch state:', err);
  }
}
