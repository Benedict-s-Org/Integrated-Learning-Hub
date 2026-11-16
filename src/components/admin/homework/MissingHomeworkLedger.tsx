import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homeworkDb } from '@/lib/homework/client';
import { detailFor, listHomeworkTargets, parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { PREFERRED_DEFAULT_CLASS } from '@/constants/classDefaults';
import { fetchEnglishHomeworkState } from '@/lib/homework/englishMissing';
import { handbookName, homeworkBadge, type HomeworkBadge } from '@/lib/homework/homeworkBadges';
import {
  attachHandedInClassmates,
  buildMissingLedger,
  buildMissingTallyFromLedger,
  enrichLedgerWithDutyMarks,
  mergeDutyMissingItems,
  formatLedgerStudentLabel,
  handedInKey,
  listHomeworkAppearances,
  makeupKey,
  openLedgerColumns,
  parseEnglishCheckLogId,
  sortMissingTally,
  submittedKeysWithHandedIn,
  type HandedInRosterEntry,
  type HomeworkAppearance,
  type LedgerDateGroup,
  type LedgerStudent,
  type MissingLogInput,
  type TallyStudent,
} from '@/lib/homework/missingLedger';
import { fetchManagedClassIds, filterClassNameList } from '@/lib/staff/managedClasses';
import { isArchivedClassName } from '@/utils/archiveClassExporter';
import { getHKTodayString } from '@/utils/dateUtils';

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

function formatLedgerDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('en-HK', {
    weekday: 'short',
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
  const initialClass = searchParams.get('class') || PREFERRED_DEFAULT_CLASS;
  const focusDate = searchParams.get('focusDate');

  const [classFilter, setClassFilter] = useState(initialClass);
  const [classes, setClasses] = useState<string[]>([]);
  const [logs, setLogs] = useState<MissingLogInput[]>([]);
  const [madeUp, setMadeUp] = useState<Set<string>>(new Set());
  const [handedInKeys, setHandedInKeys] = useState<Set<string>>(new Set());
  const [lateKeys, setLateKeys] = useState<Set<string>>(new Set());
  const [handedInRoster, setHandedInRoster] = useState<HandedInRosterEntry[]>([]);
  const [handbookKeys, setHandbookKeys] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; student: LedgerStudent; date: string } | null>(null);
  const [roster, setRoster] = useState<Array<{ id: string; name: string; classNumber: number; username?: string | null }>>([]);
  const [tallyMode, setTallyMode] = useState<'count' | 'number'>('count');
  const [appearances, setAppearances] = useState<HomeworkAppearance[]>([]);
  const [detailsByClassDate, setDetailsByClassDate] = useState<Map<string, SubjectAssignmentMap>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inFlightKeys = useRef(new Set<string>());

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
            setLateKeys(new Set());
            setHandedInRoster([]);
            setHandbookKeys(new Set());
            setRoster([]);
            setAppearances([]);
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
        const parsedLogs: MissingLogInput[] = rawLogs
          .filter((log) => log.missing_items && Object.keys(log.missing_items).length > 0)
          .map((log) => ({
            id: log.id,
            logDate: log.log_date,
            className: log.class || log.student?.class || '',
            studentId: log.student_id,
            studentName: log.student?.display_name || 'Unknown',
            classNumber: Number(log.student?.class_number) || 0,
            missingItems: log.missing_items || {},
          }));

        const englishState = await fetchEnglishHomeworkState(effectiveFilter === 'all' ? undefined : effectiveFilter);
        const combinedLogs = [...parsedLogs, ...englishState.logs];
        const detailIndex = new Map<string, SubjectAssignmentMap>();
        let homeworkQuery = homeworkDb
          .from('daily_homework')
          .select('date, class_name, assignments');
        if (effectiveFilter !== 'all') homeworkQuery = homeworkQuery.eq('class_name', effectiveFilter);
        const { data: homeworkRows, error: homeworkError } = await homeworkQuery;
        if (homeworkError) throw homeworkError;
        const assignmentRows = (Array.isArray(homeworkRows) ? homeworkRows : []) as {
          date: string;
          class_name: string;
          assignments: unknown;
        }[];
        for (const row of assignmentRows) {
          detailIndex.set(`${row.date}|${row.class_name}`, parseSubjectAssignments(row.assignments));
        }

        const listed = assignmentRows.flatMap((row) => (
          listHomeworkTargets(row.assignments).map((target) => ({
            date: row.date,
            className: row.class_name,
            subject: target.subject,
            item: target.name,
          }))
        ));
        for (const log of englishState.logs) {
          for (const [subject, items] of Object.entries(log.missingItems || {})) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
              listed.push({ date: log.logDate, className: log.className, subject, item });
            }
          }
        }

        const logIds = [
          ...combinedLogs.map((log) => log.id),
          ...rawLogs.map((log) => log.id),
        ].filter((id, index, all) => id && !id.startsWith('english|') && all.indexOf(id) === index);
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

        let handbookQuery = homeworkDb
          .from('homework_handbook_marks')
          .select('student_id, record_date');
        if (effectiveFilter !== 'all') handbookQuery = handbookQuery.eq('class_name', effectiveFilter);
        const { data: handbookRows, error: handbookError } = await handbookQuery;
        if (handbookError) throw handbookError;
        const nextHandbook = new Set<string>();
        for (const row of (Array.isArray(handbookRows) ? handbookRows : []) as { student_id: string; record_date: string }[]) {
          nextHandbook.add(`${row.student_id}|${row.record_date}`);
        }

        const appearances = listHomeworkAppearances(
          roster,
          mergeDutyMissingItems(
            rawLogs.map((log) => ({
              studentId: log.student_id,
              date: log.log_date,
              status: log.status,
              missingItems: log.missing_items,
              logId: log.id,
            })),
            englishState.logs.map((log) => ({
              studentId: log.studentId,
              date: log.logDate,
              missingItems: log.missingItems,
              logId: log.id,
            })),
          ),
          listed,
          englishState.handedInKeys,
          nextMadeUp,
        );

        if (!cancelled) {
          setLogs(combinedLogs);
          setDetailsByClassDate(detailIndex);
          setMadeUp(nextMadeUp);
          setHandedInKeys(englishState.handedInKeys);
          setLateKeys(englishState.lateKeys);
          setHandedInRoster(englishState.handedInRoster);
          setHandbookKeys(nextHandbook);
          setRoster(roster);
          setAppearances(appearances);
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

  const ledger = useMemo(() => {
    const today = getHKTodayString();
    const grouped = attachHandedInClassmates(
      buildMissingLedger(logs, submittedKeys, ({ date, className, subject, item }) => (
        detailFor(detailsByClassDate.get(`${date}|${className}`), subject, item)
      ), today),
      handedInRoster,
    );
    const withBadges = grouped.map((group) => {
      const items = group.items.map((item) => {
        const students = item.students.map((student) => {
          const id = handedInKey(student.studentId, group.date, item.subject, item.item);
          const badge = homeworkBadge({
            onTime: handedInKeys.has(id) && !lateKeys.has(id),
            late: lateKeys.has(id),
            makeup: submittedKeys.has(makeupKey(student.logId, item.subject, item.item)),
          });
          return { ...student, submitted: badge !== 'missing' };
        });
        return {
          ...item,
          students,
          complete: students.length > 0 && students.every((student) => student.submitted),
        };
      });
      return {
        ...group,
        items,
        complete: items.length > 0 && items.every((item) => item.complete),
      };
    });
    return enrichLedgerWithDutyMarks(
      openLedgerColumns(withBadges, today),
      appearances,
      ({ date, className, subject, item }) => (
        detailFor(detailsByClassDate.get(`${date}|${className}`), subject, item)
      ),
      today,
    );
  }, [logs, submittedKeys, detailsByClassDate, handedInRoster, handedInKeys, lateKeys, appearances]);
  const tally = useMemo(() => buildMissingTallyFromLedger(roster, ledger), [roster, ledger]);
  const tallyRows = useMemo(() => sortMissingTally(tally, tallyMode), [tally, tallyMode]);
  const missingTotal = tally.reduce((sum, row) => sum + row.missing, 0);
  const unclickedTotal = tally.reduce((sum, row) => sum + row.unclicked, 0);

  const badgeFor = (student: LedgerStudent, subject: string, item: string, date: string): HomeworkBadge => {
    const id = handedInKey(student.studentId, date, subject, item);
    return homeworkBadge({
      onTime: handedInKeys.has(id) && !lateKeys.has(id),
      late: lateKeys.has(id),
      makeup: madeUp.has(makeupKey(student.logId, subject, item)),
    });
  };

  const toggleStudent = async (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => {
    const key = makeupKey(student.logId, subject, item);
    if (inFlightKeys.current.has(key) || pendingKey === key) return;

    if (student.mark === 'absent') return;

    const checkId = handedInKey(student.studentId, date, subject, item);
    const tallyField = student.mark === 'unclicked' ? 'unclicked' : 'missing';
    const openTone = badgeFor(student, subject, item, date) === 'missing';
    const markingLate = tallyField === 'missing' && openTone;
    const handedIn = markingLate || (tallyField === 'unclicked' && !student.submitted);
    const prevHandedIn = handedInKeys.has(checkId);
    const prevLate = lateKeys.has(checkId);
    const prevMadeUp = madeUp.has(key);

    inFlightKeys.current.add(key);
    setPendingKey(key);
    setError('');

    // Optimistic UI so a slow round-trip does not invite a second click.
    setHandedInKeys((current) => {
      const next = new Set(current);
      if (handedIn) next.add(checkId);
      else next.delete(checkId);
      return next;
    });
    setLateKeys((current) => {
      const next = new Set(current);
      if (markingLate) next.add(checkId);
      else next.delete(checkId);
      return next;
    });
    setMadeUp((current) => {
      const next = new Set(current);
      if (handedIn) next.add(key);
      else next.delete(key);
      return next;
    });
    setAppearances((current) => current.map((row) => {
      if (row.studentId !== student.studentId || row.date !== date || row.subject !== subject || row.item !== item) {
        return row;
      }
      if (tallyField === 'unclicked' && handedIn) return { ...row, mark: 'missing', submitted: true };
      return { ...row, submitted: handedIn };
    }));

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
        p_is_late: markingLate,
      });
      if (rpcError) throw rpcError;

      if (parseEnglishCheckLogId(student.logId)) return;

      const { error: makeupError } = await homeworkDb.rpc('set_homework_makeup', {
        p_log_id: student.logId,
        p_subject: subject,
        p_item: item,
        p_is_made_up: handedIn,
      });
      if (makeupError) throw makeupError;
    } catch (err) {
      console.error('Failed to update homework submission', err);
      setHandedInKeys((current) => {
        const next = new Set(current);
        if (prevHandedIn) next.add(checkId);
        else next.delete(checkId);
        return next;
      });
      setLateKeys((current) => {
        const next = new Set(current);
        if (prevLate) next.add(checkId);
        else next.delete(checkId);
        return next;
      });
      setMadeUp((current) => {
        const next = new Set(current);
        if (prevMadeUp) next.add(key);
        else next.delete(key);
        return next;
      });
      setAppearances((current) => current.map((row) => {
        if (row.studentId !== student.studentId || row.date !== date || row.subject !== subject || row.item !== item) {
          return row;
        }
        return { ...row, mark: student.mark || 'missing', submitted: student.submitted };
      }));
      setError('Could not update that student. Try again.');
    } finally {
      inFlightKeys.current.delete(key);
      setPendingKey(null);
    }
  };

  const toggleHandbook = async (student: LedgerStudent, date: string) => {
    const id = `${student.studentId}|${date}`;
    const written = !handbookKeys.has(id);
    setMenu(null);
    setPendingKey(id);
    try {
      const { error: rpcError } = await homeworkDb.rpc('set_homework_handbook', {
        p_class: student.className,
        p_date: date,
        p_student_id: student.studentId,
        p_written: written,
      });
      if (rpcError) throw rpcError;
      setHandbookKeys((current) => {
        const next = new Set(current);
        if (written) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (err) {
      console.error('Failed to update handbook mark', err);
      setError('Could not update the handbook mark. Try again.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch">
      <div className="flex min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Missing records</h2>
            <p className="text-sm font-medium text-slate-500">
              Dates are columns — nearest to today on the left. Click a red name once to mark late hand-in (it moves into Handed in). Click EXEMPT to mark that work handed in the same way. Expand Handed in to undo. Right-click a red name to record a handbook for today. Absent stays locked.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <Legend tone="missing" label="Missing" />
              <Legend tone="on_time" label="Handed in" />
              <Legend tone="late" label="Late" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-600 bg-red-600 px-2.5 py-1 text-white">Not clicked</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300 bg-yellow-300 px-2.5 py-1 text-yellow-950">Absent / Exempt</span>
            </div>
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

        {error && (
          <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="animate-spin" />
            Loading records...
          </div>
        ) : ledger.length === 0 ? (
          <div className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={40} />
            <p className="text-lg font-black text-emerald-800">No missing homework</p>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
            <div className="flex w-max max-w-none items-start gap-2 pb-1">
              {ledger.map((group) => (
                <DateColumn
                  key={group.date}
                  group={group}
                  focused={group.date === focusDate}
                  pendingKey={pendingKey}
                  today={getHKTodayString()}
                  badgeFor={badgeFor}
                  handbookKeys={handbookKeys}
                  onToggle={toggleStudent}
                  onMenu={setMenu}
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
      {menu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close handbook menu"
            onClick={() => setMenu(null)}
          />
          <button
            type="button"
            className="fixed z-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-800 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
            onClick={() => toggleHandbook(menu.student, menu.date)}
          >
            {handbookKeys.has(`${menu.student.studentId}|${menu.date}`) ? 'Undo handbook' : 'Mark handbook written'}
          </button>
        </>
      )}
    </div>
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
    <aside className="flex h-full max-h-[calc(100dvh-8rem)] w-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden rounded-3xl border border-orange-100 bg-white p-4 shadow-sm xl:max-h-none xl:w-full">
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

function Legend({ tone, label }: { tone: HomeworkBadge; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${badgeClass(tone)}`}>
      <span className={`h-2 w-2 rounded-full ${dotClass(tone)}`} />
      {label}
    </span>
  );
}

function badgeClass(tone: HomeworkBadge): string {
  if (tone === 'on_time') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'late') return 'border-slate-300 bg-slate-100 text-slate-600';
  return 'border-red-200 bg-red-50 text-red-700';
}

function dotClass(tone: HomeworkBadge): string {
  if (tone === 'on_time') return 'bg-emerald-500';
  if (tone === 'late') return 'bg-slate-400';
  return 'bg-red-500';
}

function DateColumn({
  group,
  focused,
  pendingKey,
  today,
  badgeFor,
  handbookKeys,
  onToggle,
  onMenu,
}: {
  group: LedgerDateGroup;
  focused: boolean;
  pendingKey: string | null;
  today: string;
  badgeFor: (student: LedgerStudent, subject: string, item: string, date: string) => HomeworkBadge;
  handbookKeys: Set<string>;
  onToggle: (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => void;
  onMenu: (menu: { x: number; y: number; student: LedgerStudent; date: string } | null) => void;
}) {
  return (
    <section
      className={`w-40 shrink-0 rounded-xl border border-red-200 bg-white p-2 ${focused ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="mb-2 flex items-start gap-1 border-b border-red-100 pb-1.5">
        <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
        <h3 className="text-[11px] font-black leading-snug text-red-700">{formatLedgerDate(group.date)}</h3>
      </div>
      <div className="space-y-2">
        {group.items.map((item) => (
          <div
            key={`${item.subject}:${item.item}`}
            className="rounded-lg border border-red-100 bg-red-50/40 px-1.5 py-1.5 text-xs"
          >
            <p className="mb-1.5 font-black leading-snug text-slate-800">{itemLabel(item.subject, item.item, item.detail)}</p>
            <StudentColumn
              students={item.students.filter((student) => {
                const mark = student.mark || 'missing';
                if (mark === 'absent' || mark === 'unclicked') return true;
                if (mark === 'exempt') return badgeFor(student, item.subject, item.item, group.date) === 'missing';
                return badgeFor(student, item.subject, item.item, group.date) === 'missing';
              })}
              emptyLabel="Nobody missing"
              groupDate={group.date}
              today={today}
              subject={item.subject}
              itemName={item.item}
              detail={item.detail}
              pendingKey={pendingKey}
              badgeFor={badgeFor}
              handbookKeys={handbookKeys}
              onToggle={onToggle}
              onMenu={onMenu}
            />
            <HandedInFold
              students={item.students
                .filter((student) => {
                  const mark = student.mark || 'missing';
                  if (mark === 'absent' || mark === 'unclicked') return false;
                  if (mark === 'exempt') return badgeFor(student, item.subject, item.item, group.date) !== 'missing';
                  return badgeFor(student, item.subject, item.item, group.date) !== 'missing';
                })
                .sort((a, b) => {
                  const rank = (student: LedgerStudent) => (
                    badgeFor(student, item.subject, item.item, group.date) === 'on_time' ? 0 : 1
                  );
                  return rank(a) - rank(b) || a.classNumber - b.classNumber || a.name.localeCompare(b.name);
                })}
              groupDate={group.date}
              today={today}
              subject={item.subject}
              itemName={item.item}
              detail={item.detail}
              pendingKey={pendingKey}
              badgeFor={badgeFor}
              handbookKeys={handbookKeys}
              onToggle={onToggle}
              onMenu={onMenu}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function HandedInFold({
  students,
  groupDate,
  today,
  subject,
  itemName,
  detail,
  pendingKey,
  badgeFor,
  handbookKeys,
  onToggle,
  onMenu,
}: {
  students: LedgerStudent[];
  groupDate: string;
  today: string;
  subject: string;
  itemName: string;
  detail: string;
  pendingKey: string | null;
  badgeFor: (student: LedgerStudent, subject: string, item: string, date: string) => HomeworkBadge;
  handbookKeys: Set<string>;
  onToggle: (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => void;
  onMenu: (menu: { x: number; y: number; student: LedgerStudent; date: string } | null) => void;
}) {
  if (students.length === 0) return null;
  const onTimeCount = students.filter((student) => badgeFor(student, subject, itemName, groupDate) === 'on_time').length;
  const lateCount = students.length - onTimeCount;
  const summaryParts = [
    onTimeCount > 0 ? `${onTimeCount} handed in` : null,
    lateCount > 0 ? `${lateCount} late` : null,
  ].filter(Boolean);
  return (
    <details className="group mt-1.5 rounded-md border border-slate-200 bg-white/80 open:bg-slate-50">
      <summary className="cursor-pointer list-none px-1.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">▸</span>
          {summaryParts.join(' · ') || 'Handed in'}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-0.5 pb-1 pt-1">
        <StudentColumn
          students={students}
          emptyLabel=""
          groupDate={groupDate}
          today={today}
          subject={subject}
          itemName={itemName}
          detail={detail}
          pendingKey={pendingKey}
          badgeFor={badgeFor}
          handbookKeys={handbookKeys}
          onToggle={onToggle}
          onMenu={onMenu}
        />
      </div>
    </details>
  );
}

function StudentColumn({
  students,
  emptyLabel,
  groupDate,
  today,
  subject,
  itemName,
  detail,
  pendingKey,
  badgeFor,
  handbookKeys,
  onToggle,
  onMenu,
}: {
  students: LedgerStudent[];
  emptyLabel: string;
  groupDate: string;
  today: string;
  subject: string;
  itemName: string;
  detail: string;
  pendingKey: string | null;
  badgeFor: (student: LedgerStudent, subject: string, item: string, date: string) => HomeworkBadge;
  handbookKeys: Set<string>;
  onToggle: (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => void;
  onMenu: (menu: { x: number; y: number; student: LedgerStudent; date: string } | null) => void;
}) {
  if (students.length === 0) {
    return <p className="text-xs font-semibold text-slate-400">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {students.map((student) => {
        const mark = student.mark || 'missing';
        const tone = badgeFor(student, subject, itemName, groupDate);
        const key = makeupKey(student.logId, subject, itemName);
        const marked = handbookKeys.has(`${student.studentId}|${groupDate}`);
        const label = handbookName(
          formatLedgerStudentLabel(student.classNumber, student.name),
          groupDate,
          today,
          marked,
        );
        if (mark === 'absent') {
          return (
            <li key={`${student.logId}:${student.studentId}`}>
              <div className="inline-flex w-full items-start gap-1 rounded-md border border-yellow-300 bg-yellow-300 px-1.5 py-1 text-left text-[11px] font-bold leading-snug text-yellow-950">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-700" />
                <span className="min-w-0 break-words">
                  {label}{' '}
                  <span className="text-[9px] tracking-wide">ABSENT</span>
                </span>
              </div>
            </li>
          );
        }
        if (mark === 'exempt' && tone === 'missing') {
          return (
            <li key={`${student.logId}:${student.studentId}`}>
              <button
                type="button"
                disabled={pendingKey === key}
                aria-pressed={false}
                onClick={() => onToggle(student, subject, itemName, detail, groupDate)}
                className="inline-flex w-full items-start gap-1 rounded-md border border-yellow-300 bg-yellow-300 px-1.5 py-1 text-left text-[11px] font-bold leading-snug text-yellow-950 disabled:opacity-50"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-700" />
                <span className="min-w-0 break-words">
                  {label}{' '}
                  <span className="text-[9px] tracking-wide">EXEMPT</span>
                </span>
              </button>
            </li>
          );
        }
        if (mark === 'unclicked') {
          return (
            <li key={`${student.logId}:${student.studentId}`}>
              <button
                type="button"
                disabled={pendingKey === key}
                aria-pressed={student.submitted}
                onClick={() => onToggle(student, subject, itemName, detail, groupDate)}
                className="inline-flex w-full items-start gap-1 rounded-md border border-red-700 bg-red-600 px-1.5 py-1 text-left text-[11px] font-bold leading-snug text-white disabled:opacity-50"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                <span className="min-w-0 break-words">{label}</span>
              </button>
            </li>
          );
        }
        return (
          <li key={`${student.logId}:${student.studentId}`}>
            <button
              type="button"
              disabled={pendingKey === key}
              aria-pressed={tone !== 'missing'}
              onClick={() => onToggle(student, subject, itemName, detail, groupDate)}
              onContextMenu={(event) => {
                if (tone !== 'missing' && !marked) return;
                event.preventDefault();
                onMenu({ x: event.clientX, y: event.clientY, student, date: groupDate });
              }}
              className={`inline-flex w-full items-start gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] font-bold leading-snug disabled:opacity-50 ${badgeClass(tone)}`}
            >
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(tone)}`} />
              <span className="min-w-0 break-words">{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
