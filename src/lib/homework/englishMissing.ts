import { homeworkDb } from '@/lib/homework/client';
import {
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

export async function fetchEnglishMissingLogs(className?: string): Promise<MissingLogInput[]> {
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
  return missingLogsFromEnglishMarks(students, marks);
}
