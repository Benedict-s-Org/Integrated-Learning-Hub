import { detailFor, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import {
  englishCheckLogId,
  handedInKey,
  makeupKey,
  type EnglishMark,
  type MissingLogInput,
} from '@/lib/homework/missingLedger';

/**
 * `handedInKeys` must use the same composite key as English homework checks:
 * `handedInKey(studentId, logDate, subject, item)` → `${studentId}\0${date}\0${subject}\0${item}`.
 * Task 3/4 should build this Set with `handedInKey`; do not invent a alternate format.
 */

export type OutstandingHomeworkItem = {
  logId: string;
  logDate: string;
  className: string;
  studentId: string;
  subject: string;
  item: string;
  detail: string;
};

type DutyLogRow = {
  id: string;
  log_date: string;
  class: string;
  student_id: string;
  status: string;
  missing_items: Record<string, string[]> | null;
};

type MakeupActionRow = {
  log_id: string;
  subject: string;
  item: string;
  is_made_up: boolean;
};

/** Pure: from already-loaded rows, exclude made-up / handed-in / today. */
export function filterOutstandingHomework(args: {
  todayIso: string;
  dutyLogs: DutyLogRow[];
  makeupActions: MakeupActionRow[];
  handedInKeys: Set<string>;
}): OutstandingHomeworkItem[] {
  const { todayIso, dutyLogs, makeupActions, handedInKeys } = args;
  const madeUpKeys = new Set<string>();
  for (const action of makeupActions) {
    if (action.is_made_up) {
      madeUpKeys.add(makeupKey(action.log_id, action.subject, action.item));
    }
  }

  const items: OutstandingHomeworkItem[] = [];

  for (const log of dutyLogs) {
    if ((log.status || '').trim().toLowerCase() !== 'missing') continue;
    if (log.log_date >= todayIso) continue;

    const subjects = log.missing_items || {};
    for (const [subject, rawItems] of Object.entries(subjects)) {
      if (!Array.isArray(rawItems)) continue;
      for (const rawItem of rawItems) {
        const item = typeof rawItem === 'string' ? rawItem.trim() : '';
        if (!item) continue;

        if (madeUpKeys.has(makeupKey(log.id, subject, item))) continue;
        if (handedInKeys.has(handedInKey(log.student_id, log.log_date, subject, item))) continue;

        items.push({
          logId: log.id,
          logDate: log.log_date,
          className: log.class,
          studentId: log.student_id,
          subject,
          item,
          detail: '',
        });
      }
    }
  }

  return items;
}

/** English-tracker debt (missingLogsFromEnglishMarks) for one student, same exclusions as duty rows. */
export function outstandingFromEnglishLogs(args: {
  todayIso: string;
  studentId: string;
  englishLogs: MissingLogInput[];
  madeUpKeys: Set<string>;
  handedInKeys: Set<string>;
}): OutstandingHomeworkItem[] {
  const { todayIso, studentId, englishLogs, madeUpKeys, handedInKeys } = args;
  const items: OutstandingHomeworkItem[] = [];

  for (const log of englishLogs) {
    if (log.studentId !== studentId) continue;
    if (log.logDate >= todayIso) continue;

    const subjects = log.missingItems || {};
    for (const [subject, rawItems] of Object.entries(subjects)) {
      if (!Array.isArray(rawItems)) continue;
      for (const rawItem of rawItems) {
        const item = typeof rawItem === 'string' ? rawItem.trim() : '';
        if (!item) continue;

        if (madeUpKeys.has(makeupKey(log.id, subject, item))) continue;
        if (handedInKeys.has(handedInKey(studentId, log.logDate, subject, item))) continue;

        items.push({
          logId: log.id,
          logDate: log.logDate,
          className: log.className,
          studentId: log.studentId,
          subject,
          item,
          detail: '',
        });
      }
    }
  }

  return items;
}

/**
 * Single-student English debt from that student's own check rows.
 * Prefer this for class_staff — avoids a class-wide users SELECT that RLS may empty out.
 */
export function outstandingFromOpenEnglishChecks(args: {
  todayIso: string;
  studentId: string;
  fallbackClassName: string;
  checks: Array<{
    record_date: string;
    subject: string;
    item_name: string;
    handed_in: boolean;
    class_name: string;
  }>;
}): OutstandingHomeworkItem[] {
  const { todayIso, studentId, fallbackClassName, checks } = args;
  const items: OutstandingHomeworkItem[] = [];

  for (const row of checks) {
    if (row.handed_in) continue;
    if (!row.record_date || row.record_date >= todayIso) continue;
    const subject = (row.subject || '').trim();
    const item = (row.item_name || '').trim();
    if (!subject || !item) continue;

    items.push({
      logId: englishCheckLogId(studentId, row.record_date),
      logDate: row.record_date,
      className: (row.class_name || fallbackClassName || '').trim(),
      studentId,
      subject,
      item,
      detail: '',
    });
  }

  return items;
}

/**
 * Ledger-style English gaps for one student (no class roster needed):
 * if any classmate handed in an item that day, and this student did not, it is outstanding.
 */
export function outstandingEnglishGapsForStudent(args: {
  todayIso: string;
  studentId: string;
  marks: EnglishMark[];
}): OutstandingHomeworkItem[] {
  const { todayIso, studentId, marks } = args;
  type Group = {
    className: string;
    date: string;
    subject: string;
    item: string;
    handedIn: Set<string>;
  };
  const groups = new Map<string, Group>();
  for (const mark of marks) {
    const className = (mark.className || '').trim();
    const item = (mark.item || '').trim();
    if (!className || !mark.date || !mark.subject || !item || !mark.studentId) continue;
    if (mark.date >= todayIso) continue;
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

  const items: OutstandingHomeworkItem[] = [];
  for (const group of groups.values()) {
    if (group.handedIn.size === 0) continue; // same as Missing ledger: no ticks ⇒ off list
    if (group.handedIn.has(studentId)) continue;
    items.push({
      logId: englishCheckLogId(studentId, group.date),
      logDate: group.date,
      className: group.className,
      studentId,
      subject: group.subject,
      item: group.item,
      detail: '',
    });
  }
  return items;
}

export function mergeOutstandingItems(
  primary: OutstandingHomeworkItem[],
  extra: OutstandingHomeworkItem[],
): OutstandingHomeworkItem[] {
  const seen = new Set<string>();
  const merged: OutstandingHomeworkItem[] = [];
  for (const item of [...primary, ...extra]) {
    const key = makeupKey(item.logId, item.subject, item.item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function enrichOutstandingDetails(
  items: OutstandingHomeworkItem[],
  detailsByClassDate: Map<string, SubjectAssignmentMap>,
): OutstandingHomeworkItem[] {
  return items.map((item) => {
    if (item.detail) return item;
    const detail = detailFor(
      detailsByClassDate.get(`${item.logDate}|${item.className}`),
      item.subject,
      item.item,
    );
    return detail ? { ...item, detail } : item;
  });
}

export function groupOutstandingByDate(
  items: OutstandingHomeworkItem[],
): Array<{ date: string; items: OutstandingHomeworkItem[] }> {
  const byDate = new Map<string, OutstandingHomeworkItem[]>();
  for (const item of items) {
    const list = byDate.get(item.logDate) ?? [];
    list.push(item);
    byDate.set(item.logDate, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, groupItems]) => ({ date, items: groupItems }));
}