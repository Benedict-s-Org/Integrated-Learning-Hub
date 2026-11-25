import { handedInKey, makeupKey } from '@/lib/homework/missingLedger';

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