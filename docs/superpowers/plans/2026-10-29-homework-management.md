# Homework Management Implementation Plan

> Spec: `docs/superpowers/specs/2026-10-29-homework-management-design.md`

**Goal:** Turn `/admin/homework-record` into Homework Management with missing records, an English checkbox board, settings that keep the old record form, and a pages or chapter box on Class Dashboard setup.

**Architecture:** Pure helpers in `src/lib/homework` own parsing, ledger order, and checkbox rules. The page composes three panels. `daily_homework.assignments` stays jsonb and accepts both string lists and `{ name, detail }` objects. English checks are a new table written only through `set_english_homework_check`.

## Stage 1 — Missing records and pages

- `src/lib/homework/assignments.ts` parses both assignment shapes and preserves details on name-only saves.
- `src/lib/homework/missingLedger.ts` groups logs into date, then item, then names. Open dates stay above cleared dates.
- `HomeworkModal` shows `Pages, chapter, or range` beside each selected setup item.
- Class Dashboard stores the object shape. Morning duty still receives names via `toNameMap`.
- `MissingHomeworkLedger` is the first tab. Clicking a name calls `toggle_homework_makeup`.

## Stage 2 — English homework board

- Migration `supabase/migrations/20261029120000_english_homework_checks.sql`.
- `src/lib/homework/englishWork.ts` lists English items from daily homework and applies checkbox rules.
- `EnglishHomeworkBoard` groups by date or by item and renders Handed in, Correction, and Complete.

## Stage 3 — Settings

- `AdminHomeworkManagementPage` hosts the three tabs.
- `AdminHomeworkRecordPage` accepts `embedded` so the old form sits in Settings without a second admin shell.
- Nav label is Homework Management. The missing-homework broadcast opens `?tab=missing`.

## Tests

```bash
npx vitest run src/test/homework
npx tsc -p tsconfig.app.json --noEmit
```

Apply `20261029120000_english_homework_checks.sql` before using the English tab against a live database.
