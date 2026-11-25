import { parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { homeworkDb } from '@/lib/homework/client';
import {
  handedInKey,
  makeupKey,
  parseEnglishCheckLogId,
  type EnglishMark,
} from '@/lib/homework/missingLedger';
import {
  enrichOutstandingDetails,
  filterOutstandingHomework,
  mergeOutstandingItems,
  outstandingEnglishGapsForStudent,
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
    let dutyLogs: DutyLogRow[] = [];

    // Prefer SECURITY DEFINER RPC so class_staff is not blocked by RLS empty SELECTs.
    const { data: rpcDutyRows, error: rpcDutyError } = await homeworkDb.rpc(
      'get_student_prior_missing_homework',
      { p_student_id: studentId, p_today: todayIso },
    );
    if (!rpcDutyError && Array.isArray(rpcDutyRows)) {
      dutyLogs = (rpcDutyRows as Array<{
        log_id: string;
        log_date: string;
        class: string;
        student_id: string;
        status: string;
        missing_items: Record<string, string[]> | null;
      }>).map((row) => ({
        id: row.log_id,
        log_date: row.log_date,
        class: row.class,
        student_id: row.student_id,
        status: row.status,
        missing_items: row.missing_items,
      }));
    } else {
      if (rpcDutyError) {
        console.warn(
          '[loadOutstandingHomework] RPC get_student_prior_missing_homework failed, falling back:',
          rpcDutyError.message,
        );
      }
      // Fallback: direct select (do not filter by class — string variants hide debt).
      const { data: dutyRows, error: dutyError } = await homeworkDb
        .from('morning_duty_logs')
        .select('id, log_date, class, student_id, status, missing_items')
        .eq('student_id', studentId);
      if (dutyError) {
        return { status: 'query_failed', message: dutyError.message };
      }
      dutyLogs = (Array.isArray(dutyRows) ? dutyRows : []) as DutyLogRow[];
    }

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
    const englishFromOwnChecks = outstandingFromOpenEnglishChecks({
      todayIso,
      studentId,
      fallbackClassName: effectiveClass,
      checks,
    });

    let englishFromGaps: OutstandingHomeworkItem[] = [];
    if (effectiveClass) {
      const { data: classMarkRows, error: classMarkError } = await homeworkDb
        .from('english_homework_checks')
        .select('class_name, record_date, subject, item_name, student_id, handed_in')
        .eq('class_name', effectiveClass);
      if (classMarkError) {
        console.warn('[loadOutstandingHomework] class english marks skipped:', classMarkError.message);
      } else {
        const marks: EnglishMark[] = (
          (Array.isArray(classMarkRows) ? classMarkRows : []) as EnglishCheckRow[]
        ).map((row) => ({
          className: row.class_name,
          date: row.record_date,
          subject: row.subject,
          item: row.item_name,
          studentId: row.student_id,
          handedIn: row.handed_in,
        }));
        englishFromGaps = outstandingEnglishGapsForStudent({ todayIso, studentId, marks });
      }
    }

    const englishItems = mergeOutstandingItems(englishFromOwnChecks, englishFromGaps).filter(
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
