export type HomeworkItem = {
  name: string;
  detail: string;
};

export type SubjectAssignmentMap = Record<string, HomeworkItem[]>;

export function parseSubjectAssignments(raw: unknown): SubjectAssignmentMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out: SubjectAssignmentMap = {};
  for (const [subject, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const items: HomeworkItem[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (name) items.push({ name, detail: '' });
        continue;
      }
      if (entry && typeof entry === 'object') {
        const record = entry as { name?: unknown; detail?: unknown };
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        if (!name) continue;
        const detail = typeof record.detail === 'string' ? record.detail.trim() : '';
        items.push({ name, detail });
      }
    }
    if (items.length > 0) out[subject] = items;
  }
  return out;
}

export function listHomeworkTargets(raw: unknown): { subject: string; name: string; detail: string }[] {
  return Object.entries(parseSubjectAssignments(raw)).flatMap(([subject, items]) => (
    items.map((item) => ({ subject, name: item.name, detail: item.detail }))
  ));
}

export function toNameMap(map: SubjectAssignmentMap | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!map) return out;
  for (const [subject, items] of Object.entries(map)) {
    const names = items.map((item) => item.name).filter(Boolean);
    if (names.length > 0) out[subject] = names;
  }
  return out;
}

export function toNameMapsByClass(
  maps: Record<string, SubjectAssignmentMap>,
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const [className, assignments] of Object.entries(maps)) {
    out[className] = toNameMap(assignments);
  }
  return out;
}

export function detailRecord(map: SubjectAssignmentMap): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [subject, items] of Object.entries(map)) {
    out[subject] = {};
    for (const item of items) out[subject][item.name] = item.detail;
  }
  return out;
}

export function detailFor(
  map: SubjectAssignmentMap | undefined,
  subject: string,
  name: string,
): string {
  return map?.[subject]?.find((item) => item.name === name)?.detail ?? '';
}

function rawHasDetailObjects(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return Object.values(raw as Record<string, unknown>).some(
    (value) => Array.isArray(value) && value.some((entry) => !!entry && typeof entry === 'object'),
  );
}

export function preserveDetails(
  previous: SubjectAssignmentMap | undefined,
  incoming: SubjectAssignmentMap,
): SubjectAssignmentMap {
  if (!previous) return incoming;
  const out: SubjectAssignmentMap = {};
  for (const [subject, items] of Object.entries(incoming)) {
    const prior = previous[subject] || [];
    out[subject] = items.map((item) => {
      if (item.detail) return item;
      const match = prior.find((old) => old.name === item.name);
      return match?.detail ? { name: item.name, detail: match.detail } : item;
    });
  }
  return out;
}

/**
 * Name-only saves (morning-duty setup) keep pages already stored for the same item.
 * A save that includes detail objects replaces the class list, including a cleared text box.
 */
export function saveAssignments(
  previous: SubjectAssignmentMap | undefined,
  raw: unknown,
): SubjectAssignmentMap {
  const incoming = parseSubjectAssignments(raw);
  if (rawHasDetailObjects(raw)) return incoming;
  return preserveDetails(previous, incoming);
}

export function buildAssignments(
  selected: Record<string, string[]>,
  details: Record<string, Record<string, string>>,
): SubjectAssignmentMap {
  const out: SubjectAssignmentMap = {};
  for (const [subject, names] of Object.entries(selected)) {
    const items = names
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, detail: (details[subject]?.[name] ?? '').trim() }));
    if (items.length > 0) out[subject] = items;
  }
  return out;
}
