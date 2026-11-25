import { homeworkDb } from '@/lib/homework/client';
import { handedInKey } from '@/lib/homework/missingLedger';
import {
  filterOutstandingHomework,
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
    const logIds = dutyLogs
      .map((log) => log.id)
      .filter((id) => id && !id.startsWith('english|'));

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

    const { data: checkRows, error: checkError } = await homeworkDb
      .from('english_homework_checks')
      .select('record_date, subject, item_name, handed_in')
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

    const items = filterOutstandingHomework({
      todayIso,
      dutyLogs,
      makeupActions,
      handedInKeys,
    });

    return { status: 'ok', items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'query_failed', message };
  }
}