import {
  ScanPage,
  TemplateRegion,
  StudentRosterItem,
  AppliedMatching,
  StudentMatchMapItem,
  MatchingMode,
} from '../types';

export type PageReadinessState =
  | 'ready_blank'
  | 'ready_default'
  | 'ready_regions'
  | 'setup_incomplete';

export interface PageReadiness {
  state: PageReadinessState;
  isReady: boolean;
  requiresRegions: boolean;
  message?: string;
}

/**
 * Evaluates the readiness of a single page:
 * - Pages 1-2:
 *   - Blank checked: skip OCR (ready_blank).
 *   - Blank unchecked: retain existing OCR behavior (ready_default).
 * - Page 3 onward (continuation page):
 *   - Blank checked: ready without regions; skip OCR (ready_blank).
 *   - Blank unchecked with valid saved regions: ready for region-based OCR (ready_regions).
 *   - Blank unchecked without valid saved regions: setup incomplete (setup_incomplete).
 */
export function evaluatePageReadiness(
  page: ScanPage,
  part: number
): PageReadiness {
  if (page.isBlank) {
    return {
      state: 'ready_blank',
      status: 'blank_skipped',
      isReady: true,
      requiresRegions: false,
      message: 'Blank page (OCR skipped)',
    };
  }

  if (part <= 2) {
    return {
      state: 'ready_default',
      status: 'ready_default',
      isReady: true,
      requiresRegions: false,
      message: 'Standard worksheet page',
    };
  }

  // Page 3 onward: continuation page requiring custom writing regions
  const writingRegions = Array.isArray(page.customRegions)
    ? page.customRegions.filter((r) => r && (r.type === 'writing_area' || !r.type))
    : [];

  const hasValidRegions =
    writingRegions.length > 0 &&
    writingRegions.every(
      (r) =>
        typeof r.x === 'number' &&
        typeof r.y === 'number' &&
        typeof r.width === 'number' &&
        typeof r.height === 'number' &&
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        Number.isFinite(r.width) &&
        Number.isFinite(r.height) &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.width > 0 &&
        r.height > 0
    );

  if (hasValidRegions) {
    return {
      state: 'ready_regions',
      status: 'ready_custom_regions',
      isReady: true,
      requiresRegions: true,
      message: `${writingRegions.length} custom region(s) configured`,
    };
  }

  return {
    state: 'setup_incomplete',
    status: 'needs_custom_regions',
    isReady: false,
    requiresRegions: true,
    message: 'Setup required: custom OCR regions required for continuation page',
  };
}

export interface IncompleteContinuationPage {
  studentId: string;
  studentName: string;
  classNumber: number;
  part: number;
  scanPageId: string;
  pageFileName: string;
}

/**
 * Checks all assigned pages across students and returns any non-blank continuation
 * pages that still require custom OCR regions.
 */
export function evaluateStudentMatchingReadiness(
  students: StudentRosterItem[],
  pages: ScanPage[],
  appliedMatching: AppliedMatching | null
): {
  isReady: boolean;
  isAllReady: boolean;
  incompletePages: IncompleteContinuationPage[];
  incompleteContinuationPages: IncompleteContinuationPage[];
} {
  if (!appliedMatching) {
    return {
      isReady: true,
      isAllReady: true,
      incompletePages: [],
      incompleteContinuationPages: [],
    };
  }

  const pageMap = new Map<string, ScanPage>();
  pages.forEach((p) => pageMap.set(p.id, p));

  const incompletePages: IncompleteContinuationPage[] = [];

  if (Array.isArray(appliedMatching.map) && appliedMatching.map.length > 0) {
    appliedMatching.map.forEach((item, pageIndex) => {
      if (!item) return;
      const page = pages[pageIndex];
      if (!page) return;

      if (item.part >= 3) {
        const readiness = evaluatePageReadiness(page, item.part);
        if (!readiness.isReady) {
          incompletePages.push({
            studentId: item.studentId,
            studentName: item.studentName,
            classNumber: item.classNumber,
            part: item.part,
            scanPageId: page.id,
            pageFileName: page.fileName,
          });
        }
      }
    });
  } else if (appliedMatching.studentPageOrders) {
    const studentMap = new Map<string, StudentRosterItem>();
    students.forEach((s) => studentMap.set(s.id, s));

    Object.entries(appliedMatching.studentPageOrders).forEach(([studentId, pageIds]) => {
      const student = studentMap.get(studentId);
      pageIds.forEach((pId, idx) => {
        const part = idx + 1;
        if (part >= 3) {
          const page = pageMap.get(pId);
          if (page) {
            const readiness = evaluatePageReadiness(page, part);
            if (!readiness.isReady) {
              incompletePages.push({
                studentId,
                studentName: student?.displayName || studentId,
                classNumber: student?.classNumber || 0,
                part,
                scanPageId: page.id,
                pageFileName: page.fileName,
              });
            }
          }
        }
      });
    });
  }

  const isReady = incompletePages.length === 0;
  return {
    isReady,
    isAllReady: isReady,
    incompletePages,
    incompleteContinuationPages: incompletePages,
  };
}

/**
 * Checks if all assigned pages for a student are marked as blank.
 */
export function isEntireScriptBlank(
  pages: ScanPage[],
  studentPageIds: string[]
): boolean {
  if (!studentPageIds || studentPageIds.length === 0) return false;
  const pageMap = new Map<string, ScanPage>();
  pages.forEach((p) => pageMap.set(p.id, p));

  return studentPageIds.every((id) => {
    const page = pageMap.get(id);
    return Boolean(page?.isBlank);
  });
}

/**
 * Derives studentPageOrders from an existing AppliedMatching or sequential mapping.
 */
export function deriveStudentPageOrdersFromMatching(
  applied: AppliedMatching | null,
  pages: ScanPage[]
): Record<string, string[]> {
  const orders: Record<string, string[]> = {};
  if (!applied || !Array.isArray(applied.map)) return orders;

  // Gather pages per student
  const studentPagesWithParts: Record<string, Array<{ pageId: string; part: number }>> = {};

  applied.map.forEach((item, pageIndex) => {
    if (item && pages[pageIndex]) {
      if (!studentPagesWithParts[item.studentId]) {
        studentPagesWithParts[item.studentId] = [];
      }
      studentPagesWithParts[item.studentId].push({
        pageId: pages[pageIndex].id,
        part: item.part,
      });
    }
  });

  Object.entries(studentPagesWithParts).forEach(([studentId, list]) => {
    list.sort((a, b) => a.part - b.part);
    orders[studentId] = list.map((item) => item.pageId);
  });

  return orders;
}

/**
 * Reorders pages internally for a specific student without shifting any other student's pages.
 */
export function reorderStudentPages<T extends AppliedMatching | Record<string, string[]>>(
  matchingOrOrders: T,
  studentId: string,
  fromIndex: number,
  toIndex: number
): T {
  const isAppliedMatching = Boolean(matchingOrOrders && typeof matchingOrOrders === 'object' && 'studentPageOrders' in matchingOrOrders);
  const currentOrders: Record<string, string[]> = isAppliedMatching
    ? { ...((matchingOrOrders as AppliedMatching).studentPageOrders || {}) }
    : { ...((matchingOrOrders as Record<string, string[]>) || {}) };

  const list = currentOrders[studentId] ? [...currentOrders[studentId]] : [];
  if (fromIndex >= 0 && fromIndex < list.length && toIndex >= 0 && toIndex < list.length) {
    const [removed] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, removed);
    currentOrders[studentId] = list;
  }

  if (isAppliedMatching) {
    return {
      ...(matchingOrOrders as AppliedMatching),
      studentPageOrders: currentOrders,
    } as T;
  }
  return currentOrders as T;
}

/**
 * Assigns a scan page to a student (e.g. as a continuation page or new page).
 * Removes that scan page from any previous student if it was previously assigned,
 * preserving all other assignments without shifting other students.
 */
export function assignPageToStudent<T extends AppliedMatching | Record<string, string[]>>(
  matchingOrOrders: T,
  studentId: string,
  scanPageId: string,
  atIndex?: number
): T {
  const isAppliedMatching = Boolean(matchingOrOrders && typeof matchingOrOrders === 'object' && 'studentPageOrders' in matchingOrOrders);
  const rawOrders = isAppliedMatching
    ? (matchingOrOrders as AppliedMatching).studentPageOrders || {}
    : (matchingOrOrders as Record<string, string[]>) || {};

  const newOrders: Record<string, string[]> = {};
  Object.entries(rawOrders).forEach(([sId, pageIds]) => {
    newOrders[sId] = Array.isArray(pageIds) ? pageIds.filter((id) => id !== scanPageId) : [];
  });

  const studentPages = newOrders[studentId] ? [...newOrders[studentId]] : [];
  if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= studentPages.length) {
    studentPages.splice(atIndex, 0, scanPageId);
  } else {
    studentPages.push(scanPageId);
  }
  newOrders[studentId] = studentPages;

  if (isAppliedMatching) {
    return {
      ...(matchingOrOrders as AppliedMatching),
      studentPageOrders: newOrders,
    } as T;
  }
  return newOrders as T;
}

/**
 * Unassigns a scan page from a student without affecting other students.
 */
export function unassignPageFromStudent<T extends AppliedMatching | Record<string, string[]>>(
  matchingOrOrders: T,
  studentId: string,
  scanPageId: string
): T {
  const isAppliedMatching = Boolean(matchingOrOrders && typeof matchingOrOrders === 'object' && 'studentPageOrders' in matchingOrOrders);
  const rawOrders = isAppliedMatching
    ? (matchingOrOrders as AppliedMatching).studentPageOrders || {}
    : (matchingOrOrders as Record<string, string[]>) || {};

  const newOrders: Record<string, string[]> = {};
  Object.entries(rawOrders).forEach(([sId, pageIds]) => {
    newOrders[sId] = Array.isArray(pageIds) ? pageIds.filter((id) => id !== scanPageId) : [];
  });

  if (isAppliedMatching) {
    return {
      ...(matchingOrOrders as AppliedMatching),
      studentPageOrders: newOrders,
    } as T;
  }
  return newOrders as T;
}

/**
 * Constructs an AppliedMatching from studentPageOrders.
 * - Each scan page is mapped to its assigned student, with part (1-indexed internal position) and total.
 * - Pages not in any student's order are null (unassigned).
 * - Subsequent students never shift when another student's page count or page order changes.
 */
export function recomputeMatchingFromOrders(
  students: StudentRosterItem[],
  pages: ScanPage[],
  studentPageOrders: Record<string, string[]>,
  classId: string,
  mode: MatchingMode = 'recognition'
): AppliedMatching {
  const studentMap = new Map<string, { student: StudentRosterItem; index: number }>();
  students.forEach((s, idx) => {
    studentMap.set(s.id, { student: s, index: idx });
  });

  const pageToAssignment = new Map<string, { studentId: string; part: number; total: number }>();

  Object.entries(studentPageOrders).forEach(([studentId, pageIds]) => {
    const total = pageIds.length;
    pageIds.forEach((pageId, partIndex) => {
      pageToAssignment.set(pageId, {
        studentId,
        part: partIndex + 1,
        total,
      });
    });
  });

  const map: (StudentMatchMapItem | null)[] = pages.map((page) => {
    const assignment = pageToAssignment.get(page.id);
    if (!assignment) return null;

    const studentInfo = studentMap.get(assignment.studentId);
    if (!studentInfo) return null;

    return {
      studentIndex: studentInfo.index,
      studentId: studentInfo.student.id,
      studentName: studentInfo.student.displayName,
      classNumber: studentInfo.student.classNumber,
      part: assignment.part,
      total: assignment.total,
    };
  });

  const counts = students.map((s) => {
    return (studentPageOrders[s.id] || []).length;
  });

  // Extract unique assigned student indices in the order their pages appear in the scan set
  const assignedStudentIndices: number[] = [];
  const seenIndices = new Set<number>();
  map.forEach((item) => {
    if (item && !seenIndices.has(item.studentIndex)) {
      seenIndices.add(item.studentIndex);
      assignedStudentIndices.push(item.studentIndex);
    }
  });

  return {
    classId,
    counts,
    map,
    assignedStudentIndices,
    mode,
    studentPageOrders,
  };
}

/**
 * Normalizes region reading order: sorts regions by orderIndex,
 * reassigns 1..N orderIndex sequentially.
 */
export function normalizeRegionReadingOrder(regions: TemplateRegion[]): TemplateRegion[] {
  if (!Array.isArray(regions) || regions.length === 0) return [];

  const copy = [...regions];
  copy.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return copy.map((r, idx) => ({
    ...r,
    orderIndex: idx,
  }));
}
