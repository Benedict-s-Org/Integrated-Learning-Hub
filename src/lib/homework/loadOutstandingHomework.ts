import { parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { homeworkDb } from '@/lib/homework/client';
import {
  handedInKey,
  makeupKey,
  missingLogsFromEnglishMarks,
  parseEnglishCheckLogId,
  type EnglishMark,
} from '@/lib/homework/missingLedger';
import {
  enrichOutstandingDetails,
  filterOutstandingHomework,
  mergeOutstandingItems,
  outstandingFromEnglishLogs,
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

type StudentRow = {
  id: string;
  display_name: string | null;
  class: string | null;
  class_number: number | string | null;
};

export type LoadOutstandingResult =
  | { status: 'ok'; items: OutstandingHomeworkItem[] }
  | { status: 'query_failed'; message: string };

const LOG_ID_BATCH = 30;

/**
 * Loads prior outstanding homework for one student (excludes today via filterOutstandingHomework).
 * Guest paths: call with the authenticated homeworkDb client; on RLS failure returns query_failed (no new RPC).
 */
export async function loadOutstandingHomeworkForStudent(args: {
  studentId: string;
  className?: string;
  todayIso: string;
}): Promise<LoadOutstandingResult> {
  const { studentId, className, todayIso } = args;

  try {
    let dutyQuery = homeworkDb
      .from('morning_duty_logs')
      .select('id, log_date, class, student_id, status, missing_items')
      .eq('student_id', studentId);
    if (className) {
      dutyQuery = dutyQuery.eq('class', className);
    }
    const { data: dutyRows, error: dutyError } = await dutyQuery;
    if (dutyError) {
      return { status: 'query_failed', message: dutyError.message };
    }

    const dutyLogs = (Array.isArray(dutyRows) ? dutyRows : []) as DutyLogRow[];
    const effectiveClass =
      (className || '').trim() || dutyLogs.find((log) => log.class)?.class || '';

    const { data: checkRows, error: checkError } = await homeworkDb
      .from('english_homework_checks')
      .select('record_date, subject, item_name, handed_in, class_name, student_id')
      .eq('student_id', studentId);
    if (checkError) {
      return { status: 'query_failed', message: checkError.message };
    }

    const handedInKeys = new Set<string>();
    for (const row of (Array.isArray(checkRows) ? checkRows : []) as EnglishCheckRow[]) {
      if (!row.handed_in) continue;
      handedInKeys.add(
        handedInKey(studentId, row.record_date, row.subject, row.item_name),
      );
    }

    let englishLogs: ReturnType<typeof missingLogsFromEnglishMarks> = [];
    if (effectiveClass) {
      let studentQuery = homeworkDb
        .from('users')
        .select('id, display_name, class, class_number')
        .eq('role', 'user')
        .eq('class', effectiveClass);
      let markQuery = homeworkDb
        .from('english_homework_checks')
        .select('class_name, record_date, subject, item_name, student_id, handed_in')
        .eq('class_name', effectiveClass);

      const [studentsRes, marksRes] = await Promise.all([studentQuery, markQuery]);
      if (studentsRes.error) {
        return { status: 'query_failed', message: studentsRes.error.message };
      }
      if (marksRes.error) {
        return { status: 'query_failed', message: marksRes.error.message };
      }

      const students = ((studentsRes.data || []) as StudentRow[])
        .filter((row) => row.id)
        .map((row) => ({
          id: row.id,
          name: row.display_name || 'Unknown',
          className: row.class || effectiveClass,
          classNumber: Number(row.class_number) || 0,
        }));
      const marks: EnglishMark[] = ((marksRes.data || []) as EnglishCheckRow[]).map((row) => ({
        className: row.class_name,
        date: row.record_date,
        subject: row.subject,
        item: row.item_name,
        studentId: row.student_id,
        handedIn: row.handed_in,
      }));

      englishLogs = missingLogsFromEnglishMarks(students, marks);
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
    const englishItems = outstandingFromEnglishLogs({
      todayIso,
      studentId,
      englishLogs,
      madeUpKeys,
      handedInKeys,
    });
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
        if (homeworkError) {
          return { status: 'query_failed', message: homeworkError.message };
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