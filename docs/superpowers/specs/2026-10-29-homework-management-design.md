# Homework Management Design

Date: 2026-10-29

## Goal

Replace the admin Homework Record screen with one Homework Management page at `/admin/homework-record`. The page has three parts. Class Dashboard setup for today and tomorrow stores a pages, chapter, or range note beside each homework item.

All new interface text is English. Subject names and item names stay as they are stored (`英文`, `WS1`, and so on) because they are data.

## Page

`/admin/homework-record` renders `AdminHomeworkManagementPage` inside the existing admin layout. Tabs, also available as `?tab=`:

1. `missing` — Missing records (default)
2. `english` — English homework
3. `settings` — Settings, including the previous homework record form

The nav label becomes Homework Management. `/admin/homework-makeup` stays available. The missing-homework broadcast opens the missing tab. `/admin/english-homework` stays as the older materials and follow-up tracker, linked from Settings.

## Part 1 — Missing records

Source of truth: `morning_duty_logs.missing_items` plus `homework_makeup_actions.is_made_up`.

Display, earliest open date at the top:

```
Date
Homework item: Student 1, Student 2, Student 3
```

An item label is `Subject · Item`, plus ` · pages` when that class and date stored a detail. Students in a row are ordered by class, then class number, then name.

Clicking a name calls `toggle_homework_makeup` and crosses that name out. Clicking again clears it. When every name on an item is crossed, the whole row is green and crossed. When every item on a date is crossed, that date moves below every date that still has an open item. Open dates sort earliest first. Cleared dates also sort earliest first, after the open dates.

## Part 2 — English homework

A database-style board of English work assigned from Class Dashboard (`今日功課設定` / `設定明日功課`), not the static `english_materials` catalogue.

Two groupings:

- By date: each date, then each English item assigned that day, then the students in that class.
- By homework item: the same item name and the same pages or chapter stay together across dates.

Each student row has three checkboxes:

| Column | Meaning |
|---|---|
| Handed in | The student handed the work in |
| Correction | The work needs correction |
| Complete | The work is finished |

Rules:

- Turning on Correction or Complete also turns on Handed in.
- Turning off Handed in turns off Correction and Complete.
- Complete can be on without Correction. Accepted work does not have to be marked for correction.
- Turning off Correction does not turn off Complete.

Rows are generated from every saved `daily_homework` row for subject `英文` or `English`, crossed with current students in that class (`users.role = 'user'`). Checks persist in `english_homework_checks` through `set_english_homework_check`. The page note is part of the row identity, so editing the pages or chapter starts a fresh set of checkboxes. The older English tracker is unchanged.

Default date order is earliest first. A control switches to newest first.

## Part 3 — Settings

The existing bulk homework record form (class, subject, page or exercise number, students, problem options, coin record) renders inside this tab without a second admin shell. Links sit above it: Habit Tracker, Homework Summary, Legacy English Tracker, Missing Homework Makeup.

## Pages and chapters

`daily_homework.assignments` remains jsonb. New saves use:

```json
{ "英文": [{ "name": "WS1", "detail": "p.12-15" }] }
```

Readers accept the old `{ "英文": ["WS1"] }` shape. Name-only saves, including morning-duty setup, keep a previously stored detail for the same subject and item. A setup save that sends detail objects can clear a detail by saving an empty string.

The text box appears in the Class Dashboard homework modal while setting today's or tomorrow's homework, beside each selected item. Placeholder: `Pages, chapter, or range`.

Morning duty missing-item pickers still use item names only. `toNameMap` supplies that list so existing boards do not read objects as names.

## Out of scope

- Rewriting habit tracking, homework summary, or the legacy English follow-up queue.
- Changing coin amounts for missing homework.
- Translating stored subject names.
