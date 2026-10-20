import {
  StudentRosterItem,
  ScanPage,
  PageIdentityRecognition,
  IdentityMatchStatus,
  StudentMatchMapItem,
  MatchingPreviewResult,
} from '../types';

/**
 * Normalizes full-width characters (e.g. ３ -> 3, Ａ -> A) to half-width equivalents.
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[\uff01-\uff5e]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

/**
 * Normalizes Class String:
 * - Trims whitespace
 * - Converts full-width to half-width
 * - Removes internal spaces: '3 A' -> '3A'
 * - Uppercase: '3a' -> '3A'
 */
export function normalizeClass(val: string | null | undefined): string | null {
  if (!val) return null;
  const cleaned = toHalfWidth(val).trim().toUpperCase();
  const stripped = cleaned.replace(/\s+/g, '');
  if (!stripped || stripped === 'NULL' || stripped === 'UNREADABLE') {
    return null;
  }
  return stripped;
}

/**
 * Normalizes Class Number (seat number within class):
 * - Converts full-width digits to half-width
 * - Strips non-digit chars
 * - Parses to integer: '03' -> 3, '5' -> 5
 */
export function normalizeClassNumber(
  val: string | number | null | undefined
): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const cleaned = toHalfWidth(val).trim();
  const digits = cleaned.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normalizes Student Name:
 * - Converts full-width to half-width
 * - Collapses multiple spaces
 * - Lowercase comparison string
 * - Preserves readable characters
 */
export function normalizeStudentName(
  val: string | null | undefined
): string | null {
  if (!val) return null;
  const cleaned = toHalfWidth(val).trim();
  const collapsed = cleaned.replace(/\s+/g, ' ');
  if (!collapsed || collapsed.toLowerCase() === 'null' || collapsed.toLowerCase() === 'unreadable') {
    return null;
  }
  return collapsed.toLowerCase();
}

export interface CrossCheckInput {
  rawClass: string | null;
  rawStudentName: string | null;
  rawClassNumber: string | null;
  classReadable: boolean;
  nameReadable: boolean;
  numberReadable: boolean;
}

export interface CrossCheckOutput {
  status: IdentityMatchStatus;
  statusReason: string;
  matchedStudentId: string | null;
  candidateStudentIds: string[];
}

/**
 * Performs a rigorous 3-way cross-check against the teacher-selected class roster.
 *
 * Rules:
 * A. matched: All 3 items readable, consistent, and uniquely identify a single student.
 * B. needs_review: Exactly 2 items consistent, 1 unreadable. Candidate suggested, teacher confirmation needed.
 * C. conflict: Any explicit contradiction (Name points to A but Number to B, or Class != selectedClassId). No majority voting.
 * D. unmatched: Insufficient info, unreadable, or not found on roster.
 *
 * Invariants:
 * - Independent verification per page.
 * - Does not inherit from previous page.
 * - Does not assume sorted by student number.
 * - Scope strictly restricted to selectedClassId roster.
 */
export function crossCheckIdentity(
  input: CrossCheckInput,
  students: StudentRosterItem[],
  selectedClassId: string
): CrossCheckOutput {
  const normSelectedClass = normalizeClass(selectedClassId);
  const normClass = input.classReadable ? normalizeClass(input.rawClass) : null;
  const normName = input.nameReadable ? normalizeStudentName(input.rawStudentName) : null;
  const normNumber = input.numberReadable ? normalizeClassNumber(input.rawClassNumber) : null;

  // 1. Check Class Boundary
  if (normClass !== null) {
    if (normClass !== normSelectedClass) {
      return {
        status: 'conflict',
        statusReason: `班別辨識為「${input.rawClass}」，與目前選擇的班別「${selectedClassId}」不符，不予配對。`,
        matchedStudentId: null,
        candidateStudentIds: [],
      };
    }
  }

  const isClassMatch = normClass !== null && normClass === normSelectedClass;
  const isClassUnreadable = normClass === null;

  // 2. Look up matching students by Name and by Number
  const nameMatches = normName !== null
    ? students.filter((s) => normalizeStudentName(s.displayName) === normName)
    : [];

  const numberMatches = normNumber !== null
    ? students.filter((s) => s.classNumber === normNumber)
    : [];

  const isNameReadable = normName !== null;
  const isNumberReadable = normNumber !== null;

  // Scenario 1: Both Name and Number are readable
  if (isNameReadable && isNumberReadable) {
    if (nameMatches.length === 1 && numberMatches.length === 1) {
      if (nameMatches[0].id === numberMatches[0].id) {
        const student = nameMatches[0];
        if (isClassMatch) {
          // All 3 match!
          return {
            status: 'matched',
            statusReason: `班別 (${selectedClassId})、姓名 (${student.displayName}) 及學號 (#${student.classNumber}) 三項完全一致。`,
            matchedStudentId: student.id,
            candidateStudentIds: [student.id],
          };
        } else if (isClassUnreadable) {
          // Name + Number match, Class unreadable
          return {
            status: 'needs_review',
            statusReason: `姓名與學號均指向「${student.displayName} (#${student.classNumber})」，但班別辨識不清，需教師確認。`,
            matchedStudentId: null,
            candidateStudentIds: [student.id],
          };
        }
      } else {
        // Name points to Student A, but Number points to Student B -> CONFLICT!
        return {
          status: 'conflict',
          statusReason: `資料矛盾：姓名指向「${nameMatches[0].displayName}」，但學號指向「${numberMatches[0].displayName} (#${numberMatches[0].classNumber})」。不得採用二比一多數決。`,
          matchedStudentId: null,
          candidateStudentIds: [nameMatches[0].id, numberMatches[0].id],
        };
      }
    } else if (nameMatches.length === 1 && numberMatches.length === 0) {
      const student = nameMatches[0];
      return {
        status: 'conflict',
        statusReason: `姓名指向「${student.displayName}」，但讀到的學號「${input.rawClassNumber}」與其班內學號 (#${student.classNumber}) 不符。`,
        matchedStudentId: null,
        candidateStudentIds: [student.id],
      };
    } else if (numberMatches.length === 1 && nameMatches.length === 0) {
      const student = numberMatches[0];
      return {
        status: 'conflict',
        statusReason: `學號指向「${student.displayName} (#${student.classNumber})」，但讀到的姓名「${input.rawStudentName}」不符。`,
        matchedStudentId: null,
        candidateStudentIds: [student.id],
      };
    } else {
      return {
        status: 'unmatched',
        statusReason: `姓名「${input.rawStudentName}」與學號「${input.rawClassNumber}」均未在班級名單中找到對應學生。`,
        matchedStudentId: null,
        candidateStudentIds: [],
      };
    }
  }

  // Scenario 2: Name is readable, Number is unreadable
  if (isNameReadable && !isNumberReadable) {
    if (nameMatches.length === 1) {
      const student = nameMatches[0];
      if (isClassMatch) {
        // Class + Name match, Number unreadable -> needs_review
        return {
          status: 'needs_review',
          statusReason: `班別及姓名指向「${student.displayName} (#${student.classNumber})」，但學號未辨識清楚，需教師確認。`,
          matchedStudentId: null,
          candidateStudentIds: [student.id],
        };
      } else {
        return {
          status: 'unmatched',
          statusReason: `僅姓名可讀 (${student.displayName})，班別及學號均未確認，資料不足以自動配對。`,
          matchedStudentId: null,
          candidateStudentIds: [student.id],
        };
      }
    } else {
      return {
        status: 'unmatched',
        statusReason: `讀到姓名「${input.rawStudentName}」，但未能在班別名單中唯一確定學生。`,
        matchedStudentId: null,
        candidateStudentIds: [],
      };
    }
  }

  // Scenario 3: Number is readable, Name is unreadable
  if (!isNameReadable && isNumberReadable) {
    if (numberMatches.length === 1) {
      const student = numberMatches[0];
      if (isClassMatch) {
        // Class + Number match, Name unreadable -> needs_review
        return {
          status: 'needs_review',
          statusReason: `班別及學號指向「${student.displayName} (#${student.classNumber})」，但姓名未辨識清楚，需教師確認。`,
          matchedStudentId: null,
          candidateStudentIds: [student.id],
        };
      } else {
        return {
          status: 'unmatched',
          statusReason: `僅學號可讀 (#${student.classNumber})，班別及姓名均未確認，資料不足以自動配對。`,
          matchedStudentId: null,
          candidateStudentIds: [student.id],
        };
      }
    } else {
      return {
        status: 'unmatched',
        statusReason: `讀到學號「${input.rawClassNumber}」，但未在目前班別名單中找到該學號。`,
        matchedStudentId: null,
        candidateStudentIds: [],
      };
    }
  }

  // Scenario 4: Both Name and Number are unreadable
  return {
    status: 'unmatched',
    statusReason: '學生姓名及學號均無法辨識或未填寫。',
    matchedStudentId: null,
    candidateStudentIds: [],
  };
}

/**
 * Computes preview mapping and page counts for identity-based matching.
 * Groups non-consecutive pages for the same student while preserving original scan order.
 */
export function computeIdentityMatchingPreview(
  pages: ScanPage[],
  recognitions: Record<string, PageIdentityRecognition>,
  students: StudentRosterItem[]
): {
  preview: MatchingPreviewResult;
  studentPageCounts: number[];
  assignedStudentIndices: number[];
  unmatchedPagesCount: number;
} {
  const studentMap = new Map<string, { student: StudentRosterItem; index: number }>();
  students.forEach((s, idx) => {
    studentMap.set(s.id, { student: s, index: idx });
  });

  // Track which scan pages are assigned to each student ID (in original scan order)
  const studentAssignedPageIndices = new Map<string, number[]>();
  students.forEach((s) => studentAssignedPageIndices.set(s.id, []));

  const pageToStudentId: (string | null)[] = new Array(pages.length).fill(null);
  let unmatchedPagesCount = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const rec = recognitions[page.id];

    let effectiveStudentId: string | null = null;

    if (rec?.manualConfirmed && rec?.manualStudentId) {
      effectiveStudentId = rec.manualStudentId;
    } else if (rec?.status === 'matched' && rec?.matchedStudentId) {
      effectiveStudentId = rec.matchedStudentId;
    }

    if (effectiveStudentId && studentMap.has(effectiveStudentId)) {
      pageToStudentId[i] = effectiveStudentId;
      studentAssignedPageIndices.get(effectiveStudentId)!.push(i);
    } else {
      unmatchedPagesCount++;
    }
  }

  // Construct map matching preview
  const map: (StudentMatchMapItem | null)[] = new Array(pages.length).fill(null);
  const studentPageCounts = students.map((s) => {
    const assignedIndices = studentAssignedPageIndices.get(s.id) || [];
    const totalForStudent = assignedIndices.length;

    assignedIndices.forEach((pageIdx, partIndex) => {
      const studentInfo = studentMap.get(s.id)!;
      map[pageIdx] = {
        studentIndex: studentInfo.index,
        studentId: s.id,
        studentName: s.displayName,
        classNumber: s.classNumber,
        part: partIndex + 1,
        total: totalForStudent,
      };
    });

    return totalForStudent;
  });

  const assignedStudentIndices: number[] = [];
  studentPageCounts.forEach((count, idx) => {
    if (count > 0) assignedStudentIndices.push(idx);
  });

  const assignedPages = pages.length - unmatchedPagesCount;

  return {
    preview: {
      map,
      need: pages.length,
      assigned: assignedPages,
      extra: unmatchedPagesCount,
      missing: 0,
    },
    studentPageCounts,
    assignedStudentIndices,
    unmatchedPagesCount,
  };
}
