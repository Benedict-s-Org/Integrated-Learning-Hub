# Missing Homework By-student View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a By item / By student switch on Missing Homework, pivoting the existing enriched ledger into student columns per the approved spec, and harden Class Dashboard 交齊功課 so submitted duties clear Missing for that day.

**Architecture:** Pure pivot helper in `missingLedger.ts` builds open/clear student columns from the same enriched `LedgerDateGroup[]` + roster used by By item. `MissingHomeworkLedger` adds a view toggle and a student-column renderer that reuses `toggleStudent` / handbook menu. Guest Class Dashboard morning-duty upsert clears `missing_items` when status is not `missing`; staff paths already call `markListedHomeworkHandedIn`.

**Tech Stack:** React, Vitest, existing `homeworkDb` / makeup RPCs (unchanged).

**Spec:** `docs/superpowers/specs/2026-11-17-missing-homework-by-student-design.md`

## Global Constraints

- UI copy stays English; subject/item names stay as stored data.
- No new DB tables or RPCs for the By-student layout.
- Do not change English Homework Tracker or Homework Record tabs.
- Missing tally maths stay driven by `buildMissingTallyFromLedger`.

## File map

- Modify: `src/lib/homework/missingLedger.ts` — `buildByStudentColumns` (+ types)
- Modify: `src/test/homework/missingLedger.test.ts` — column order, open/clear fold rules, date distance
- Modify: `src/components/admin/homework/MissingHomeworkLedger.tsx` — view switch + student columns
- Modify: `supabase/functions/class-dash/index.ts` — clear `missing_items` when guest morning_duty status ≠ `missing`
- Modify: `src/components/admin/MorningDutiesBoard.tsx` — after guest submitted, still attempt staff-style note if no guest (already staff-only); ensure submitted passes `null` missing items explicitly

---

### Task 1: `buildByStudentColumns` helper + tests

**Files:**
- Modify: `src/lib/homework/missingLedger.ts`
- Test: `src/test/homework/missingLedger.test.ts`

**Interfaces:**
- Consumes: `LedgerDateGroup[]`, roster `{ id, name, classNumber }[]`, `todayIso: string`
- Produces:

```ts
export type ByStudentWorkRow = {
  date: string;
  subject: string;
  item: string;
  detail: string;
  student: LedgerStudent;
  open: boolean; // true = Missing/Not clicked/Absent/Exempt and not handed-in badge
};

export type ByStudentDateBlock = {
  date: string;
  rows: ByStudentWorkRow[];
};

export type ByStudentColumn = {
  studentId: string;
  name: string;
  classNumber: number;
  clear: boolean;
  openDates: ByStudentDateBlock[];  // farther from today first
  doneDates: ByStudentDateBlock[];  // farther from today first
};

export function buildByStudentColumns(
  groups: LedgerDateGroup[],
  roster: Array<{ id: string; name: string; classNumber: number }>,
  todayIso: string,
  isOpenRow: (student: LedgerStudent) => boolean,
): ByStudentColumn[];
```

`isOpenRow` returns true when the row should sit in the open block (mark is missing/unclicked/absent/exempt AND not yet handed-in for display — i.e. `badge === 'missing'` in the UI sense, or for mark-based: `!student.submitted` for missing/absent/exempt, and always for unclicked).

Simpler contract used by UI:

```ts
isOpenRow: (student: LedgerStudent) => boolean
```

UI passes: open if `student.mark === 'unclicked' || ((student.mark === 'missing' || student.mark === 'absent' || student.mark === 'exempt' || !student.mark) && !student.submitted)` — actually By-item treats badge `missing` as open red/yellow/unclicked. Prefer:

```ts
// In helper, classify from LedgerStudent:
function defaultIsOpen(student: LedgerStudent): boolean {
  const mark = student.mark || 'missing';
  if (mark === 'unclicked') return true;
  if (mark === 'absent' || mark === 'exempt' || mark === 'missing') return !student.submitted;
  return false;
}
```

Export `defaultIsOpen` only if tests need it; otherwise keep private and take optional override.

Column rules:
1. Pivot every ledger item student onto that studentId.
2. Group rows by date within open vs done.
3. Sort date blocks by `Math.abs(date - todayIso)` descending (farther first).
4. `clear === openDates` empty (no open rows).
5. Return `[...open sorted by classNumber, ...clear sorted by classNumber]`.
6. Roster students with zero ledger rows appear as clear with empty doneDates.

- [ ] **Step 1: Write failing tests** in `missingLedger.test.ts`:

```ts
describe('buildByStudentColumns', () => {
  it('puts open students left by class number and clear students right collapsed', () => {
    const groups: LedgerDateGroup[] = [
      {
        date: '2026-11-10',
        complete: false,
        items: [{
          subject: '中文', item: '作文', detail: '', complete: false,
          students: [
            { logId: 'a', studentId: 'erin', name: 'Erin', className: '4A', classNumber: 12, submitted: false, mark: 'missing' },
            { logId: 'b', studentId: 'amy', name: 'Amy', className: '4A', classNumber: 1, submitted: true, mark: 'missing' },
          ],
        }],
      },
      {
        date: '2026-11-16',
        complete: false,
        items: [{
          subject: '英文', item: 'WS1', detail: '', complete: false,
          students: [
            { logId: 'c', studentId: 'erin', name: 'Erin', className: '4A', classNumber: 12, submitted: false, mark: 'unclicked' },
          ],
        }],
      },
    ];
    const roster = [
      { id: 'amy', name: 'Amy', classNumber: 1 },
      { id: 'erin', name: 'Erin', classNumber: 12 },
      { id: 'roy', name: 'Roy', classNumber: 25 },
    ];
    const cols = buildByStudentColumns(groups, roster, '2026-11-17');
    expect(cols.map((c) => c.studentId)).toEqual(['erin', 'amy', 'roy']);
    expect(cols[0].clear).toBe(false);
    expect(cols[0].openDates.map((d) => d.date)).toEqual(['2026-11-10', '2026-11-16']); // farther first
    expect(cols[0].openDates[0].rows.map((r) => r.item)).toEqual(['作文']);
    expect(cols[1].clear).toBe(true);
    expect(cols[2].clear).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/test/homework/missingLedger.test.ts` — expect FAIL on `buildByStudentColumns`

- [ ] **Step 3: Implement** `buildByStudentColumns` in `missingLedger.ts`

- [ ] **Step 4: Run tests** — expect PASS

- [ ] **Step 5: Commit** (only if user asked; otherwise leave staged mentally)

---

### Task 2: MissingHomeworkLedger By-student UI

**Files:**
- Modify: `src/components/admin/homework/MissingHomeworkLedger.tsx`

**Interfaces:**
- Consumes: `buildByStudentColumns`, existing `ledger`, `roster`, `toggleStudent`, `badgeFor`, `handbookKeys`, `setMenu`

- [ ] **Step 1: Add state** `viewMode: 'item' | 'student'` default `'item'`

- [ ] **Step 2: Add view switch** under the class/help header (English labels `By item` / `By student`)

- [ ] **Step 3: When `viewMode === 'item'`** keep current date columns

- [ ] **Step 4: When `viewMode === 'student'`** render horizontal student columns:

```tsx
const studentColumns = useMemo(
  () => buildByStudentColumns(ledger, roster, getHKTodayString()),
  [ledger, roster],
);
```

Open columns: expanded card with date labels `formatLedgerDate(date):` then chip buttons (reuse existing student chip styles / onClick → `toggleStudent`, right-click missing → menu). Below: `<details>` Handed in fold for `doneDates`.

Clear columns: `<details>` collapsed by default with summary `▸ {classNumber} {name}`; body shows doneDates (or empty copy).

Empty ledger with roster still shows clear students on the right when view is student — if `ledger.length === 0` today shows emerald empty; for by-student, if all clear, still show collapsed roster columns instead of only empty state when roster.length > 0.

- [ ] **Step 5: Run** `npx vitest run src/test/homework/missingLedger.test.ts`

- [ ] **Step 6: Manual** — user opens Homework Management → Missing → By student (no browser tool)

---

### Task 3: Class Dashboard 交齊 → Missing sync

**Context:** Class Dashboard **does not navigate** to Homework Management. 交齊功課 / 欠功課 write `morning_duty_logs` (+ staff `markListedHomeworkHandedIn`). Missing tab reads those rows. Guest `class-dash` morning_duty upsert currently stores `missing_items` as passed and never ticks english checks.

**Files:**
- Modify: `supabase/functions/class-dash/index.ts` (~450–474)
- Modify: `src/components/admin/MorningDutiesBoard.tsx` (guest submitted path)
- Modify: `src/pages/ClassDashboardPage.tsx` only if guest HomeworkModal path needs the same clear

- [ ] **Step 1: In class-dash morning_duty**, when `status !== 'missing'`, force `missing_items: null`:

```ts
const missingItems = status === "missing"
  ? (payload.p_missing_items || payload.missing_items || null)
  : null;
```

- [ ] **Step 2: MorningDutiesBoard guest submitted** — pass `p_missing_items: null` explicitly; keep staff `markListedHomeworkHandedIn`

- [ ] **Step 3: Document in commit/PR note:** 交齊 only clears **that day’s** listed work + duty; older Missing dates remain until handed in on Missing / English board — this is the usual “I clicked 交齊 but still missing” confusion

---

### Task 4: Verify

- [ ] **Step 1:** `npx vitest run src/test/homework`
- [ ] **Step 2:** `npx tsc -p tsconfig.app.json --noEmit` if available
- [ ] **Step 3:** Summarize Class Dashboard link findings for the user
