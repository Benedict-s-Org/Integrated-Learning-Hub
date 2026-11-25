# Morning Makeup Modal + Activity Logs Homework Tab

**Date:** 2026-11-26  
**Status:** Approved design (awaiting implementation plan)  
**Scope:** Morning homework check-in (class monitor) + User Analytics → Activity Logs → Homework tab

## Problem

Teachers currently chase late homework mainly via Homework Management → Missing ledger (click into each student/item). Morning check-in already records 交齊／欠 for **today**, but does not prompt the student to clear **prior** debt in the same flow. User Analytics → Activity Logs shows practice progress only; daily homework / makeup history is not visible there.

## Goals

1. After a student marks **today** as submitted or missing on the classroom monitor, if they still owe **any prior** homework, show a floating modal listing all outstanding items so the **student** can tick what they brought today and confirm once.
2. Unticked items stay outstanding; confirmed ticks become makeup for **today**.
3. In User Analytics, clicking a student opens Activity Logs with a new **Homework** tab between **Overview** and **Spelling**, showing a **per-day** diary of that morning’s result, that day’s missing items, that day’s makeups, and cumulative outstanding **as of end of that day**.

## Non-goals

- New daily snapshot / diary table (reconstruct from existing sources).
- Replacing Missing Homework ledger (it remains a backup / admin path on the same data).
- Changing English Homework Tracker, Homework Record tabs, or practice Activity Logs tabs.
- Chinese UI copy (all new UI strings stay English).

## Decision

**Reuse existing write path (Approach 1):**

- Morning duty: `upsert_morning_duty_log` + existing item tick sync (`markListedHomeworkHandedIn` / `syncPartialMissingHomeworkTicks`).
- Makeup confirm: same RPCs as Missing ledger — `set_homework_makeup` + `set_english_homework_check` with `p_is_late = true` where applicable; clearing duty `missing_items` stays with current makeup RPC behaviour.
- Analytics Homework tab: client-side (or small shared lib) rebuild of a per-day view from `morning_duty_logs`, `homework_makeup_actions`, and `english_homework_checks` — no new persistence.

## Actors & devices

| Step | Who |
|------|-----|
| Login | Admin or class staff account on classroom monitor |
| Today 交齊／欠 | Student taps own name / actions on the monitor |
| Outstanding makeup modal | Student ticks items and confirms |
| Activity Logs Homework | Staff viewing User Analytics |

## Morning flow

```text
Staff logged in on classroom monitor
  → Student selects self
  → Student chooses Submitted (交齊) or Missing (欠) for TODAY
  → Persist today’s morning_duty_logs (+ today’s tick sync) as today
  → Query ALL still-outstanding prior homework for that student (any past date)
  → If none: close; no modal
  → If some: open MODAL-HOMEWORK-MAKEUP
       → Student multi-selects items brought today
       → Student taps Confirm makeup
       → Persist only selected items as makeup (marked_at = now)
       → Unselected items remain outstanding
  → Done (student homework portion finished)
```

### Outstanding query rules

- Include every prior item still open for that student across **all** past dates (no N-day window).
- **Exclude today’s just-recorded missing items** from this modal in the same session (they are today’s debt, not yet “makeup”).
- Sources aligned with Missing ledger: duty `missing_items` / open English checks not handed in, minus `homework_makeup_actions` where `is_made_up = true`, and any already handed-in late/on-time ticks.
- Group list by original due / log date (oldest first), then subject + item. English labels only.

### Modal behaviour

| Action | Behaviour |
|--------|-----------|
| Open | Only when outstanding prior count &gt; 0 |
| Select | Multi-select; nothing saved until Confirm |
| Confirm | Batch-write selected items; then close modal |
| Cancel / dismiss | No makeup writes; today’s 交齊／欠 already saved stays |
| Empty after filter | Should not open (same as “no outstanding”) |

### Confirm write semantics (per selected item)

For each selected `(original_log_id, subject, item)`:

1. `set_homework_makeup(p_log_id, p_subject, p_item, true)` (or current ledger-equivalent call).
2. Align English check: handed in + late when that item is tracked in `english_homework_checks` (same as Missing ledger click when marking late).
3. Duty `missing_items` cleared for that item via existing makeup RPC side effects.

**Makeup calendar day** for analytics is `marked_at` in the school timezone (Asia/Hong_Kong), **not** `homework_makeup_actions.log_date` (`log_date` = original missing day).

## Activity Logs → Homework tab

### Placement

In `StudentActivityDetail` (Activity Logs drawer / `DRAWER-DETAIL`):

Tab order: **Overview → Homework → Spelling → Proofreading → Memorization → …**

### Per-day row content (newest day first unless existing Activity Logs convention differs — match Overview chronology if one exists; otherwise newest first)

For each date `D` that has any homework signal for the student (duty log, checks, or makeup `marked_at` on `D`):

1. **Morning result** — Submitted vs Missing (from `morning_duty_logs` for `D`). If no duty log that day, show a clear empty/neutral state (e.g. “No morning check-in”), not invented status.
2. **Missing that day** — If missing: list items from that day’s `missing_items` (as recorded for `D`). If submitted: show none / “None”.
3. **Made up that day** — Items with `homework_makeup_actions.is_made_up = true` and `marked_at::date = D` (HK). Show original subject, item, and original `log_date` so staff see *what* was cleared *when*.
4. **Cumulative outstanding as of end of `D`** — All items that were already owed on or before `D` and **not** made up with `marked_at::date <= D` (and not otherwise handed in on or before `D`). Historical: later makeups must **not** rewrite older days’ cumulative lists.

### Example

- Mon: Missing English worksheet A → cumulative end Mon includes A.  
- Tue: Submitted today; makes up A in modal → Tue “Made up” lists A; Tue cumulative no longer includes A; **Mon** cumulative still shows A.

## Data model

No new tables. Use:

| Table / RPC | Role |
|-------------|------|
| `morning_duty_logs` | Today / per-day 交齊／欠 + `missing_items` |
| `english_homework_checks` | Per-item handed_in / is_late |
| `homework_makeup_actions` | Makeup flag; **`marked_at`** = makeup day |
| `set_homework_makeup` | Authoritative makeup write + duty missing clear |
| `set_english_homework_check` | Late hand-in tick alignment |
| `daily_homework` | Optional label enrichment for item names |

### Shared helpers (implementation note)

Prefer extracting “list outstanding for student” and “build per-day homework diary” into `src/lib/homework/` so Morning modal and Activity Logs Homework tab do not diverge from Missing ledger rules.

## UI registry (`data-ui`)

Assign before build; after verified UI, sync bilingual rows in `PersonalOS/docs/SYSTEM_GUIDE.md` (do not duplicate full registry in Learning Hub manifest).

| Code | Surface | Purpose |
|------|---------|---------|
| `MODAL-HOMEWORK-MAKEUP` | Morning outstanding makeup floating modal | Student multi-select + confirm prior debt |
| `LIST-HOMEWORK-OUTSTANDING` | List inside makeup modal | Outstanding items grouped by date |
| `BTN-HOMEWORK-MAKEUP-CONFIRM` | Confirm control on makeup modal | Batch save selected makeups |
| `BTN-HOMEWORK-MAKEUP-CANCEL` | Cancel / dismiss | Close without makeup writes |
| `TAB-ACTIVITY-HOMEWORK` | Activity Logs Homework tab | Daily homework diary for one student |
| `LIST-HOMEWORK-DAILY` | Homework tab day list | Per-day blocks (result / missing / made up / cumulative) |

Reuse existing `DRAWER-DETAIL` for Activity Logs shell; reuse `PANEL-MORNING-DUTIES` / `MODAL-HOMEWORK` for today’s 交齊／欠 entry points without renaming.

## Error handling

- Confirm partial failure: surface English error toast; keep modal open with selection preserved when safe; do not silently mark remaining items.
- Outstanding load failure: English error; do not block today’s already-saved 交齊／欠; offer retry open or skip.
- Activity Logs Homework load failure: tab-level English error empty state; other tabs unaffected.

## Testing / success criteria

1. Student with **no** prior debt: after 交齊 or 欠, **no** makeup modal.  
2. Student with prior debt: modal lists **all** prior open items; today’s new missing (if any) **not** in that list.  
3. Confirm with subset selected: only those become makeup/`is_late` handed-in; rest stay on Missing ledger.  
4. Cancel modal: no makeup rows; prior debt unchanged.  
5. Activity Logs tab order is Overview → Homework → Spelling → …  
6. Homework tab day `D` shows morning result, missing that day, makeups with `marked_at` on `D`, and cumulative outstanding as of end of `D` (Mon example above holds).  
7. Missing ledger still works and stays consistent with modal confirms.  
8. All new UI strings English-only; `data-ui` codes as above.

## Out of scope follow-ups (optional later)

- Snapshot table if staff later need frozen text that ignores reconstruction edge cases.  
- Student-facing history outside admin Activity Logs.  
- Coins / rewards specifically for makeup confirms (not required unless product asks).
