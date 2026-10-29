import { parseSubjectAssignments } from './assignments';

export type EnglishCheck = {
  handedIn: boolean;
  correction: boolean;
  complete: boolean;
};

export type EnglishCheckField = keyof EnglishCheck;

export const EMPTY_ENGLISH_CHECK: EnglishCheck = {
  handedIn: false,
  correction: false,
  complete: false,
};

const ENGLISH_SUBJECTS = new Set(['英文', 'english']);

export function isEnglishSubject(subject: string): boolean {
  return ENGLISH_SUBJECTS.has(subject.trim().toLowerCase()) || subject.trim() === '英文';
}

export function nextEnglishCheck(
  current: EnglishCheck,
  field: EnglishCheckField,
  value: boolean,
): EnglishCheck {
  const next: EnglishCheck = { ...current, [field]: value };
  if (field === 'complete' && value) next.handedIn = true;
  if (field === 'correction' && value) next.handedIn = true;
  if (!next.handedIn) {
    next.correction = false;
    next.complete = false;
  }
  return next;
}

export type EnglishWorkCell = {
  date: string;
  className: string;
  subject: string;
  name: string;
  detail: string;
};

export function listEnglishWork(
  rows: { date: string; className: string; assignments: unknown }[],
): EnglishWorkCell[] {
  const cells: EnglishWorkCell[] = [];
  for (const row of rows) {
    const parsed = parseSubjectAssignments(row.assignments);
    for (const [subject, items] of Object.entries(parsed)) {
      if (!isEnglishSubject(subject)) continue;
      for (const item of items) {
        cells.push({
          date: row.date,
          className: row.className,
          subject,
          name: item.name,
          detail: item.detail,
        });
      }
    }
  }
  return cells;
}

export type EnglishDateGroup = {
  date: string;
  works: EnglishWorkCell[];
};

export function groupWorkByDate(cells: EnglishWorkCell[], order: 'asc' | 'desc'): EnglishDateGroup[] {
  const map = new Map<string, EnglishWorkCell[]>();
  for (const cell of cells) {
    const list = map.get(cell.date) ?? [];
    list.push(cell);
    map.set(cell.date, list);
  }
  const dates = [...map.keys()].sort((a, b) => (order === 'asc' ? a.localeCompare(b) : b.localeCompare(a)));
  return dates.map((date) => ({
    date,
    works: (map.get(date) ?? []).slice().sort(compareWork),
  }));
}

export type EnglishItemGroup = {
  key: string;
  subject: string;
  name: string;
  detail: string;
  works: EnglishWorkCell[];
};

export function groupWorkByItem(cells: EnglishWorkCell[]): EnglishItemGroup[] {
  const map = new Map<string, EnglishItemGroup>();
  for (const cell of cells) {
    const key = `${cell.subject}\0${cell.name}\0${cell.detail}`;
    const existing = map.get(key);
    if (existing) {
      existing.works.push(cell);
    } else {
      map.set(key, {
        key,
        subject: cell.subject,
        name: cell.name,
        detail: cell.detail,
        works: [cell],
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.detail.localeCompare(b.detail) || a.subject.localeCompare(b.subject))
    .map((group) => ({
      ...group,
      works: group.works.slice().sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className)),
    }));
}

function compareWork(a: EnglishWorkCell, b: EnglishWorkCell): number {
  return a.className.localeCompare(b.className)
    || a.name.localeCompare(b.name)
    || a.detail.localeCompare(b.detail);
}

export function englishCheckKey(cell: Pick<EnglishWorkCell, 'className' | 'date' | 'subject' | 'name' | 'detail'>, studentId: string): string {
  return [cell.className, cell.date, cell.subject, cell.name, cell.detail, studentId].join('\0');
}
