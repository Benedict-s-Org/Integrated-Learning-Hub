import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { homeworkDb } from '@/lib/homework/client';
import { detailFor, parseSubjectAssignments, type SubjectAssignmentMap } from '@/lib/homework/assignments';
import { fetchEnglishHomeworkState } from '@/lib/homework/englishMissing';
import {
  buildMissingLedger,
  handedInKey,
  makeupKey,
  parseEnglishCheckLogId,
  submittedKeysWithHandedIn,
  type LedgerDateGroup,
  type LedgerStudent,
  type MissingLogInput,
} from '@/lib/homework/missingLedger';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

type RawLog = {
  id: string;
  log_date: string;
  class: string | null;
  student_id: string;
  missing_items: Record<string, string[]> | null;
  student?: {
    display_name: string | null;
    class: string | null;
    class_number: number | string | null;
  } | null;
};

function formatLedgerDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('en-HK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function itemLabel(subject: string, item: string, detail: string): string {
  return [subject, item, detail].filter(Boolean).join(' · ');
}

export function MissingHomeworkLedger() {
  const [searchParams] = useSearchParams();
  const initialClass = searchParams.get('class') || 'all';
  const focusDate = searchParams.get('focusDate');

  const [classFilter, setClassFilter] = useState(initialClass);
  const [classes, setClasses] = useState<string[]>([]);
  const [logs, setLogs] = useState<MissingLogInput[]>([]);
  const [madeUp, setMadeUp] = useState<Set<string>>(new Set());
  const [handedInKeys, setHandedInKeys] = useState<Set<string>>(new Set());
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
        const classNames = [...new Set(((classRows || []) as { class?: string | null }[]).map((row) => row.class).filter((name): name is string => !!name))]
          .filter((name) => !isArchivedClassName(name))
          .sort((a, b) => a.localeCompare(b));
        if (!cancelled) setClasses(classNames);

        let query = homeworkDb
          .from('morning_duty_logs')
          .select('id, log_date, class, student_id, missing_items, student:users(display_name, class, class_number)')
          .not('missing_items', 'is', null);
        if (classFilter !== 'all') query = query.eq('class', classFilter);
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

        const englishState = await fetchEnglishHomeworkState(classFilter === 'all' ? undefined : classFilter);
        const combinedLogs = [...parsedLogs, ...englishState.logs];
        const dates = [...new Set(combinedLogs.map((log) => log.logDate))];
        const detailIndex = new Map<string, SubjectAssignmentMap>();
        if (dates.length > 0) {
          const { data: homeworkRows, error: homeworkError } = await homeworkDb
            .from('daily_homework')
            .select('date, class_name, assignments')
            .in('date', dates);
          if (homeworkError) throw homeworkError;
          const assignmentRows = (Array.isArray(homeworkRows) ? homeworkRows : []) as {
            date: string;
            class_name: string;
            assignments: unknown;
          }[];
          for (const row of assignmentRows) {
            detailIndex.set(`${row.date}|${row.class_name}`, parseSubjectAssignments(row.assignments));
          }
        }

        const logIds = combinedLogs.map((log) => log.id).filter((id) => !id.startsWith('english|'));
        const nextMadeUp = new Set<string>();
        if (logIds.length > 0) {
          const { data: actions, error: actionError } = await homeworkDb
            .from('homework_makeup_actions')
            .select('log_id, subject, item, is_made_up')
            .in('log_id', logIds);
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

        if (!cancelled) {
          setLogs(combinedLogs);
          setDetailsByClassDate(detailIndex);
          setMadeUp(nextMadeUp);
          setHandedInKeys(englishState.handedInKeys);
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
  }, [classFilter]);

  const submittedKeys = useMemo(
    () => submittedKeysWithHandedIn(logs, madeUp, handedInKeys),
    [logs, madeUp, handedInKeys],
  );

  const ledger = useMemo(
    () => buildMissingLedger(logs, submittedKeys, ({ date, className, subject, item }) => (
      detailFor(detailsByClassDate.get(`${date}|${className}`), subject, item)
    )),
    [logs, submittedKeys, detailsByClassDate],
  );

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">Missing records</h2>
          <p className="text-sm font-medium text-slate-500">
            Each line is one homework item. Click a name when that student hands it in.
          </p>
        </div>
        <label className="text-xs font-black uppercase tracking-widest text-slate-400">
          Class
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="mt-1 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 md:w-48"
          >
            <option value="all">All classes</option>
            {classes.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
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
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
          <p className="text-lg font-black text-slate-800">No missing homework</p>
        </div>
      ) : (
        <div className="space-y-8">
          {ledger.map((group, index) => (
            <DateBlock
              key={group.date}
              group={group}
              showClearedDivider={group.complete && (index === 0 || !ledger[index - 1].complete)}
              focused={group.date === focusDate}
              pendingKey={pendingKey}
              onToggle={toggleStudent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DateBlock({
  group,
  showClearedDivider,
  focused,
  pendingKey,
  onToggle,
}: {
  group: LedgerDateGroup;
  showClearedDivider: boolean;
  focused: boolean;
  pendingKey: string | null;
  onToggle: (student: LedgerStudent, subject: string, item: string, detail: string, date: string) => void;
}) {
  return (
    <section className="space-y-3">
      {showClearedDivider && (
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Cleared dates</p>
      )}
      <div className={`rounded-2xl border bg-white p-5 ${group.complete ? 'border-emerald-200' : 'border-slate-200'} ${focused ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="mb-4 flex items-center gap-2">
          {group.complete ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-red-400" />}
          <h3 className={`text-lg font-black ${group.complete ? 'text-emerald-700' : 'text-slate-800'}`}>
            {formatLedgerDate(group.date)}
          </h3>
        </div>
        <div className="space-y-2">
          {group.items.map((item) => (
            <div
              key={`${item.subject}:${item.item}`}
              className={`rounded-xl px-3 py-2 text-sm ${item.complete ? 'bg-emerald-50 text-emerald-800 line-through' : 'bg-slate-50 text-slate-700'}`}
            >
              <span className="font-black">{itemLabel(item.subject, item.item, item.detail)}: </span>
              {item.students.map((student, studentIndex) => {
                const key = makeupKey(student.logId, item.subject, item.item);
                return (
                  <span key={`${student.logId}:${student.studentId}`}>
                    {studentIndex > 0 ? ', ' : ''}
                    <button
                      type="button"
                      disabled={pendingKey === key}
                      onClick={() => onToggle(student, item.subject, item.item, item.detail, group.date)}
                      className={`font-bold underline-offset-2 hover:underline disabled:opacity-50 ${student.submitted ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                      aria-pressed={student.submitted}
                    >
                      {student.name}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
