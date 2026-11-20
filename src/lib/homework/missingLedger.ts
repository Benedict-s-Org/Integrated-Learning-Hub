import { getHKTodayString } from '@/utils/dateUtils';

export const HOMEWORK_SUBJECT_ORDER = ['中文', '英文', '數學', '常識', '其他'];

export function formatLedgerStudentLabel(classNumber: number, name: string): string {
  const display = (name || '').trim() || 'Unknown';
  if (!Number.isFinite(classNumber) || classNumber <= 0) return display;
  return `${classNumber} ${display}`;
}

function dayDistance(isoA: string, isoB: string): number {
  const [ay, am, ad] = isoA.split('-').map(Number);
  const [by, bm, bd] = isoB.split('-').map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000));
}

export type MissingLogInput = {
  id: string;
  logDate: string;
  className: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  missingItems: Record<string, string[]>;
};

export type HomeworkMark = 'missing' | 'unclicked' | 'absent' | 'exempt';

export type LedgerStudent = {
  logId: string;
  studentId: string;
  name: string;
  className: string;
  classNumber: number;
  submitted: boolean;
  /** Duty mark layered on for display. Absent / unclicked / exempt come from morning-duty status. */
  mark?: HomeworkMark;
};

export type LedgerItem = {
  subject: string;
  item: string;
  detail: string;
  students: LedgerStudent[];
  complete: boolean;
};

export type LedgerDateGroup = {
  date: string;
  items: LedgerItem[];
  complete: boolean;
};

export type DetailLookup = (args: {
  date: string;
  className: string;
  subject: string;
  item: string;
}) => string;

/** Keep incomplete items only, nearest calendar date to today first. */
export function openLedgerColumns(groups: LedgerDateGroup[], todayIso: string = getHKTodayString()): LedgerDateGroup[] {
  return groups
    .map((group) => {
      const items = group.items.filter((item) => !item.complete);
      return { ...group, items, complete: false };
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      const distanceDiff = dayDistance(a.date, todayIso) - dayDistance(b.date, todayIso);
      if (distanceDiff !== 0) return distanceDiff;
      return a.date.localeCompare(b.date);
    });
}

export function makeupKey(logId: string, subject: string, item: string): string {
  return `${logId}::${subject}::${item}`;
}

function subjectRank(subject: string): number {
  const index = HOMEWORK_SUBJECT_ORDER.indexOf(subject);
  return index === -1 ? HOMEWORK_SUBJECT_ORDER.length : index;
}

function uniqueDetail(details: string[]): string {
  const filled = [...new Set(details.map((detail) => detail.trim()).filter(Boolean))];
  if (filled.length === 0) return '';
  if (filled.length === 1) return filled[0];
  return filled.join(' / ');
}

export function buildMissingLedger(
  logs: MissingLogInput[],
  madeUpKeys: ReadonlySet<string>,
  detailLookup: DetailLookup = () => '',
  todayIso: string = getHKTodayString(),
): LedgerDateGroup[] {
  type Bucket = {
    subject: string;
    item: string;
    students: LedgerStudent[];
    details: string[];
  };
  const byDate = new Map<string, Map<string, Bucket>>();

  for (const log of logs) {
    const subjects = log.missingItems || {};
    for (const [subject, items] of Object.entries(subjects)) {
      if (!Array.isArray(items)) continue;
      for (const rawItem of items) {
        const item = typeof rawItem === 'string' ? rawItem.trim() : '';
        if (!item) continue;
        const dateBuckets = byDate.get(log.logDate) ?? new Map<string, Bucket>();
        byDate.set(log.logDate, dateBuckets);
        const itemKey = `${subject}\0${item}`;
        const bucket = dateBuckets.get(itemKey) ?? {
          subject,
          item,
          students: [],
          details: [],
        };
        bucket.details.push(detailLookup({
          date: log.logDate,
          className: log.className,
          subject,
          item,
        }));
        if (bucket.students.some((student) => student.studentId === log.studentId)) {
          dateBuckets.set(itemKey, bucket);
          continue;
        }
        bucket.students.push({
          logId: log.id,
          studentId: log.studentId,
          name: log.studentName || 'Unknown',
          className: log.className,
          classNumber: Number.isFinite(log.classNumber) ? log.classNumber : 0,
          submitted: madeUpKeys.has(makeupKey(log.id, subject, item)),
        });
        dateBuckets.set(itemKey, bucket);
      }
    }
  }

  const groups: LedgerDateGroup[] = [];
  for (const [date, buckets] of byDate) {
    const items: LedgerItem[] = [...buckets.values()].map((bucket) => {
      const students = [...bucket.students].sort((a, b) => {
        if (a.className !== b.className) return a.className.localeCompare(b.className);
        if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
        return a.name.localeCompare(b.name);
      });
      return {
        subject: bucket.subject,
        item: bucket.item,
        detail: uniqueDetail(bucket.details),
        students,
        complete: students.length > 0 && students.every((student) => student.submitted),
      };
    }).sort((a, b) => {
      const subjectDiff = subjectRank(a.subject) - subjectRank(b.subject);
      if (subjectDiff !== 0) return subjectDiff;
      return a.item.localeCompare(b.item);
    });

    const openItems = items.filter((item) => !item.complete);
    if (openItems.length === 0) continue;
    groups.push({
      date,
      items: openItems,
      complete: false,
    });
  }

  return openLedgerColumns(groups, todayIso);
}

export type HandedInRosterEntry = {
  className: string;
  date: string;
  subject: string;
  item: string;
  studentId: string;
  name: string;
  classNumber: number;
};

/** Classmates who already handed an item in still belong on that item's bottom row. */
export function attachHandedInClassmates(
  groups: LedgerDateGroup[],
  roster: HandedInRosterEntry[],
): LedgerDateGroup[] {
  return groups.map((group) => {
    const items = group.items.map((item) => {
      const students = [...item.students];
      for (const entry of roster) {
        if (entry.date !== group.date || entry.subject !== item.subject || entry.item !== item.item) continue;
        if (students.some((student) => student.studentId === entry.studentId)) continue;
        students.push({
          logId: englishCheckLogId(entry.studentId, entry.date),
          studentId: entry.studentId,
          name: entry.name || 'Unknown',
          className: entry.className,
          classNumber: entry.classNumber,
          submitted: true,
        });
      }
      students.sort((a, b) => {
        if (a.className !== b.className) return a.className.localeCompare(b.className);
        if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
        return a.name.localeCompare(b.name);
      });
      return {
        ...item,
        students,
        complete: students.length > 0 && students.every((student) => student.submitted),
      };
    });
    return {
      ...group,
      items,
      complete: items.length > 0 && items.every((item) => item.complete),
    };
  });
}

export function formatAnnouncementDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('en-HK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export type MissingAnnouncementBlock = {
  date: string;
  isoDate: string;
  lines: string[];
};

/** Open missing homework only, as "Date" then "Homework item: Student 1, Student 2". */
export function openMissingAnnouncement(groups: LedgerDateGroup[]): MissingAnnouncementBlock[] {
  return groups
    .filter((group) => !group.complete)
    .map((group) => ({
      isoDate: group.date,
      date: formatAnnouncementDate(group.date),
      lines: group.items.flatMap((item) => {
        const names = item.students
          .filter((student) => !student.submitted)
          .map((student) => formatLedgerStudentLabel(student.classNumber, student.name));
        if (names.length === 0) return [];
        const label = [item.subject, item.item, item.detail].filter(Boolean).join(' · ');
        return [`${label}: ${names.join(', ')}`];
      }),
    }))
    .filter((block) => block.lines.length > 0);
}

export function formatMissingAnnouncement(block: MissingAnnouncementBlock): string {
  return [block.date, ...block.lines].join('\n');
}

export type EnglishMark = {
  className: string;
  date: string;
  subject: string;
  item: string;
  studentId: string;
  handedIn: boolean;
  isLate?: boolean;
};

export type ClassStudent = {
  id: string;
  name: string;
  className: string;
  classNumber: number;
};

export function englishCheckLogId(studentId: string, date: string): string {
  return `english|${studentId}|${date}`;
}

export function parseEnglishCheckLogId(id: string): { studentId: string; date: string } | null {
  if (!id.startsWith('english|')) return null;
  const [, studentId, date] = id.split('|');
  if (!studentId || !date) return null;
  return { studentId, date };
}

export function handedInKey(studentId: string, date: string, subject: string, item: string): string {
  return `${studentId}\0${date}\0${subject}\0${item}`;
}

/** A Handed in tick counts as submitted on a morning-duty row for the same student and item. */
export function submittedKeysWithHandedIn(
  logs: MissingLogInput[],
  madeUpKeys: ReadonlySet<string>,
  handedInKeys: ReadonlySet<string>,
): Set<string> {
  const next = new Set(madeUpKeys);
  for (const log of logs) {
    if (parseEnglishCheckLogId(log.id)) continue;
    for (const [subject, items] of Object.entries(log.missingItems || {})) {
      if (!Array.isArray(items)) continue;
      for (const rawItem of items) {
        const item = typeof rawItem === 'string' ? rawItem.trim() : '';
        if (!item) continue;
        if (handedInKeys.has(handedInKey(log.studentId, log.logDate, subject, item))) {
          next.add(makeupKey(log.id, subject, item));
        }
      }
    }
  }
  return next;
}

/**
 * After a teacher ticks Handed in for an item, every classmate without that tick
 * is missing that item. Items with no ticks at all stay off the list.
 */
export function missingLogsFromEnglishMarks(
  students: ClassStudent[],
  marks: EnglishMark[],
): MissingLogInput[] {
  type Group = {
    className: string;
    date: string;
    subject: string;
    item: string;
    handedIn: Set<string>;
  };
  const groups = new Map<string, Group>();
  for (const mark of marks) {
    const className = mark.className.trim();
    const item = mark.item.trim();
    if (!className || !mark.date || !mark.subject || !item || !mark.studentId) continue;
    const key = `${className}\0${mark.date}\0${mark.subject}\0${item}`;
    const group = groups.get(key) ?? {
      className,
      date: mark.date,
      subject: mark.subject,
      item,
      handedIn: new Set<string>(),
    };
    if (mark.handedIn) group.handedIn.add(mark.studentId);
    groups.set(key, group);
  }

  const byStudentDate = new Map<string, MissingLogInput>();
  for (const group of groups.values()) {
    for (const student of students) {
      if (student.className !== group.className) continue;
      if (group.handedIn.has(student.id)) continue;
      const key = `${student.id}|${group.date}`;
      const log = byStudentDate.get(key) ?? {
        id: englishCheckLogId(student.id, group.date),
        logDate: group.date,
        className: student.className,
        studentId: student.id,
        studentName: student.name || 'Unknown',
        classNumber: Number.isFinite(student.classNumber) ? student.classNumber : 0,
        missingItems: {},
      };
      const items = log.missingItems[group.subject] ?? [];
      if (!items.includes(group.item)) items.push(group.item);
      log.missingItems[group.subject] = items;
      byStudentDate.set(key, log);
    }
  }
  return [...byStudentDate.values()];
}

export function isTestUsername(username: string | null | undefined): boolean {
  return (username ?? '').toLowerCase().includes('test');
}

export function classifyHomeworkMark(input: {
  dutyStatus?: string | null;
  inMissingItems: boolean;
  handedIn: boolean;
}): HomeworkMark | 'hidden' {
  const status = (input.dutyStatus || '').trim().toLowerCase();
  if (status === 'absent') return 'absent';
  if (status === 'exempted' || status === 'exempt') return 'exempt';
  // Makeup / 交齊 ticks must win: teacher can clear a row in Missing even while duty still says 欠.
  if (input.handedIn || status === 'submitted' || status === 'late') return 'hidden';
  if (input.inMissingItems) return 'missing';
  if (!status || status === 'todo') return 'unclicked';
  return 'hidden';
}

export function dutyStudentDateKey(studentId: string, date: string): string {
  return `${studentId}\0${date}`;
}

/** Students marked submitted/late on morning duties should leave the Missing list for that day. */
export function collectClearedDutyKeys(
  duties: Array<{ studentId: string; date: string; status?: string | null }>,
): Set<string> {
  const next = new Set<string>();
  for (const duty of duties) {
    const status = (duty.status || '').trim().toLowerCase();
    if (status === 'submitted' || status === 'late') {
      next.add(dutyStudentDateKey(duty.studentId, duty.date));
    }
  }
  return next;
}

/** Drop missing-item rows for students who already handed everything in that day. */
export function clearMissingItemsForSubmittedDuties(
  logs: MissingLogInput[],
  clearedDutyKeys: ReadonlySet<string>,
): MissingLogInput[] {
  if (clearedDutyKeys.size === 0) return logs;
  return logs
    .map((log) => {
      if (!clearedDutyKeys.has(dutyStudentDateKey(log.studentId, log.logDate))) return log;
      return { ...log, missingItems: {} };
    })
    .filter((log) => Object.keys(log.missingItems || {}).length > 0);
}

export type DutySnapshot = {
  studentId: string;
  date: string;
  status?: string | null;
  missingItems?: Record<string, string[]> | null;
  logId: string;
};

/**
 * Ledger columns must prefer an explicit morning-duty 欠 list over English
 * classmate inference. Without this, a student missing one item appears under
 * every item classmates already handed in.
 */
export function combineDutyAndEnglishMissingLogs(
  dutyLogs: MissingLogInput[],
  englishLogs: MissingLogInput[],
  dutyDays: Array<{ studentId: string; date: string; status?: string | null }> = [],
): MissingLogInput[] {
  const preferDuty = new Set<string>();
  for (const duty of dutyDays) {
    const status = (duty.status || '').trim().toLowerCase();
    if (status === 'missing') {
      preferDuty.add(dutyStudentDateKey(duty.studentId, duty.date));
    }
  }
  for (const log of dutyLogs) {
    preferDuty.add(dutyStudentDateKey(log.studentId, log.logDate));
  }
  const filteredEnglish = englishLogs.filter(
    (log) => !preferDuty.has(dutyStudentDateKey(log.studentId, log.logDate)),
  );
  return [...dutyLogs, ...filteredEnglish];
}

/** Merge English (or other) missing-item logs into morning-duty snapshots so appearances match the columns. */
export function mergeDutyMissingItems(
  duties: DutySnapshot[],
  extra: Array<{
    studentId: string;
    date: string;
    missingItems?: Record<string, string[]> | null;
    logId: string;
  }>,
): DutySnapshot[] {
  const map = new Map<string, DutySnapshot>();
  for (const duty of duties) {
    map.set(`${duty.studentId}\0${duty.date}`, {
      ...duty,
      missingItems: { ...(duty.missingItems || {}) },
    });
  }
  for (const row of extra) {
    const key = `${row.studentId}\0${row.date}`;
    const existing = map.get(key);
    const incoming = row.missingItems || {};
    if (!existing) {
      map.set(key, {
        studentId: row.studentId,
        date: row.date,
        status: 'missing',
        missingItems: { ...incoming },
        logId: row.logId,
      });
      continue;
    }
    const status = (existing.status || '').trim().toLowerCase();
    // 交齊 / late: never attach inferred English missing onto a cleared day.
    if (status === 'submitted' || status === 'late') continue;
    // An explicit 欠 day (even after makeup emptied missing_items) must not be
    // reinflated with classmate-inferred English items.
    if (status === 'missing') continue;

    const explicit = existing.missingItems || {};
    const merged = { ...explicit };
    for (const [subject, items] of Object.entries(incoming)) {
      if (!Array.isArray(items)) continue;
      const bucket = new Set((merged[subject] || []).map((item) => item.trim()).filter(Boolean));
      for (const item of items) {
        const trimmed = typeof item === 'string' ? item.trim() : '';
        if (trimmed) bucket.add(trimmed);
      }
      merged[subject] = [...bucket];
    }
    map.set(key, { ...existing, missingItems: merged });
  }
  return [...map.values()];
}

export type ListedWork = {
  date: string;
  className: string;
  subject: string;
  item: string;
};

export type HomeworkAppearance = {
  date: string;
  className: string;
  subject: string;
  item: string;
  studentId: string;
  name: string;
  classNumber: number;
  mark: HomeworkMark;
  logId: string;
  submitted: boolean;
};

export function listHomeworkAppearances(
  students: Array<ClassStudent & { username?: string | null }>,
  duties: DutySnapshot[],
  listed: ListedWork[],
  handedInKeys: ReadonlySet<string>,
  madeUpKeys: ReadonlySet<string>,
): HomeworkAppearance[] {
  const roster = students.filter((student) => !isTestUsername(student.username));
  const dutyByStudentDate = new Map<string, DutySnapshot>();
  const itemKeys = new Map<string, ListedWork>();
  for (const item of listed) {
    const subject = item.subject.trim();
    const name = item.item.trim();
    const className = item.className.trim();
    if (!subject || !name || !className || !item.date) continue;
    itemKeys.set(`${className}\0${item.date}\0${subject}\0${name}`, {
      ...item,
      className,
      subject,
      item: name,
    });
  }
  for (const duty of duties) {
    dutyByStudentDate.set(`${duty.studentId}\0${duty.date}`, duty);
    const student = roster.find((person) => person.id === duty.studentId);
    if (!student) continue;
    for (const [subject, items] of Object.entries(duty.missingItems || {})) {
      if (!Array.isArray(items)) continue;
      for (const rawItem of items) {
        const item = typeof rawItem === 'string' ? rawItem.trim() : '';
        if (!item) continue;
        itemKeys.set(`${student.className}\0${duty.date}\0${subject}\0${item}`, {
          date: duty.date,
          className: student.className,
          subject,
          item,
        });
      }
    }
  }

  const appearances: HomeworkAppearance[] = [];
  for (const item of itemKeys.values()) {
    for (const student of roster) {
      if (student.className !== item.className) continue;
      const duty = dutyByStudentDate.get(`${student.id}\0${item.date}`);
      const names = duty?.missingItems?.[item.subject];
      const inMissingItems = Array.isArray(names) && names.some((name) => name.trim() === item.item);
      const handedIn = handedInKeys.has(handedInKey(student.id, item.date, item.subject, item.item));
      const mark = classifyHomeworkMark({
        dutyStatus: duty?.status,
        inMissingItems,
        handedIn,
      });
      if (mark === 'hidden') continue;
      const logId = duty?.logId || englishCheckLogId(student.id, item.date);
      const madeUp = madeUpKeys.has(makeupKey(logId, item.subject, item.item));
      const submitted = (
        mark === 'missing' || mark === 'exempt' || mark === 'absent'
      ) && (handedIn || madeUp);
      appearances.push({
        date: item.date,
        className: item.className,
        subject: item.subject,
        item: item.item,
        studentId: student.id,
        name: student.name || 'Unknown',
        classNumber: Number.isFinite(student.classNumber) ? student.classNumber : 0,
        mark,
        logId,
        submitted,
      });
    }
  }
  return appearances;
}

export type TallyStudent = {
  studentId: string;
  name: string;
  classNumber: number;
  missing: number;
  unclicked: number;
  absent: number;
  exempt: number;
};

function emptyTallyRows(
  students: Array<{ id: string; name: string; classNumber: number; username?: string | null }>,
): Map<string, TallyStudent> {
  const rows = new Map<string, TallyStudent>();
  for (const student of students) {
    if (isTestUsername(student.username)) continue;
    rows.set(student.id, {
      studentId: student.id,
      name: student.name || 'Unknown',
      classNumber: Number.isFinite(student.classNumber) ? student.classNumber : 0,
      missing: 0,
      unclicked: 0,
      absent: 0,
      exempt: 0,
    });
  }
  return rows;
}

export function buildMissingTally(
  students: Array<{ id: string; name: string; classNumber: number; username?: string | null }>,
  appearances: Array<{ studentId: string; mark: HomeworkMark; submitted?: boolean }>,
): TallyStudent[] {
  const rows = emptyTallyRows(students);
  for (const appearance of appearances) {
    const row = rows.get(appearance.studentId);
    if (!row) continue;
    if (appearance.mark === 'missing' && appearance.submitted) continue;
    row[appearance.mark] += 1;
  }
  return [...rows.values()];
}

/**
 * Count the Missing tally from the same enriched ledger the columns show,
 * so the sidebar cannot drift from the red / not-clicked / ABS / EX rows.
 */
export function buildMissingTallyFromLedger(
  students: Array<{ id: string; name: string; classNumber: number; username?: string | null }>,
  groups: LedgerDateGroup[],
): TallyStudent[] {
  const rows = emptyTallyRows(students);
  for (const group of groups) {
    for (const item of group.items) {
      for (const student of item.students) {
        const row = rows.get(student.studentId);
        if (!row) continue;
        const mark = student.mark || 'missing';
        if (mark === 'absent') {
          if (!student.submitted) row.absent += 1;
          continue;
        }
        if (mark === 'exempt') {
          if (!student.submitted) row.exempt += 1;
          continue;
        }
        if (mark === 'unclicked') {
          row.unclicked += 1;
          continue;
        }
        if (student.submitted) continue;
        row.missing += 1;
      }
    }
  }
  return [...rows.values()];
}

export function sortMissingTally(rows: TallyStudent[], mode: 'count' | 'number' | 'name'): TallyStudent[] {
  const copy = [...rows];
  if (mode === 'number') {
    copy.sort((a, b) => a.classNumber - b.classNumber || a.name.localeCompare(b.name));
    return copy;
  }
  if (mode === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name) || a.classNumber - b.classNumber);
    return copy;
  }
  copy.sort((a, b) => (
    b.missing - a.missing
    || b.unclicked - a.unclicked
    || a.classNumber - b.classNumber
    || a.name.localeCompare(b.name)
  ));
  return copy;
}

/**
 * Layer morning-duty marks onto ledger columns so Absent / Exempt / Not clicked
 * show in the date columns, not only in the tally.
 */
export type ByStudentWorkRow = {
  date: string;
  subject: string;
  item: string;
  detail: string;
  student: LedgerStudent;
};

export type ByStudentDateBlock = {
  date: string;
  rows: ByStudentWorkRow[];
};

export type ByStudentColumn = {
  studentId: string;
  name: string;
  classNumber: number;
  clear: boolean;
  openDates: ByStudentDateBlock[];
  doneDates: ByStudentDateBlock[];
};

/** Open block: Missing / Not clicked / Absent / Exempt that are not yet handed in. */
export function isByStudentOpenRow(student: LedgerStudent): boolean {
  const mark = student.mark || 'missing';
  if (mark === 'unclicked') return true;
  if (mark === 'absent' || mark === 'exempt' || mark === 'missing') return !student.submitted;
  return false;
}

function sortDateBlocksFarFirst(blocks: ByStudentDateBlock[], todayIso: string): ByStudentDateBlock[] {
  return [...blocks].sort((a, b) => {
    const distanceDiff = dayDistance(b.date, todayIso) - dayDistance(a.date, todayIso);
    if (distanceDiff !== 0) return distanceDiff;
    return a.date.localeCompare(b.date);
  });
}

/**
 * Pivot enriched ledger columns into per-student columns:
 * open pupils left (class number ascending), fully clear pupils right.
 */
export function buildByStudentColumns(
  groups: LedgerDateGroup[],
  roster: Array<{ id: string; name: string; classNumber: number }>,
  todayIso: string = getHKTodayString(),
  isOpenRow: (student: LedgerStudent) => boolean = isByStudentOpenRow,
): ByStudentColumn[] {
  type Acc = {
    studentId: string;
    name: string;
    classNumber: number;
    openByDate: Map<string, ByStudentWorkRow[]>;
    doneByDate: Map<string, ByStudentWorkRow[]>;
  };
  const byStudent = new Map<string, Acc>();

  const ensure = (studentId: string, name: string, classNumber: number): Acc => {
    const existing = byStudent.get(studentId);
    if (existing) return existing;
    const next: Acc = {
      studentId,
      name,
      // Coerce so "9" never sorts as a string after "19".
      classNumber: Number(classNumber) || 0,
      openByDate: new Map(),
      doneByDate: new Map(),
    };
    byStudent.set(studentId, next);
    return next;
  };

  for (const person of roster) {
    ensure(person.id, person.name || 'Unknown', person.classNumber);
  }

  for (const group of groups) {
    for (const item of group.items) {
      for (const student of item.students) {
        const acc = ensure(student.studentId, student.name, student.classNumber);
        const row: ByStudentWorkRow = {
          date: group.date,
          subject: item.subject,
          item: item.item,
          detail: item.detail,
          student,
        };
        const bucket = isOpenRow(student) ? acc.openByDate : acc.doneByDate;
        const list = bucket.get(group.date) || [];
        list.push(row);
        bucket.set(group.date, list);
      }
    }
  }

  const toBlocks = (map: Map<string, ByStudentWorkRow[]>): ByStudentDateBlock[] => (
    sortDateBlocksFarFirst(
      [...map.entries()].map(([date, rows]) => ({ date, rows })),
      todayIso,
    )
  );

  const columns: ByStudentColumn[] = [...byStudent.values()].map((acc) => {
    const openDates = toBlocks(acc.openByDate);
    const doneDates = toBlocks(acc.doneByDate);
    return {
      studentId: acc.studentId,
      name: acc.name,
      classNumber: acc.classNumber,
      clear: openDates.length === 0,
      openDates,
      doneDates,
    };
  });

  // Class number ascending (1, 2, 3…); name is only a tie-breaker.
  const byClassNumber = (a: ByStudentColumn, b: ByStudentColumn) => {
    const aNo = Number(a.classNumber) || 0;
    const bNo = Number(b.classNumber) || 0;
    return aNo - bNo || a.name.localeCompare(b.name);
  };
  const open = columns.filter((col) => !col.clear).sort(byClassNumber);
  const clear = columns.filter((col) => col.clear).sort(byClassNumber);
  return [...open, ...clear];
}

export function enrichLedgerWithDutyMarks(
  groups: LedgerDateGroup[],
  appearances: HomeworkAppearance[],
  detailLookup: DetailLookup = () => '',
  todayIso: string = getHKTodayString(),
): LedgerDateGroup[] {
  type Bucket = {
    subject: string;
    item: string;
    detail: string;
    students: LedgerStudent[];
  };
  const byDate = new Map<string, Map<string, Bucket>>();

  for (const group of groups) {
    const items = new Map<string, Bucket>();
    for (const item of group.items) {
      items.set(`${item.subject}\0${item.item}`, {
        subject: item.subject,
        item: item.item,
        detail: item.detail,
        students: item.students.map((student) => ({ ...student, mark: student.mark || 'missing' })),
      });
    }
    byDate.set(group.date, items);
  }

  for (const appearance of appearances) {
    if (appearance.mark === 'missing' && appearance.submitted) continue;
    const dateItems = byDate.get(appearance.date) ?? new Map<string, Bucket>();
    byDate.set(appearance.date, dateItems);
    const itemKey = `${appearance.subject}\0${appearance.item}`;
    const bucket = dateItems.get(itemKey) ?? {
      subject: appearance.subject,
      item: appearance.item,
      detail: detailLookup({
        date: appearance.date,
        className: appearance.className,
        subject: appearance.subject,
        item: appearance.item,
      }),
      students: [],
    };
    const existing = bucket.students.find((student) => student.studentId === appearance.studentId);
    if (existing) {
      existing.mark = appearance.mark;
      if (appearance.mark === 'absent' || appearance.mark === 'exempt') {
        existing.submitted = !!appearance.submitted;
      }
    } else {
      bucket.students.push({
        logId: appearance.logId,
        studentId: appearance.studentId,
        name: appearance.name,
        className: appearance.className,
        classNumber: appearance.classNumber,
        submitted: appearance.submitted,
        mark: appearance.mark,
      });
    }
    dateItems.set(itemKey, bucket);
  }

  const next: LedgerDateGroup[] = [];
  for (const [date, items] of byDate) {
    const mapped = [...items.values()].map((bucket) => {
      const students = [...bucket.students].sort((a, b) => {
        if (a.className !== b.className) return a.className.localeCompare(b.className);
        if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
        return a.name.localeCompare(b.name);
      });
      return {
        subject: bucket.subject,
        item: bucket.item,
        detail: bucket.detail,
        students,
        complete: students.length > 0 && students.every((student) => student.submitted && student.mark === 'missing'),
      };
    });
    next.push({
      date,
      items: mapped,
      complete: mapped.length > 0 && mapped.every((item) => item.complete),
    });
  }
  return openLedgerColumns(next, todayIso);
}

