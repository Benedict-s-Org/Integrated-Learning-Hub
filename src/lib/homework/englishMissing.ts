import { listHomeworkTargets } from '@/lib/homework/assignments';
import { homeworkDb } from '@/lib/homework/client';
import {
  handedInKey,
  missingLogsFromEnglishMarks,
  type EnglishMark,
  type MissingLogInput,
} from '@/lib/homework/missingLedger';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

type StudentRow = {
  id: string;
  display_name: string | null;
  class: string | null;
  class_number: number | string | null;
};

type MarkRow = {
  class_name: string;
  record_date: string;
  subject: string;
  item_name: string;
  student_id: string;
  handed_in: boolean;
};

export type EnglishHomeworkState = {
  logs: MissingLogInput[];
  handedInKeys: Set<string>;
};

export async function fetchEnglishHomeworkState(className?: string): Promise<EnglishHomeworkState> {
  let studentQuery = homeworkDb
    .from('users')
    .select('id, display_name, class, class_number')
    .eq('role', 'user');
  let markQuery = homeworkDb
    .from('english_homework_checks')
    .select('class_name, record_date, subject, item_name, student_id, handed_in');
  if (className && className !== 'all') {
    studentQuery = studentQuery.eq('class', className);
    markQuery = markQuery.eq('class_name', className);
  }

  const [studentsRes, marksRes] = await Promise.all([studentQuery, markQuery]);
  if (studentsRes.error) throw studentsRes.error;
  if (marksRes.error) throw marksRes.error;

  const students = ((studentsRes.data || []) as StudentRow[])
    .filter((row) => row.id && row.class && !isArchivedClassName(row.class))
    .map((row) => ({
      id: row.id,
      name: row.display_name || 'Unknown',
      className: row.class || '',
      classNumber: Number(row.class_number) || 0,
    }));
  const marks: EnglishMark[] = ((marksRes.data || []) as MarkRow[]).map((row) => ({
    className: row.class_name,
    date: row.record_date,
    subject: row.subject,
    item: row.item_name,
    studentId: row.student_id,
    handedIn: row.handed_in,
  }));
  const handedInKeys = new Set<string>();
  for (const mark of marks) {
    if (!mark.handedIn) continue;
    handedInKeys.add(handedInKey(mark.studentId, mark.date, mark.subject, mark.item));
  }
  return { logs: missingLogsFromEnglishMarks(students, marks), handedInKeys };
}

export async function fetchEnglishMissingLogs(className?: string): Promise<MissingLogInput[]> {
  const state = await fetchEnglishHomeworkState(className);
  return state.logs;
}

type SavedCheck = {
  subject: string;
  item_name: string;
  detail: string | null;
  needs_correction: boolean;
  is_complete: boolean;
};

/** 交齊功課: this student handed in every item on that day's homework list. */
export async function markListedHomeworkHandedIn(args: {
  className: string;
  date: string;
  studentId: string;
}): Promise<void> {
  const className = args.className.trim();
  if (!className || className === 'all' || !args.studentId || !args.date) return;

  const [homeworkRes, checksRes] = await Promise.all([
    homeworkDb
      .from('daily_homework')
      .select('assignments')
      .eq('class_name', className)
      .eq('date', args.date),
    homeworkDb
      .from('english_homework_checks')
      .select('subject, item_name, detail, needs_correction, is_complete')
      .eq('class_name', className)
      .eq('record_date', args.date)
      .eq('student_id', args.studentId),
  ]);
  if (homeworkRes.error) throw new Error(homeworkRes.error.message);
  if (checksRes.error) throw new Error(checksRes.error.message);

  const homeworkRows = (Array.isArray(homeworkRes.data) ? homeworkRes.data : []) as { assignments: unknown }[];
  const targets = listHomeworkTargets(homeworkRows[0]?.assignments);
  if (targets.length === 0) return;

  const saved = (Array.isArray(checksRes.data) ? checksRes.data : []) as SavedCheck[];
  const results = await Promise.all(targets.map((target) => {
    const prior = saved.find((row) => (
      row.subject === target.subject
      && row.item_name === target.name
      && (row.detail || '') === target.detail
    ));
    return homeworkDb.rpc('set_english_homework_check', {
      p_class: className,
      p_date: args.date,
      p_subject: target.subject,
      p_item: target.name,
      p_detail: target.detail,
      p_student_id: args.studentId,
      p_handed_in: true,
      p_needs_correction: prior?.needs_correction ?? false,
      p_is_complete: prior?.is_complete ?? false,
    });
  }));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}
