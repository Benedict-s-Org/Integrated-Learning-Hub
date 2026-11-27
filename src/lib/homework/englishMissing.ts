import { listHomeworkTargets } from '@/lib/homework/assignments';
import { homeworkDb } from '@/lib/homework/client';
import {
  handedInKey,
  missingLogsFromEnglishMarks,
  type EnglishMark,
  type HandedInRosterEntry,
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
  is_late?: boolean | null;
};

export type EnglishHomeworkState = {
  logs: MissingLogInput[];
  handedInKeys: Set<string>;
  lateKeys: Set<string>;
  handedInRoster: HandedInRosterEntry[];
};

export async function fetchEnglishHomeworkState(className?: string): Promise<EnglishHomeworkState> {
  let studentQuery = homeworkDb
    .from('users')
    .select('id, display_name, class, class_number')
    .eq('role', 'user');
  let markQuery = homeworkDb
    .from('english_homework_checks')
      .select('class_name, record_date, subject, item_name, student_id, handed_in, is_late');
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
    isLate: Boolean(row.is_late),
  }));
  const handedInKeys = new Set<string>();
  const lateKeys = new Set<string>();
  for (const mark of marks) {
    if (!mark.handedIn) continue;
    const key = handedInKey(mark.studentId, mark.date, mark.subject, mark.item);
    handedInKeys.add(key);
    if (mark.isLate) lateKeys.add(key);
  }
  const handedInRoster: HandedInRosterEntry[] = [];
  for (const mark of marks) {
    if (!mark.handedIn) continue;
    const student = students.find((row) => row.id === mark.studentId);
    handedInRoster.push({
      className: mark.className,
      date: mark.date,
      subject: mark.subject,
      item: mark.item,
      studentId: mark.studentId,
      name: student?.name || 'Unknown',
      classNumber: student?.classNumber || 0,
    });
  }
  return { logs: missingLogsFromEnglishMarks(students, marks), handedInKeys, lateKeys, handedInRoster };
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
  is_late?: boolean | null;
};

type ListedHandedInArgs = {
  className: string;
  date: string;
  studentId: string;
  /** When set, only these subject→item rows are updated (partial 欠). */
  items?: Record<string, string[]> | null;
};

type SetHandedInOptions = {
  /** Keep existing late flags when marking handed-in (used by partial 欠 sync). */
  preserveLate?: boolean;
};

/**
 * Set handed-in ticks for that day's homework list (or a subset).
 * 交齊 → true for all listed. Partial 欠 → false only for selected items.
 */
export async function setListedHomeworkHandedIn(
  args: ListedHandedInArgs,
  handedIn: boolean,
  options: SetHandedInOptions = {},
): Promise<void> {
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
      .select('subject, item_name, detail, needs_correction, is_complete, is_late')
      .eq('class_name', className)
      .eq('record_date', args.date)
      .eq('student_id', args.studentId),
  ]);
  if (homeworkRes.error) throw new Error(homeworkRes.error.message);
  if (checksRes.error) throw new Error(checksRes.error.message);

  const homeworkRows = (Array.isArray(homeworkRes.data) ? homeworkRes.data : []) as { assignments: unknown }[];
  let targets = listHomeworkTargets(homeworkRows[0]?.assignments);

  const onlyItems = args.items;
  if (onlyItems) {
    const wanted = new Set<string>();
    for (const [subject, names] of Object.entries(onlyItems)) {
      if (!Array.isArray(names)) continue;
      for (const name of names) {
        const trimmed = String(name || '').trim();
        if (trimmed) wanted.add(`${subject.trim()}\0${trimmed}`);
      }
    }
    if (wanted.size === 0) return;
    targets = targets.filter((target) => wanted.has(`${target.subject}\0${target.name}`));
    // Also include selected items that are not on today's list (still need the tick cleared).
    for (const key of wanted) {
      const [subject, name] = key.split('\0');
      if (!targets.some((target) => target.subject === subject && target.name === name)) {
        targets.push({ subject, name, detail: '' });
      }
    }
  }
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
      p_handed_in: handedIn,
      p_needs_correction: handedIn ? (prior?.needs_correction ?? false) : false,
      p_is_complete: handedIn ? (prior?.is_complete ?? false) : false,
      // 交齊 resets late; partial-欠 sync must not erase earlier 遲交 marks on other items.
      p_is_late: handedIn && options.preserveLate ? Boolean(prior?.is_late) : false,
    });
  }));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/** 交齊功課: this student handed in every item on that day's homework list. */
export async function markListedHomeworkHandedIn(args: ListedHandedInArgs): Promise<void> {
  await setListedHomeworkHandedIn({ ...args, items: undefined }, true);
}

/**
 * Partial 欠 after 交齊: clear handed-in only for the selected missing items.
 * General 欠 (no item list) does not wipe other makeup ticks.
 */
export async function clearListedHomeworkHandedIn(args: ListedHandedInArgs): Promise<void> {
  if (!args.items || Object.keys(args.items).length === 0) return;
  await setListedHomeworkHandedIn(args, false);
}

/**
 * Partial 欠: tick every listed item handed-in, then untick only the selected 欠 items.
 * Result: 欠一份 → that one Missing; every other listed item = Handed in (keeps 遲交 flags).
 */
export async function syncPartialMissingHomeworkTicks(args: ListedHandedInArgs): Promise<void> {
  if (!args.items || Object.keys(args.items).length === 0) return;
  await setListedHomeworkHandedIn({ ...args, items: undefined }, true, { preserveLate: true });
  await clearListedHomeworkHandedIn(args);
}
