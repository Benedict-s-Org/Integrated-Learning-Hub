# Missing Homework — By Student View

**Date:** 2026-11-17  
**Status:** Approved for preview; implementation after spec review  
**Scope:** Homework Management → Missing Homework tab only

## Problem

Missing Homework today is **by homework item** (date columns → items → student names). Teachers also need a **by student** scan: who still owes work, what’s open for each pupil, with handed-in classmates out of the way on the right.

## Decision

Add a view switch on Missing Homework:

- **By item** — existing date/item columns (unchanged behaviour)
- **By student** — new horizontal student columns (this spec)

Same data sources as today’s ledger (morning duties, English checks, daily homework list, makeup / handed-in keys). Same click / right-click behaviours where a row is actionable.

## By student layout

### Column order (left → right)

1. **Open students** (still have at least one Missing / Not clicked / Absent / Exempt row)  
   - Sorted by **class number ascending** (small → large)  
   - Columns **expanded** by default
2. **Clear students** (no open rows left — fully handed in for the visible set)  
   - Sorted by **class number ascending**  
   - Columns **fully collapsed** by default (one fold strip each, e.g. `▸ 12 Erin`)

Horizontal scroll applies only to the student-column strip; scrollbar stays in the visible pane (same containment rules as the current Missing layout). Missing tally can remain on the right.

### Inside an open (left) student column

**Open block (top, expanded)** — only:

- Missing  
- Not clicked  
- Absent  
- Exempt  

**Date order:** farther from today first (older / more distant dates on top); nearer dates below.

**Row format:**

```text
日期:
ICON 科目+功課
日期:
ICON 科目+功課
```

- One date heading, then one or more `ICON + subject + homework` lines for that date  
- ICON / colour follows existing legend (Missing red, Not clicked solid red, Absent/Exempt yellow)

**Handed-in block (below open block)** — folded by default (`Handed in` / late / on-time), same date grouping when expanded.

### Inside a clear (right) student column

- Default: **whole student folded** — no open list visible  
- Expanding shows mainly handed-in history for that student (same date + ICON format)  
- If they gain open work again after undo, they move back to the left group

## Interactions

| Action | Behaviour |
|--------|-----------|
| Click Missing / Not clicked / Exempt / Absent (when clickable) | Same as By item: mark handed in / undo rules |
| Right-click Missing | Handbook (unchanged) |
| Expand clear student on the right | Show folded content for that student only |
| Toggle By item / By student | Preserve class filter and tally; rebuild layout from same ledger |

English UI only for all labels, toggles, empty states.

## Out of scope

- New database tables or RPCs  
- Changing English Homework Tracker or Homework Record tabs  
- Changing Missing tally maths (still driven by the same enriched ledger)

## Preview

Static mock: repo-root `preview.html` — full Homework Management shell with By item / By student switch and sample 4A data.

## Success criteria

1. Teacher can switch to By student and scroll students horizontally without page-level sideways scroll.  
2. Open students are left (class no. ascending); fully clear students are right and collapsed.  
3. Open lists show only Missing / Not clicked / ABS / EX, oldest-distance dates on top.  
4. Format matches `日期:` then `ICON 科目+功課` lines.  
5. Preview.html demonstrates the layout before React implementation.
