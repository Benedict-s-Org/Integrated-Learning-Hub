# Missing Homework date columns

Approved: 2026-11-10 (Hong Kong)

## Goal

On Homework Management → Missing Homework, show each open date as a vertical column (nearest to today on the left). List students under each homework item with class number first. Hide fully submitted items and dates. Keep red / gray / green status colours.

## Scope

In scope:

- `MissingHomeworkLedger` layout and colours
- Ledger filtering / date sort helpers used by that tab
- Matching class-number prefix on open missing announcements that reuse the same student labels

Out of scope:

- English Homework Tracker board
- Homework Record tab
- Makeup page rewrite
- Database or RPC changes

## Layout

- One column per **open** date (a date that still has at least one incomplete homework item).
- Columns sit in a horizontal row and may scroll sideways when many dates exist.
- **Nearest calendar date to today is leftmost**; farther dates go right. Sort open dates by absolute distance to today’s Hong Kong calendar date ascending; ties keep ISO date ascending.
- Inside a column: homework items stack vertically. Under each item, students stack vertically (not comma-separated on one line).
- Item label stays `Subject · Item`, plus ` · detail` when pages/chapter detail exists.

## Student labels

- Display format: `{classNumber} {name}` (example: `1 Abby`).
- Ordering inside an item is unchanged: class name, then class number, then name.
- Clicking a name still toggles handed-in / makeup the same way as today.

## Colours (unchanged meaning)

| State | Meaning | Visual |
|---|---|---|
| Missing (欠交) | Student has not handed in | Red treatment (same idea as Makeup chips / open date alert) |
| Late / made up (遲交) | Student marked handed in after being missing | Gray + strikethrough |
| Complete (交齊) | Every student on the item (or date) has handed in | Green treatment |

Because complete items and dates are removed from the page (see Hide rules), the Missing Homework tab normally shows only red (still missing) and gray (handed in / late) states. Green remains the complete-state colour in shared styling and for the empty “No missing homework” success view when nothing open remains.

## Hide rules

- If every student on a homework item is submitted → **do not render that item**.
- If a date has no remaining incomplete items → **do not render that date column**.
- Remove the “Cleared dates” section; cleared work no longer appears on this tab.

## Data / helpers

- Prefer filtering open items in the ledger builder or a small pure helper so the UI only receives what it should show.
- Announcement helpers that list open missing students should use the same `{classNumber} {name}` label when they surface names.

## Testing

- Unit tests: open-only filtering; date column order (nearest to a fixed “today” first); student label includes class number.
- Manual: Missing Homework tab shows columns left→right by nearness to today; clicking a name grays it; last open name on an item hides the item; last item on a date hides the column.

## Out of scope reminder

No change to English check rules, coin rewards, or Class Dashboard homework setup.
