# Homework Management navigation

Approved: 2026-10-30 (Hong Kong)

## Goal

One left-bar item opens Homework Management. The main page uses a top tab bar for the three homework surfaces.

## Left bar

- Keep **Homework Management** → `/admin/homework-record`
- Remove **English Homework Tracker** and **Homework Summary** from the admin sidebar

## Top tabs (order)

1. **Missing Homework** → `MissingHomeworkLedger` (`?tab=missing`)
2. **English Homework Tracker** → `EnglishHomeworkBoard` (`?tab=english`)
3. **Homework Record** → embedded `AdminHomeworkRecordPage` (`?tab=record`)

Default tab: Missing Homework.

## Redirects

- `/admin/english-homework` → `/admin/homework-record?tab=english`
- `/admin/homework-summary` → `/admin/homework-record?tab=missing`

## Out of scope

- Rewriting Habit Tracker or Makeup pages
- Changing coin amounts or English check rules
