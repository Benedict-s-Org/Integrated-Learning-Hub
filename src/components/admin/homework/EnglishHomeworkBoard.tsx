import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { homeworkDb } from '@/lib/homework/client';
import {
  EMPTY_ENGLISH_CHECK,
  englishCheckKey,
  groupWorkByDate,
  groupWorkByItem,
  listEnglishWork,
  nextEnglishCheck,
  type EnglishCheck,
  type EnglishCheckField,
  type EnglishWorkCell,
} from '@/lib/homework/englishWork';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

type Student = {
  id: string;
  display_name: string | null;
  class: string | null;
  class_number: number | null;
};

type CheckRow = {
  class_name: string;
  record_date: string;
  subject: string;
  item_name: string;
  detail: string;
  student_id: string;
  handed_in: boolean;
  needs_correction: boolean;
  is_complete: boolean;
};

function listedClassNames(rows: { class?: string | null }[] | null | undefined): string[] {
  return [...new Set((rows || []).map((row) => row.class).filter((name): name is string => !!name))]
    .filter((name) => !isArchivedClassName(name))
    .sort((a, b) => a.localeCompare(b));
}

function formatLedgerDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('en-HK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function workTitle(work: Pick<EnglishWorkCell, 'subject' | 'name' | 'detail'>): string {
  return [work.subject, work.name, work.detail].filter(Boolean).join(' · ');
}

export function EnglishHomeworkBoard() {
  const [classes, setClasses] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState('3A');
  const [view, setView] = useState<'date' | 'item'>('date');
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('asc');
  const [works, setWorks] = useState<EnglishWorkCell[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [checks, setChecks] = useState<Record<string, EnglishCheck>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data: classRows, error: classError } = await homeworkDb
          .from('users')
          .select('class')
          .not('class', 'is', null);
        if (classError) throw classError;
        const classNames = listedClassNames((classRows || []) as { class?: string | null }[]);
        if (!cancelled) {
          setClasses(classNames);
          setClassFilter((current) => (current === '3A' || classNames.includes(current) ? current : (classNames[0] || 'all')));
        }

        let homeworkQuery = homeworkDb
          .from('daily_homework')
          .select('date, class_name, assignments');
        if (classFilter !== 'all') homeworkQuery = homeworkQuery.eq('class_name', classFilter);
        const { data: homeworkRows, error: homeworkError } = await homeworkQuery;
        if (homeworkError) throw homeworkError;

        const cells = listEnglishWork(((homeworkRows || []) as { date: string; class_name: string; assignments: unknown }[]).map((row) => ({
          date: row.date,
          className: row.class_name,
          assignments: row.assignments,
        })));

        let studentQuery = homeworkDb
          .from('users')
          .select('id, display_name, class, class_number')
          .eq('role', 'user');
        if (classFilter !== 'all') studentQuery = studentQuery.eq('class', classFilter);
        const { data: studentRows, error: studentError } = await studentQuery;
        if (studentError) throw studentError;

        let checkQuery = homeworkDb
          .from('english_homework_checks')
          .select('class_name, record_date, subject, item_name, detail, student_id, handed_in, needs_correction, is_complete');
        if (classFilter !== 'all') checkQuery = checkQuery.eq('class_name', classFilter);
        const { data: checkRows, error: checkError } = await checkQuery;
        if (checkError) throw checkError;

        const nextChecks: Record<string, EnglishCheck> = {};
        for (const row of (checkRows || []) as unknown as CheckRow[]) {
          nextChecks[englishCheckKey({
            className: row.class_name,
            date: row.record_date,
            subject: row.subject,
            name: row.item_name,
            detail: row.detail || '',
          }, row.student_id)] = {
            handedIn: row.handed_in,
            correction: row.needs_correction,
            complete: row.is_complete,
          };
        }

        if (!cancelled) {
          setWorks(cells);
          setStudents((studentRows || []) as Student[]);
          setChecks(nextChecks);
        }
      } catch (err) {
        console.error('Failed to load English homework', err);
        if (!cancelled) setError('Could not load English homework. Apply the latest database migration if this table is new.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classFilter]);

  const dateGroups = useMemo(() => groupWorkByDate(works, dateOrder), [works, dateOrder]);
  const itemGroups = useMemo(() => groupWorkByItem(works), [works]);
  const studentsByClass = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const student of students) {
      const className = student.class || '';
      const list = map.get(className) ?? [];
      list.push(student);
      map.set(className, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.class_number ?? 0) - (b.class_number ?? 0) || (a.display_name || '').localeCompare(b.display_name || ''));
    }
    return map;
  }, [students]);

  const setCheck = async (work: EnglishWorkCell, studentId: string, field: EnglishCheckField, value: boolean) => {
    const key = englishCheckKey(work, studentId);
    const current = checks[key] ?? EMPTY_ENGLISH_CHECK;
    const next = nextEnglishCheck(current, field, value);
    setChecks((prev) => ({ ...prev, [key]: next }));
    setPendingKey(`${key}:${field}`);
    setError('');
    try {
      const { error: rpcError } = await homeworkDb.rpc('set_english_homework_check', {
        p_class: work.className,
        p_date: work.date,
        p_subject: work.subject,
        p_item: work.name,
        p_detail: work.detail,
        p_student_id: studentId,
        p_handed_in: next.handedIn,
        p_needs_correction: next.correction,
        p_is_complete: next.complete,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      console.error('Failed to save English homework check', err);
      setChecks((prev) => ({ ...prev, [key]: current }));
      setError('Could not save that checkbox.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">English homework</h2>
          <p className="text-sm font-medium text-slate-500">
            Items come from today and tomorrow setup on the Class Dashboard, including pages or chapters.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">
            Class
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="mt-1 block w-40 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              <option value="all">All classes</option>
              {classes.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="flex rounded-xl border-2 border-slate-200 bg-white p-1">
            <button type="button" onClick={() => setView('date')} className={tabClass(view === 'date')}>By date</button>
            <button type="button" onClick={() => setView('item')} className={tabClass(view === 'item')}>By homework item</button>
          </div>
          {view === 'date' && (
            <button
              type="button"
              onClick={() => setDateOrder((order) => (order === 'asc' ? 'desc' : 'asc'))}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600"
            >
              {dateOrder === 'asc' ? 'Earliest first' : 'Newest first'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="animate-spin" />
          Loading English homework...
        </div>
      ) : works.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
          No English homework has been set on the Class Dashboard yet.
        </div>
      ) : view === 'date' ? (
        <div className="space-y-8">
          {dateGroups.map((group) => (
            <section key={group.date} className="space-y-3">
              <h3 className="text-lg font-black text-slate-800">{formatLedgerDate(group.date)}</h3>
              {group.works.map((work) => (
                <WorkTable
                  key={`${work.className}:${work.subject}:${work.name}:${work.detail}`}
                  title={`${work.className} · ${workTitle(work)}`}
                  students={studentsByClass.get(work.className) || []}
                  work={work}
                  checks={checks}
                  pendingKey={pendingKey}
                  onToggle={setCheck}
                />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {itemGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h3 className="text-lg font-black text-slate-800">{workTitle(group)}</h3>
              {group.works.map((work) => (
                <WorkTable
                  key={`${work.date}:${work.className}:${work.subject}`}
                  title={`${formatLedgerDate(work.date)} · ${work.className}`}
                  students={studentsByClass.get(work.className) || []}
                  work={work}
                  checks={checks}
                  pendingKey={pendingKey}
                  onToggle={setCheck}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function tabClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${active ? 'bg-slate-800 text-white' : 'text-slate-500'}`;
}

function WorkTable({
  title,
  students,
  work,
  checks,
  pendingKey,
  onToggle,
}: {
  title: string;
  students: Student[];
  work: EnglishWorkCell;
  checks: Record<string, EnglishCheck>;
  pendingKey: string | null;
  onToggle: (work: EnglishWorkCell, studentId: string, field: EnglishCheckField, value: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">{title}</div>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-4 py-2">Student</th>
            <th className="px-3 py-2">Handed in</th>
            <th className="px-3 py-2">Correction</th>
            <th className="px-3 py-2">Complete</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-slate-400">No students in this class.</td>
            </tr>
          ) : students.map((student) => {
            const state = checks[englishCheckKey(work, student.id)] ?? EMPTY_ENGLISH_CHECK;
            return (
              <tr key={student.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-bold text-slate-800">
                  <span className="mr-2 text-xs text-slate-400">{student.class_number ?? ''}</span>
                  {student.display_name || 'Unknown'}
                </td>
                <CheckCell label={`Handed in for ${student.display_name || 'student'}`} checked={state.handedIn} disabled={pendingKey?.startsWith(englishCheckKey(work, student.id)) ?? false} onChange={(value) => onToggle(work, student.id, 'handedIn', value)} />
                <CheckCell label={`Correction for ${student.display_name || 'student'}`} checked={state.correction} disabled={pendingKey?.startsWith(englishCheckKey(work, student.id)) ?? false} onChange={(value) => onToggle(work, student.id, 'correction', value)} />
                <CheckCell label={`Complete for ${student.display_name || 'student'}`} checked={state.complete} disabled={pendingKey?.startsWith(englishCheckKey(work, student.id)) ?? false} onChange={(value) => onToggle(work, student.id, 'complete', value)} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CheckCell({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <td className="px-3 py-2">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
    </td>
  );
}
