import { parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { homeworkDb } from '@/lib/homework/client';
import { handedInKey, makeupKey, parseEnglishCheckLogId } from '@/lib/homework/missingLedger';
import {
  enrichOutstandingDetails,
  filterOutstandingHomework,
  mergeOutstandingItems,
  outstandingFromOpenEnglishChecks,
  type OutstandingHomeworkItem,
} from '@/lib/homework/outstandingHomework';

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

type EnglishCheckRow = {
  record_date: string;
  subject: string;
  item_name: string;
  handed_in: boolean;
  class_name: string;
  student_id: string;
};

export type LoadOutstandingResult =
  | { status: 'ok'; items: OutstandingHomeworkItem[] }
  | { status: 'query_failed'; message: string };

const LOG_ID_BATCH = 30;

/**
 * Loads prior outstanding homework for one student (excludes today via filterOutstandingHomework).
 * Works for admin and class_staff: does not require a class-wide users roster (RLS-safe).
 * Guest paths: call with the authenticated homeworkDb client; on RLS failure returns query_failed.
 */
export async function loadOutstandingHomeworkForStudent(args: {
  studentId: string;
  className?: string;
  todayIso: string;
}): Promise<LoadOutstandingResult> {
  const { studentId, className, todayIso } = args;

  try {
    // Do not filter by class — class_id string variants would hide real prior debt for staff.
    const { data: dutyRows, error: dutyError } = await homeworkDb
      .from('morning_duty_logs')
      .select('id, log_date, class, student_id, status, missing_items')
      .eq('student_id', studentId);
    if (dutyError) {
      return { status: 'query_failed', message: dutyError.message };
    }

    const dutyLogs = (Array.isArray(dutyRows) ? dutyRows : []) as DutyLogRow[];
    const effectiveClass =
      (className || '').trim() || dutyLogs.find((log) => (log.class || '').trim())?.class || '';

    const { data: checkRows, error: checkError } = await homeworkDb
      .from('english_homework_checks')
      .select('record_date, subject, item_name, handed_in, class_name, student_id')
      .eq('student_id', studentId);
    if (checkError) {
      return { status: 'query_failed', message: checkError.message };
    }

    const checks = (Array.isArray(checkRows) ? checkRows : []) as EnglishCheckRow[];
    const handedInKeys = new Set<string>();
    for (const row of checks) {
      if (!row.handed_in) continue;
      handedInKeys.add(
        handedInKey(studentId, row.record_date, row.subject, row.item_name),
      );
    }

    // makeup_actions.log_id is uuid — never pass english|{studentId}|{date} synthetic ids
    const logIds = dutyLogs
      .map((log) => log.id)
      .filter(
        (id, index, all) =>
          id && !parseEnglishCheckLogId(id) && all.indexOf(id) === index,
      );

    const makeupActions: MakeupActionRow[] = [];
    for (let index = 0; index < logIds.length; index += LOG_ID_BATCH) {
      const batch = logIds.slice(index, index + LOG_ID_BATCH);
      if (batch.length === 0) continue;
      const { data: actionRows, error: actionError } = await homeworkDb
        .from('homework_makeup_actions')
        .select('log_id, subject, item, is_made_up')
        .in('log_id', batch);
      if (actionError) {
        return { status: 'query_failed', message: actionError.message };
      }
      for (const row of (Array.isArray(actionRows) ? actionRows : []) as MakeupActionRow[]) {
        makeupActions.push(row);
      }
    }

    const madeUpKeys = new Set<string>();
    for (const action of makeupActions) {
      if (action.is_made_up) {
        madeUpKeys.add(makeupKey(action.log_id, action.subject, action.item));
      }
    }

    const dutyItems = filterOutstandingHomework({
      todayIso,
      dutyLogs,
      makeupActions,
      handedInKeys,
    });
    const englishItems = outstandingFromOpenEnglishChecks({
      todayIso,
      studentId,
      fallbackClassName: effectiveClass,
      checks,
    }).filter(
      (item) =>
        !madeUpKeys.has(makeupKey(item.logId, item.subject, item.item)) &&
        !handedInKeys.has(handedInKey(studentId, item.logDate, item.subject, item.item)),
    );
    let items = mergeOutstandingItems(dutyItems, englishItems);

    if (items.length > 0) {
      const dates = [...new Set(items.map((item) => item.logDate))];
      const classNames = [
        ...new Set(
          [effectiveClass, ...items.map((item) => item.className)].filter(Boolean),
        ),
      ];
      const detailsByClassDate = new Map<string, SubjectAssignmentMap>();
      for (const cn of classNames) {
        const { data: homeworkRows, error: homeworkError } = await homeworkDb
          .from('daily_homework')
          .select('date, class_name, assignments')
          .eq('class_name', cn)
          .in('date', dates);
        // Soft-fail detail enrichment — still return outstanding list for class_staff.
        if (homeworkError) {
          console.warn('[loadOutstandingHomework] daily_homework enrich skipped:', homeworkError.message);
          continue;
        }
        for (const row of (Array.isArray(homeworkRows) ? homeworkRows : []) as {
          date: string;
          class_name: string;
          assignments: unknown;
        }[]) {
          detailsByClassDate.set(
            `${row.date}|${row.class_name}`,
            parseSubjectAssignments(row.assignments),
          );
        }
      }
      items = enrichOutstandingDetails(items, detailsByClassDate);
    }

    return { status: 'ok', items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'query_failed', message };
  }
}
