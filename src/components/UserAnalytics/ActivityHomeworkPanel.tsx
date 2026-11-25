import { useEffect, useMemo, useState } from 'react';
import { Loader2, CalendarDays } from 'lucide-react';
import { homeworkDb } from '@/lib/homework/client';
import {
  buildHomeworkDiary,
  type HomeworkDiaryDay,
} from '@/lib/homework/homeworkDiary';

export type ActivityHomeworkPanelProps = {
  userId: string;
  className?: string;
};

const LOG_ID_BATCH = 30;

function morningStatusLabel(status: HomeworkDiaryDay['morningStatus']): string {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'missing':
      return 'Missing';
    case 'absent':
      return 'Absent';
    case 'exempted':
      return 'Exempted';
    case 'late':
      return 'Late';
    case 'todo':
      return 'Pending';
    case 'none':
    default:
      return 'No morning check-in';
  }
}

function morningStatusTone(status: HomeworkDiaryDay['morningStatus']): string {
  switch (status) {
    case 'submitted':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'missing':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'absent':
      return 'text-slate-600 bg-slate-100 border-slate-200';
    case 'exempted':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'late':
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'todo':
      return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    case 'none':
    default:
      return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

function formatDiaryDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function ItemList({
  items,
  showOriginalDate,
}: {
  items: Array<{ subject: string; item: string; originalLogDate?: string }>;
  showOriginalDate?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 italic">None</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((row, idx) => (
        <li key={`${row.subject}-${row.item}-${idx}`} className="flex flex-wrap gap-x-2">
          <span className="font-medium text-slate-800">{row.subject}</span>
          <span className="text-slate-500">·</span>
          <span>{row.item}</span>
          {showOriginalDate && row.originalLogDate && (
            <span className="text-xs text-slate-400">
              (from {row.originalLogDate})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function DayCard({ day }: { day: HomeworkDiaryDay }) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <CalendarDays size={16} className="text-slate-400" />
          {formatDiaryDate(day.date)}
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${morningStatusTone(day.morningStatus)}`}
        >
          Morning: {morningStatusLabel(day.morningStatus)}
        </span>
      </div>
      <div className="px-5 py-4 space-y-4">
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Missing that day
          </h4>
          <ItemList items={day.missingThatDay} />
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Made up that day
          </h4>
          <ItemList items={day.madeUpThatDay} showOriginalDate />
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Still outstanding (end of day)
          </h4>
          <ItemList
            items={day.cumulativeOutstanding.map((row) => ({
              subject: row.subject,
              item: row.item,
              originalLogDate: row.originalLogDate,
            }))}
            showOriginalDate
          />
        </section>
      </div>
    </article>
  );
}

export function ActivityHomeworkPanel({ userId, className }: ActivityHomeworkPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<HomeworkDiaryDay[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let dutyQuery = homeworkDb
          .from('morning_duty_logs')
          .select('id, log_date, status, missing_items')
          .eq('student_id', userId);
        if (className) {
          dutyQuery = dutyQuery.eq('class', className);
        }
        const { data: dutyRows, error: dutyError } = await dutyQuery;
        if (dutyError) throw new Error(dutyError.message);

        const dutyLogs = (Array.isArray(dutyRows) ? dutyRows : []) as {
          id: string;
          log_date: string;
          status: string;
          missing_items: Record<string, string[]> | null;
        }[];

        const logIds = dutyLogs
          .map((log) => log.id)
          .filter((id) => id && !id.startsWith('english|'));

        const makeupActions: {
          log_id: string;
          log_date: string;
          subject: string;
          item: string;
          is_made_up: boolean;
          marked_at: string;
        }[] = [];

        for (let index = 0; index < logIds.length; index += LOG_ID_BATCH) {
          const batch = logIds.slice(index, index + LOG_ID_BATCH);
          const { data: actionRows, error: actionError } = await homeworkDb
            .from('homework_makeup_actions')
            .select('log_id, log_date, subject, item, is_made_up, marked_at')
            .in('log_id', batch);
          if (actionError) throw new Error(actionError.message);
          for (const row of (Array.isArray(actionRows) ? actionRows : []) as typeof makeupActions) {
            makeupActions.push(row);
          }
        }

        const { data: checkRows, error: checkError } = await homeworkDb
          .from('english_homework_checks')
          .select('record_date, subject, item_name, handed_in, is_late, updated_at')
          .eq('student_id', userId);
        if (checkError) throw new Error(checkError.message);

        const handIns = (
          Array.isArray(checkRows) ? checkRows : []
        ).map(
          (row: {
            record_date: string;
            subject: string;
            item_name: string;
            handed_in: boolean;
            is_late?: boolean | null;
            updated_at?: string | null;
          }) => ({
            logDate: row.record_date,
            subject: row.subject,
            item: row.item_name,
            handedIn: row.handed_in,
            isLate: Boolean(row.is_late),
            updatedOnIso: row.updated_at ?? undefined,
          }),
        );

        const diary = buildHomeworkDiary({
          dutyLogs,
          makeupActions,
          handIns,
        });

        if (!cancelled) setDays(diary);
      } catch (err) {
        console.error('[ActivityHomeworkPanel] load failed', err);
        if (!cancelled) {
          setError('Could not load homework diary. Check your connection and try again.');
          setDays([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, className]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-48 space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading homework diary...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center py-12 px-4 text-rose-700 bg-white rounded-xl border border-rose-200 border-dashed">
          {error}
        </div>
      );
    }
    if (days.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
          No homework activity found for this student.
        </div>
      );
    }
    return (
      <div className="space-y-4" data-ui="LIST-HOMEWORK-DAILY">
        {days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
    );
  }, [loading, error, days]);

  return <div className="space-y-4">{content}</div>;
}