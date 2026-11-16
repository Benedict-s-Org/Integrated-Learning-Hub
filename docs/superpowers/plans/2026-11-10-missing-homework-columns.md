# Missing Homework date columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Missing Homework as date columns (nearest to today leftmost), student labels like `1 Abby`, hide completed items/dates, keep red/gray/green status colours.

**Architecture:** Pure helpers in `missingLedger.ts` filter open items, sort dates by distance to HK today, and format student labels. `MissingHomeworkLedger` renders horizontal date columns. Announcements reuse the same label helper.

**Tech Stack:** React, Vitest, existing `homeworkDb` / makeup RPC (unchanged).

**Spec:** `docs/superpowers/specs/2026-11-10-missing-homework-columns-design.md`

## Global Constraints

- UI copy stays English; subject/item names stay as stored data.
- No DB or RPC changes.
- Do not change English Homework Tracker or Homework Record tabs.

## File map

- Modify: `src/lib/homework/missingLedger.ts` — open-only filter, nearest-date sort, label helper
- Modify: `src/test/homework/missingLedger.test.ts` — cover new behaviours
- Modify: `src/components/admin/homework/MissingHomeworkLedger.tsx` — column UI + colours

---

### Task 1: Ledger helpers (open-only, nearest date, labels)

**Files:**
- Modify: `src/lib/homework/missingLedger.ts`
- Test: `src/test/homework/missingLedger.test.ts`

**Interfaces:**
- Produces: `formatLedgerStudentLabel(classNumber: number, name: string): string`
- Produces: `buildMissingLedger(..., todayIso?: string)` returns only incomplete items/dates, sorted nearest-to-`todayIso` first
- Produces: `openMissingAnnouncement` uses `formatLedgerStudentLabel` for names

- [x] **Step 1: Write failing tests** for label format, open-only (no cleared dates/items), nearest-to-today column order, announcement labels with class numbers

- [x] **Step 2: Run** `npx vitest run src/test/homework/missingLedger.test.ts` — expect FAIL

- [x] **Step 3: Implement helpers** in `missingLedger.ts` (default `todayIso` via `getHKTodayString`)

- [x] **Step 4: Run tests** — expect PASS

- [x] **Step 5: Commit** skipped until user asks

---

### Task 2: Column UI

**Files:**
- Modify: `src/components/admin/homework/MissingHomeworkLedger.tsx`

**Interfaces:**
- Consumes: open-only ledger from `buildMissingLedger`; `formatLedgerStudentLabel`

- [x] **Step 1: Replace stacked `DateBlock` list** with horizontal scroll of date columns
- [x] **Step 2: Vertical student buttons** under each item; colours — missing red, submitted gray+strikethrough; remove Cleared dates section
- [x] **Step 3: Run** `npx vitest run src/test/homework/missingLedger.test.ts`
- [ ] **Step 4: Manual check** Missing Homework tab (user verifies UI)

---

### Task 3: Verify

- [x] **Step 1: Run** `npx vitest run src/test/homework`
- [x] **Step 2: Run** `npx tsc -p tsconfig.app.json --noEmit` if project uses it for this area
