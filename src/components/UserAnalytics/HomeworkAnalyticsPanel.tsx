import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { homeworkDb } from '@/lib/homework/client';
import { parseSubjectAssignments } from '@/lib/homework/assignments';
import { buildHomeworkAnalytics, type HomeworkAnalyticsRow } from '@/lib/homework/homeworkBadges';
import { getHKTodayString } from '@/utils/dateUtils';

type StudentRef = {
  user_id: string;
  display_name: string;
  class: string;
};

type Summary = {
  studentId: string;
  studentName: string;
  className: string;
  assigned: number;
  onTime: number;
  late: number;
  missing: number;
  handbookDays: number;
  stillOpenAfterHandbook: number;
  mostHandbooksBeforeSubmit: number;
};

function hkDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
}

function daysAgo(days: number): string {
  const [year, month, day] = getHKTodayString().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function summarize(rows: HomeworkAnalyticsRow[], handbookDates: { studentId: string; date: string }[]): Summary[] {
  const byStudent = new Map<string, Summary>();
  for (const row of rows) {
    const current = byStudent.get(row.studentId) ?? {
      studentId: row.studentId,
      studentName: row.studentName,
      className: row.className,
      assigned: 0,
      onTime: 0,
      late: 0,
      missing: 0,
      handbookDays: 0,
      stillOpenAfterHandbook: 0,
      mostHandbooksBeforeSubmit: 0,
    };
    current.assigned += 1;
    if (row.status === 'on_time') current.onTime += 1;
    else if (row.status === 'late') current.late += 1;
    else current.missing += 1;
    if (row.stillMissingNextDay) current.stillOpenAfterHandbook += 1;
    if (row.status !== 'missing') {
      current.mostHandbooksBeforeSubmit = Math.max(current.mostHandbooksBeforeSubmit, row.handbooksBeforeSubmit);
    }
    byStudent.set(row.studentId, current);
  }
  const books = new Map<string, Set<string>>();
  for (const mark of handbookDates) {
    const dates = books.get(mark.studentId) ?? new Set<string>();
    dates.add(mark.date);
    books.set(mark.studentId, dates);
  }
  for (const summary of byStudent.values()) {
    summary.handbookDays = books.get(summary.studentId)?.size ?? 0;
  }
  return [...byStudent.values()].sort((a, b) => (
    b.stillOpenAfterHandbook - a.stillOpenAfterHandbook
    || b.missing - a.missing
    || a.className.localeCompare(b.className)
    || a.studentName.localeCompare(b.studentName)
  ));
}

export function HomeworkAnalyticsPanel({
  students,
  classFilter,
}: {
  students: StudentRef[];
  classFilter: string;
}) {
  const [rows, setRows] = useState<HomeworkAnalyticsRow[]>([]);
  const [handbookDates, setHandbookDates] = useState<{ studentId: string; date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const studentKey = students.map((student) => `${student.user_id}|${student.class}|${student.display_name}`).join('\n');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const students = studentsRef.current;
      setLoading(true);
      setError('');
      try {
        const since = daysAgo(45);
        let homeworkQuery = homeworkDb.from('daily_homework').select('date, class_name, assignments').gte('date', since);
        let checkQuery = homeworkDb
          .from('english_homework_checks')
          .select('record_date, class_name, subject, item_name, student_id, handed_in, is_late, updated_at')
          .gte('record_date', since);
        let handbookQuery = homeworkDb
          .from('homework_handbook_marks')
          .select('student_id, record_date')
          .gte('record_date', since);
        if (classFilter !== 'all') {
          homeworkQuery = homeworkQuery.eq('class_name', classFilter);
          checkQuery = checkQuery.eq('class_name', classFilter);
          handbookQuery = handbookQuery.eq('class_name', classFilter);
        }
        const [homeworkRes, checkRes, handbookRes] = await Promise.all([homeworkQuery, checkQuery, handbookQuery]);
        if (homeworkRes.error) throw homeworkRes.error;
        if (checkRes.error) throw checkRes.error;
        if (handbookRes.error) throw handbookRes.error;

        const assignments: { className: string; date: string; subject: string; item: string }[] = [];
        for (const row of (Array.isArray(homeworkRes.data) ? homeworkRes.data : []) as {
          date: string;
          class_name: string;
          assignments: unknown;
        }[]) {
          const parsed = parseSubjectAssignments(row.assignments);
          for (const [subject, items] of Object.entries(parsed)) {
            for (const item of items) {
              assignments.push({ className: row.class_name, date: row.date, subject, item: item.name });
            }
          }
        }
        const checks = ((Array.isArray(checkRes.data) ? checkRes.data : []) as {
          record_date: string;
          subject: string;
          item_name: string;
          student_id: string;
          handed_in: boolean;
          is_late?: boolean | null;
          updated_at?: string | null;
        }[]).map((row) => ({
          studentId: row.student_id,
          date: row.record_date,
          subject: row.subject,
          item: row.item_name,
          handedIn: row.handed_in,
          isLate: Boolean(row.is_late),
          updatedOn: hkDate(row.updated_at),
        }));
        const books = ((Array.isArray(handbookRes.data) ? handbookRes.data : []) as {
          student_id: string;
          record_date: string;
        }[]).map((row) => ({ studentId: row.student_id, date: row.record_date }));
        const nextRows = buildHomeworkAnalytics({
          today: getHKTodayString(),
          students: students.map((student) => ({
            id: student.user_id,
            name: student.display_name || 'Unknown',
            className: student.class || '',
          })),
          assignments,
          checks,
          handbookDates: books,
        });
        if (!cancelled) {
          setRows(nextRows);
          setHandbookDates(books);
          setSelectedId(null);
        }
      } catch (err) {
        console.error('Failed to load homework analytics', err);
        if (!cancelled) setError('Could not load homework records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classFilter, studentKey]);

  const summaries = useMemo(() => summarize(rows, handbookDates), [rows, handbookDates]);
  const selectedRows = rows.filter((row) => row.studentId === selectedId);
  const followUps = selectedRows.filter((row) => row.status !== 'on_time' || row.handbookThatDay || row.handbooksBeforeSubmit > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
        <Loader2 className="animate-spin" />
        Loading homework records...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-gray-800">Homework record</h3>
        <p className="mt-1 text-sm text-gray-500">
          Last 45 days. A handbook mark shows on the missing list for that day only. This tab keeps the history: who was still missing the next day, and how many handbook days it took before the work was handed in.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">On time</th>
              <th className="px-4 py-3">Late</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3">Handbook days</th>
              <th className="px-4 py-3">Still missing next day</th>
              <th className="px-4 py-3">Most handbooks before hand-in</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No homework in this class for the last 45 days.</td>
              </tr>
            ) : summaries.map((summary) => (
              <tr
                key={summary.studentId}
                className={`cursor-pointer border-t border-gray-100 ${selectedId === summary.studentId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedId(summary.studentId)}
              >
                <td className="px-4 py-3 font-semibold text-gray-800">{summary.className} {summary.studentName}</td>
                <td className="px-4 py-3">{summary.assigned}</td>
                <td className="px-4 py-3 text-emerald-700">{summary.onTime}</td>
                <td className="px-4 py-3 text-slate-600">{summary.late}</td>
                <td className="px-4 py-3 text-red-700">{summary.missing}</td>
                <td className="px-4 py-3">{summary.handbookDays}</td>
                <td className="px-4 py-3">{summary.stillOpenAfterHandbook}</td>
                <td className="px-4 py-3">{summary.mostHandbooksBeforeSubmit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedId && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Handbook that day</th>
                <th className="px-4 py-3">Still missing next day</th>
                <th className="px-4 py-3">Handbooks before hand-in</th>
              </tr>
            </thead>
            <tbody>
              {(followUps.length > 0 ? followUps : selectedRows).map((row) => (
                <tr key={`${row.date}|${row.subject}|${row.item}`} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{row.subject} · {row.item}</td>
                  <td className="px-4 py-3">{row.status === 'on_time' ? 'On time' : row.status === 'late' ? 'Late' : 'Missing'}</td>
                  <td className="px-4 py-3">{row.handbookThatDay ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{row.stillMissingNextDay ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{row.handbooksBeforeSubmit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
