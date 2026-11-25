import { makeupKey } from '@/lib/homework/missingLedger';

export type HomeworkDiaryDay = {
  date: string;
  morningStatus: 'submitted' | 'missing' | 'absent' | 'exempted' | 'late' | 'todo' | 'none';
  missingThatDay: Array<{ subject: string; item: string }>;
  madeUpThatDay: Array<{
    subject: string;
    item: string;
    originalLogDate: string;
  }>;
  cumulativeOutstanding: Array<{
    subject: string;
    item: string;
    originalLogDate: string;
    logId: string;
  }>;
};

type DutyLogRow = {
  id: string;
  log_date: string;
  status: string;
  missing_items: Record<string, string[]> | null;
};

type MakeupActionRow = {
  log_id: string;
  log_date: string;
  subject: string;
  item: string;
  is_made_up: boolean;
  marked_at: string;
};

type HandInRow = {
  logDate: string;
  subject: string;
  item: string;
  handedIn: boolean;
  isLate: boolean;
  updatedOnIso?: string;
};

type OwedItem = {
  logId: string;
  originalLogDate: string;
  subject: string;
  item: string;
};

const MORNING_STATUSES = [
  'submitted',
  'missing',
  'absent',
  'exempted',
  'late',
  'todo',
] as const;

function hkCalendarDayFromIso(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
}

function morningStatusFromDuty(status: string): HomeworkDiaryDay['morningStatus'] {
  const s = (status || '').trim().toLowerCase();
  if ((MORNING_STATUSES as readonly string[]).includes(s)) {
    return s as (typeof MORNING_STATUSES)[number];
  }
  return 'todo';
}

function flattenMissingItems(
  missing_items: Record<string, string[]> | null,
): Array<{ subject: string; item: string }> {
  if (!missing_items) return [];
  const out: Array<{ subject: string; item: string }> = [];
  for (const [subject, rawItems] of Object.entries(missing_items)) {
    if (!Array.isArray(rawItems)) continue;
    for (const raw of rawItems) {
      const item = typeof raw === 'string' ? raw.trim() : '';
      if (item) out.push({ subject, item });
    }
  }
  return out;
}

function collectOwedFromDutyLogs(dutyLogs: DutyLogRow[]): OwedItem[] {
  const owed: OwedItem[] = [];
  for (const log of dutyLogs) {
    for (const { subject, item } of flattenMissingItems(log.missing_items)) {
      owed.push({
        logId: log.id,
        originalLogDate: log.log_date,
        subject,
        item,
      });
    }
  }
  return owed;
}

function cumulativeForDay(
  day: string,
  allOwed: OwedItem[],
  makeupActions: MakeupActionRow[],
  handIns: HandInRow[] | undefined,
): HomeworkDiaryDay['cumulativeOutstanding'] {
  const clearedMakeup = new Set<string>();
  for (const action of makeupActions) {
    if (!action.is_made_up) continue;
    const markedDay = hkCalendarDayFromIso(action.marked_at);
    if (markedDay <= day) {
      clearedMakeup.add(makeupKey(action.log_id, action.subject, action.item));
    }
  }

  const clearedHandIn = new Set<string>();
  for (const handIn of handIns ?? []) {
    if (!handIn.handedIn) continue;
    const clearDay = handIn.updatedOnIso
      ? hkCalendarDayFromIso(handIn.updatedOnIso)
      : handIn.logDate;
    if (clearDay <= day) {
      clearedHandIn.add(`${handIn.logDate}\0${handIn.subject}\0${handIn.item}`);
    }
  }

  return allOwed
    .filter((o) => o.originalLogDate <= day)
    .filter((o) => !clearedMakeup.has(makeupKey(o.logId, o.subject, o.item)))
    .filter(
      (o) => !clearedHandIn.has(`${o.originalLogDate}\0${o.subject}\0${o.item}`),
    )
    .map((o) => ({
      subject: o.subject,
      item: o.item,
      originalLogDate: o.originalLogDate,
      logId: o.logId,
    }));
}

export function buildHomeworkDiary(args: {
  dutyLogs: DutyLogRow[];
  makeupActions: MakeupActionRow[];
  handIns?: HandInRow[];
}): HomeworkDiaryDay[] {
  const { dutyLogs, makeupActions, handIns } = args;

  const dutyByDate = new Map<string, DutyLogRow>();
  for (const log of dutyLogs) {
    dutyByDate.set(log.log_date, log);
  }

  const allOwed = collectOwedFromDutyLogs(dutyLogs);

  const dateSet = new Set<string>();
  for (const log of dutyLogs) {
    dateSet.add(log.log_date);
  }
  for (const action of makeupActions) {
    if (action.marked_at) {
      dateSet.add(hkCalendarDayFromIso(action.marked_at));
    }
  }

  const sortedDates = [...dateSet].sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => {
    const duty = dutyByDate.get(date);
    const morningStatus = duty ? morningStatusFromDuty(duty.status) : 'none';
    const missingThatDay = duty ? flattenMissingItems(duty.missing_items) : [];

    const madeUpThatDay = makeupActions
      .filter((a) => a.is_made_up && hkCalendarDayFromIso(a.marked_at) === date)
      .map((a) => ({
        subject: a.subject,
        item: a.item,
        originalLogDate: a.log_date,
      }));

    const cumulativeOutstanding = cumulativeForDay(date, allOwed, makeupActions, handIns);

    return {
      date,
      morningStatus,
      missingThatDay,
      madeUpThatDay,
      cumulativeOutstanding,
    };
  });
}