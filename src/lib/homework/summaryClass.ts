import { parseSubjectAssignments } from '@/lib/homework/assignments';

export type HomeworkClassRow = {
  class_name?: string | null;
  assignments?: unknown;
  updated_at?: string | null;
};

export type SummaryClassRow = {
  name?: string | null;
  is_archived?: boolean | null;
};

export function classesWithAssignments(rows: HomeworkClassRow[]): string[] {
  return [...rows]
    .filter((row) => {
      const name = (row.class_name || '').trim();
      if (!name) return false;
      return Object.keys(parseSubjectAssignments(row.assignments)).length > 0;
    })
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .map((row) => (row.class_name || '').trim())
    .filter((name, index, all) => all.indexOf(name) === index);
}

export function listedSummaryClasses(
  userClasses: Array<string | null | undefined>,
  classRows: SummaryClassRow[],
  classesWithHomework: string[],
  isArchived: (name?: string | null) => boolean = () => false,
): string[] {
  const names = new Set<string>();
  const add = (name?: string | null) => {
    const trimmed = (name || '').trim();
    if (!trimmed || trimmed === 'Unassigned') return;
    if (isArchived(trimmed)) return;
    names.add(trimmed);
  };

  for (const row of classRows) {
    if (row.is_archived) continue;
    add(row.name);
  }
  userClasses.forEach(add);
  classesWithHomework.forEach(add);

  return [...names].sort((a, b) => a.localeCompare(b, 'en'));
}

/** Prefer a requested class, then the class that actually has homework for the date. */
export function pickSummaryClass(
  classes: string[],
  classesWithHomework: string[],
  preferred?: string | null,
): string {
  const requested = (preferred || '').trim();
  if (requested && classes.includes(requested)) return requested;
  const withWork = classesWithHomework.find((name) => classes.includes(name));
  if (withWork) return withWork;
  return classes[0] || '';
}
