import {
  StudentRosterItem,
  MatchingPreviewResult,
  StudentMatchMapItem,
  AppliedMatching,
} from '../types';

/**
 * Calculates deterministic matching of scan pages to students in student-number order.
 * - Students with 0 pages are skipped without consuming a scan.
 * - Multi-page students consume consecutive scans.
 */
export function computeMatchingPreview(
  students: StudentRosterItem[],
  counts: number[],
  totalPages: number
): MatchingPreviewResult {
  const map: (StudentMatchMapItem | null)[] = [];
  let cursor = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const pageCount = counts[i] ?? 1;

    for (let p = 0; p < pageCount; p++) {
      if (cursor < totalPages) {
        map[cursor] = {
          studentIndex: i,
          studentId: student.id,
          studentName: student.displayName,
          classNumber: student.classNumber,
          part: p + 1,
          total: pageCount,
        };
      }
      cursor++;
    }
  }

  // Any remaining scan pages beyond cursor are unassigned
  for (let i = cursor; i < totalPages; i++) {
    map[i] = null;
  }

  const need = cursor;
  const assigned = Math.min(cursor, totalPages);
  const extra = Math.max(0, totalPages - cursor);
  const missing = Math.max(0, cursor - totalPages);

  return {
    map,
    need,
    assigned,
    extra,
    missing,
  };
}

/**
 * Determines whether the current student page counts match the applied matching snapshot.
 */
export function isMatchingDirty(
  applied: AppliedMatching | null,
  currentClassId: string,
  currentCounts: number[]
): boolean {
  if (!applied) return true;
  if (applied.classId !== currentClassId) return true;
  if (applied.counts.length !== currentCounts.length) return true;
  for (let i = 0; i < currentCounts.length; i++) {
    if (applied.counts[i] !== currentCounts[i]) return true;
  }
  return false;
}

/**
 * Applies bulk page count updates to selected students only.
 */
export function applyBulkPageCounts(
  currentCounts: number[],
  selectedIndices: Set<number>,
  newCount: number
): number[] {
  const clamped = Math.max(0, Math.min(100, Math.floor(newCount)));
  return currentCounts.map((count, index) =>
    selectedIndices.has(index) ? clamped : count
  );
}
