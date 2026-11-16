import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homeworkDb } from '@/lib/homework/client';
import { detailFor, listHomeworkTargets, parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { fetchEnglishHomeworkState } from '@/lib/homework/englishMissing';
import {
  buildMissingLedger,
  buildMissingTally,
  formatLedgerStudentLabel,
  handedInKey,
  listHomeworkAppearances,
  makeupKey,
  parseEnglishCheckLogId,
  sortMissingTally,
  submittedKeysWithHandedIn,
  type HomeworkAppearance,
  type HomeworkMark,
  type LedgerDateGroup,
  type LedgerStudent,
  type MissingLogInput,
  type TallyStudent,
} from '@/lib/homework/missingLedger';
import { fetchManagedClassIds, filterClassNameList } from '@/lib/staff/managedClasses';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

type RawLog = {
  id: string;
  log_date: string;
  class: string | null;
  student_id: string;
  status?: string | null;
  missing_items: Record<string, string[]> | null;
  student?: {
    display_name: string | null;
    username?: string | null;
    class: string | null;
    class_number: number | string | null;
  } | null;
};

type RosterRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  class: string | null;
  class_number: number | string | null;
};

function markKey(studentId: string, date: string, subject: string, item: string): string {
  return `${studentId}|${date}|${subject}|${item}`;
}

function logsFromAppearances(rows: HomeworkAppearance[]): MissingLogInput[] {
  const grouped = new Map<string, MissingLogInput>();
  for (const row of rows) {
    const key = `${row.studentId}|${row.date}`;
    const log = grouped.get(key) ?? {
      id: row.logId,
      logDate: row.date,
      className: row.className,
      studentId: row.studentId,
      studentName: row.name,
      classNumber: row.classNumber,
      missingItems: {},
    };
    const items = log.missingItems[row.subject] ?? [];
    if (!items.includes(row.item)) items.push(row.item);
    log.missingItems[row.subject] = items;
    grouped.set(key, log);
  }
  return [...grouped.values()];
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

function itemLabel(subject: string, item: string, detail: string): string {
  return [subject, item, detail].filter(Boolean).join(' · ');
}

export function MissingHomeworkLedger() {
  const { user, isAdmin, session } = useAuth();
  const [searchParams] = useSearchParams();
  const initialClass = searchParams.get('class') || 'all';
  const focusDate = searchParams.get('focusDate');

  const [classFilter, setClassFilter] = useState(initialClass);
  const [classes, setClasses] = useState<string[]>([]);
  const [logs, setLogs] = useState<MissingLogInput[]>([]);
  const [madeUp, setMadeUp] = useState<Set<string>>(new Set());
  const [handedInKeys, setHandedInKeys] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Record<string, HomeworkMark>>({});
  const [tally, setTally] = useState<TallyStudent[]>([]);
  const [tallyMode, setTallyMode] = useState<'count' | 'number'>('count');
  const [detailsByClassDate, setDetailsByClassDate] = useState<Map<string, SubjectAssignmentMap>>(new Map());
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
        let classNames = [...new Set(((classRows || []) as { class?: string | null }[]).map((row) => row.class).filter((name): name is string => !!name))]
          .filter((name) => !isArchivedClassName(name))
          .sort((a, b) => a.localeCompare(b));
        if (!isAdmin && user?.id) {
          const managed = await fetchManagedClassIds(user.id, session?.access_token);
          classNames = filterClassNameList(classNames, managed, false);
        }
        const effectiveFilter = (!isAdmin && (classFilter === 'all' || !classNames.includes(classFilter)))
          ? (classNames[0] || '')
          : classFilter;
        if (!cancelled) {
          setClasses(classNames);
          if (effectiveFilter !== classFilter) setClassFilter(effectiveFilter);
        }
        if (!effectiveFilter) {
          if (!cancelled) {
            setLogs([]);
            setMadeUp(new Set());
            setHandedInKeys(new Set());
            setMarks({});
            setTally([]);
            setDetailsByClassDate(new Map());
          }
          return;
        }

        let rosterQuery = homeworkDb
          .from('users')
          .select('id, display_name, username, class, class_number')
          .eq('role', 'user');
        if (effectiveFilter !== 'all') rosterQuery = rosterQuery.eq('class', effectiveFilter);
        const { data: rosterRows, error: rosterError } = await rosterQuery;
        if (rosterError) throw rosterError;
        const roster = ((rosterRows || []) as RosterRow[])
          .filter((row) => row.id && row.class && !isArchivedClassName(row.class))
          .map((row) => ({
            id: row.id,
            name: row.display_name || 'Unknown',
            className: row.class || '',
            classNumber: Number(row.class_number) || 0,
            username: row.username,
          }));

        let query = homeworkDb
          .from('morning_duty_logs')
          .select('id, log_date, class, student_id, status, missing_items, student:users(display_name, username, class, class_number)');
        if (effectiveFilter !== 'all') query = query.eq('class', effectiveFilter);
        const { data, error: logError } = await query;
        if (logError) throw logError;

        const rawLogs = (data || []) as RawLog[];
        const englishState = await fetchEnglishHomeworkState(effectiveFilter === 'all' ? undefined : effectiveFilter);
        let homeworkQuery = homeworkDb
          .from('daily_homework')
          .select('date, class_name, assignments');
        if (effectiveFilter !== 'all') homeworkQuery = homeworkQuery.eq('class_name', effectiveFilter);
        const { data: listedRows, error: listedError } = await homeworkQuery;
        if (listedError) throw listedError;
        const listed = ((listedRows || []) as { date: string; class_name: string; assignments: unknown }[])
          .flatMap((row) => listHomeworkTargets(row.assignments).map((target) => ({
            date: row.date,
            className: row.class_name,
            subject: target.subject,
            item: target.name,
          })));
        for (const log of englishState.logs) {
          for (const [subject, items] of Object.entries(log.missingItems || {})) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
              listed.push({ date: log.logDate, className: log.className, subject, item });
            }
          }
        }

        const detailIndex = new Map<string, SubjectAssignmentMap>();
        for (const row of (listedRows || []) as { date: string; class_name: string; assignments: unknown }[]) {
          detailIndex.set(`${row.date}|${row.class_name}`, parseSubjectAssignments(row.assignments));
        }

        const logIds = rawLogs.map((log) => log.id).filter((id) => id && !id.startsWith('english|'));
        const nextMadeUp = new Set<string>();
        for (let index = 0; index < logIds.length; index += 30) {
          const batch = logIds.slice(index, index + 30);
          const { data: actions, error: actionError } = await homeworkDb
            .from('homework_makeup_actions')
            .select('log_id, subject, item, is_made_up')
            .in('log_id', batch);
          if (actionError) throw actionError;
          const actionRows = (Array.isArray(actions) ? actions : []) as {
            log_id: string;
            subject: string;
            item: string;
            is_made_up: boolean;
          }[];
          for (const action of actionRows) {
            if (action.is_made_up) nextMadeUp.add(makeupKey(action.log_id, action.subject, action.item));
          }
        }

        const appearances = listHomeworkAppearances(
          roster,
          rawLogs.map((log) => ({
            studentId: log.student_id,
            date: log.log_date,
            status: log.status,
            missingItems: log.missing_items,
            logId: log.id,
          })),
          listed,
          englishState.handedInKeys,
          nextMadeUp,
        );
        const nextMarks: Record<string, HomeworkMark> = {};
        for (const row of appearances) {
          nextMarks[markKey(row.studentId, row.date, row.subject, row.item)] = row.mark;
          if (row.submitted) nextMadeUp.add(makeupKey(row.logId, row.subject, row.item));
        }

        if (!cancelled) {
          setLogs(logsFromAppearances(appearances));
          setDetailsByClassDate(detailIndex);
          setMadeUp(nextMadeUp);
          setHandedInKeys(englishState.handedInKeys);
          setMarks(nextMarks);
          setTally(buildMissingTally(roster, appearances));
        }
      } catch (err) {
        console.error('Failed to load missing homework ledger', err);
        if (!cancelled) setError('Could not load missing homework records.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classFilter, isAdmin, user?.id, session?.access_token]);

  const submittedKeys = useMemo(
    () => submittedKeysWithHandedIn(logs, madeUp, handedInKeys),
    [logs, madeUp, handedInKeys],
  );

  const ledger = useMemo(
    () => buildMissingLedger(
      logs,
      submittedKeys,
      ({ date, className, subject, item }) => (
        detailFor(detailsByClassDate.get(`${date}|${className}`), subject, item)
      ),
      undefined,
      ({ studentId, date, subject, item }) => marks[markKey(studentId, date, subject, item)] || 'missing',
    ),
    [logs, submittedKeys, detailsByClassDate, marks],
  );
  const tallyRows = useMemo(() => sortMissingTally(tally, tallyMode), [tally, tallyMode]);
  const missingTotal = tally.reduce((sum, row) => sum + row.missing, 0);
  const unclickedTotal = tally.reduce((sum, row) => sum + row.unclicked, 0);

  const toggleStudent = async (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => {
    const key = makeupKey(student.logId, subject, item);
    const handedIn = !student.submitted;
    setPendingKey(key);
    try {
      const { error: rpcError } = await homeworkDb.rpc('set_english_homework_check', {
        p_class: student.className,
        p_date: date,
        p_subject: subject,
        p_item: item,
        p_detail: detail,
        p_student_id: student.studentId,
        p_handed_in: handedIn,
        p_needs_correction: false,
        p_is_complete: false,
      });
      if (rpcError) throw rpcError;
      setHandedInKeys((current) => {
        const next = new Set(current);
        const id = handedInKey(student.studentId, date, subject, item);
        if (handedIn) next.add(id);
        else next.delete(id);
        return next;
      });
      if (student.mark === 'missing' || student.mark === 'unclicked') {
        const delta = handedIn ? -1 : 1;
        setTally((current) => current.map((row) => {
          if (row.studentId !== student.studentId) return row;
          const count = Math.max(0, row[student.mark] + delta);
          return { ...row, [student.mark]: count };
        }));
      }

      if (parseEnglishCheckLogId(student.logId)) {
        setMadeUp((current) => {
          const next = new Set(current);
          if (handedIn) next.add(key);
          else next.delete(key);
          return next;
        });
        return;
      }

      if (madeUp.has(key) === handedIn) return;
      const { data, error: makeupError } = await homeworkDb.rpc('toggle_homework_makeup', {
        p_log_id: student.logId,
        p_subject: subject,
        p_item: item,
      });
      if (makeupError) throw makeupError;
      setMadeUp((current) => {
        const next = new Set(current);
        if (data?.is_made_up) next.add(key);
        else next.delete(key);
        return next;
      });
    } catch (err) {
      console.error('Failed to update homework submission', err);
      setError('Could not update that student. Try again.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Missing records</h2>
            <p className="text-sm font-medium text-slate-500">
              Dates are columns — nearest to today on the left. Click a red name when that student hands it in.
            </p>
          </div>
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">
            Class
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="mt-1 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 md:w-48"
            >
              {isAdmin && <option value="all">All classes</option>}
              {classes.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 text-xs font-black">
          <span className="rounded-lg bg-white px-2 py-1 text-red-600">Missing</span>
          <span className="rounded-lg bg-red-600 px-2 py-1 text-white">Not clicked</span>
          <span className="rounded-lg bg-yellow-300 px-2 py-1 text-yellow-950">Absent / Exempt</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="animate-spin" />
            Loading records...
          </div>
        ) : ledger.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={40} />
            <p className="text-lg font-black text-emerald-800">No missing homework</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-min items-start gap-4">
              {ledger.map((group) => (
                <DateColumn
                  key={group.date}
                  group={group}
                  focused={group.date === focusDate}
                  pendingKey={pendingKey}
                  onToggle={toggleStudent}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {!isLoading && (
        <MissingTally
          rows={tallyRows}
          mode={tallyMode}
          missingTotal={missingTotal}
          unclickedTotal={unclickedTotal}
          onMode={setTallyMode}
        />
      )}
    </div>
  );
}

function DateColumn({
  group,
  focused,
  pendingKey,
  onToggle,
}: {
  group: LedgerDateGroup;
  focused: boolean;
  pendingKey: string | null;
  onToggle: (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => void;
}) {
  return (
    <section
      className={`w-72 shrink-0 rounded-2xl border border-red-200 bg-white p-4 ${focused ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-red-100 pb-2">
        <AlertCircle size={16} className="shrink-0 text-red-400" />
        <h3 className="text-sm font-black leading-snug text-red-700">{formatLedgerDate(group.date)}</h3>
      </div>
      <div className="space-y-3">
        {group.items.map((item) => (
          <div
            key={`${item.subject}:${item.item}`}
            className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm"
          >
            <p className="mb-2 font-black text-red-700">{itemLabel(item.subject, item.item, item.detail)}</p>
            <ul className="space-y-1">
              {item.students.map((student) => {
                const key = makeupKey(student.logId, item.subject, item.item);
                const label = formatLedgerStudentLabel(student.classNumber, student.name);
                const note = student.mark === 'absent' ? 'ABSENT' : student.mark === 'exempt' ? 'EXEMPT' : '';
                const tone = student.submitted
                  ? 'bg-slate-100 text-slate-400 line-through'
                  : student.mark === 'unclicked'
                    ? 'bg-red-600 text-white'
                    : student.mark === 'absent' || student.mark === 'exempt'
                      ? 'bg-yellow-300 text-yellow-950'
                      : 'bg-white text-red-600';
                if (note) {
                  return (
                    <li key={`${student.logId}:${student.studentId}`}>
                      <div className={`w-full rounded-lg px-2 py-1 text-left text-sm font-bold ${tone}`}>
                        {label} <span className="text-[10px] tracking-wide">{note}</span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={`${student.logId}:${student.studentId}`}>
                    <button
                      type="button"
                      disabled={pendingKey === key}
                      onClick={() => onToggle(student, item.subject, item.item, item.detail, group.date)}
                      className={`w-full rounded-lg px-2 py-1 text-left text-sm font-bold underline-offset-2 hover:underline disabled:opacity-50 ${tone}`}
                      aria-pressed={student.submitted}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissingTally({
  rows,
  mode,
  missingTotal,
  unclickedTotal,
  onMode,
}: {
  rows: TallyStudent[];
  mode: 'count' | 'number';
  missingTotal: number;
  unclickedTotal: number;
  onMode: (mode: 'count' | 'number') => void;
}) {
  return (
    <aside className="flex max-h-[calc(100vh-8rem)] w-full shrink-0 flex-col rounded-3xl border border-orange-100 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:w-80">
      <h2 className="text-lg font-black text-slate-800">Missing tally</h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        The red number is a real missing record. White on red was never clicked. Yellow is Absent or Exempt and is not added to either count. Usernames containing “test” are left out.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-orange-50 p-1">
        <button
          type="button"
          onClick={() => onMode('count')}
          className={`rounded-xl px-2 py-2 text-xs font-black ${mode === 'count' ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-400'}`}
        >
          By missing count
        </button>
        <button
          type="button"
          onClick={() => onMode('number')}
          className={`rounded-xl px-2 py-2 text-xs font-black ${mode === 'number' ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-400'}`}
        >
          By class number
        </button>
      </div>
      <p className="mt-3 text-xs font-black text-slate-400">
        {missingTotal} missing · {unclickedTotal} not clicked
      </p>
      <div className="mt-2 space-y-1 overflow-auto">
        {rows.map((row, index) => {
          const quiet = row.missing + row.unclicked + row.absent + row.exempt === 0;
          return (
            <div key={row.studentId} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 ${quiet ? 'opacity-50' : 'bg-orange-50/60'}`}>
              <span className="grid h-7 place-items-center rounded-lg bg-white text-xs font-black text-orange-800">
                {mode === 'count' ? index + 1 : row.classNumber}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-800">{row.name}</span>
                <span className="block text-[11px] font-bold text-slate-400">Class no. {row.classNumber}</span>
              </span>
              <span className="flex gap-1">
                <span className="grid min-w-7 place-items-center rounded-lg bg-red-50 px-1.5 text-xs font-black text-red-600">{row.missing}</span>
                <span className="grid min-w-7 place-items-center rounded-lg bg-red-600 px-1.5 text-xs font-black text-white">{row.unclicked}</span>
                {row.absent > 0 && <span className="rounded-lg bg-yellow-300 px-1.5 text-[10px] font-black leading-7 text-yellow-950">ABS {row.absent}</span>}
                {row.exempt > 0 && <span className="rounded-lg bg-yellow-300 px-1.5 text-[10px] font-black leading-7 text-yellow-950">EX {row.exempt}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
