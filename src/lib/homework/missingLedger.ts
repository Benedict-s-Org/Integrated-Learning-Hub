export const HOMEWORK_SUBJECT_ORDER = ['中文', '英文', '數學', '常識', '其他'];

export type MissingLogInput = {
  id: string;
  logDate: string;
  className: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  missingItems: Record<string, string[]>;
};

export type LedgerStudent = {
  logId: string;
  studentId: string;
  name: string;
  className: string;
  classNumber: number;
  submitted: boolean;
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

    groups.push({
      date,
      items,
      complete: items.length > 0 && items.every((item) => item.complete),
    });
  }

  const open = groups.filter((group) => !group.complete).sort((a, b) => a.date.localeCompare(b.date));
  const cleared = groups.filter((group) => group.complete).sort((a, b) => a.date.localeCompare(b.date));
  return [...open, ...cleared];
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
        const names = item.students.filter((student) => !student.submitted).map((student) => student.name);
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
