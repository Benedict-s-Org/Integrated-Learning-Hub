# Class Staff: Class Dashboard + Homework Management

Approved intent: 2026-11-12 (Hong Kong)

## Goal (what the user sees)

A **Class Assistant** (`class_staff`) can use **Class Dashboard** and **Homework Management** for their assigned classes only, with the same day-to-day tools as an admin on those pages — except school-wide admin tools.

## Decisions already confirmed

1. **Scope:** Managed classes only (from `class_staff_assignments`), not whole school.
2. **Approach:** Scoped staff capability (fix assignment save + unlock page features for staff + keep school-wide ops admin-only).
3. **School-wide ops stay admin-only:** Sync Users, Sync Coin Balances, Edit mode (reorder classes/activities), delete empty class.

## Outcome checklist

When logged in as a Class Assistant assigned to e.g. **4A**:

- [ ] Sees **Class Dashboard** and **Homework Management** in navigation
- [ ] Sees **4A** student list and can use class tools (rewards, toilet break, homework setup, Class Dash link, morning-duty related actions, Homework Management tabs)
- [ ] Does **not** see other classes’ students or “all classes” school-wide homework overview
- [ ] Does **not** see Sync Users / Sync Coin Balances / Edit mode / delete-empty-class
- [ ] True **admin** still sees and can do everything as today
- [ ] Saving “Managed Classes” on a user actually stores assignments so the assistant can see that class after login

## Required backend fix (blocking)

Today the edit-user UI sends `managed_classes`, but `user-management` `update-user` does **not** write `class_staff_assignments`. That is why a newly set 4A Class Assistant sees an empty student list.

Must:

1. Persist `managed_classes` into `class_staff_assignments` on update (activate selected; deactivate removed; clear when role is no longer `class_staff`).
2. Data patch: ensure `4a@superleekam.edu.hk` has active assignment `class_id = '4A'`.

## UI / access changes

### Navigation

- Class Dashboard: already staff-visible — keep.
- Homework Management: show for `isStaff` (desktop + mobile), without opening the full Admin section to class staff.
- Out of scope for this change: Habit Tracker, Makeup, Timetable, Broadcast, Analytics, etc.

### Class Dashboard

| Feature | Class staff | Admin |
|---------|-------------|-------|
| View/manage students in assigned classes | Yes | Yes |
| Rewards, toilet, homework modal, set today/tomorrow homework | Yes | Yes |
| Class Dash link panel | Yes | Yes |
| Sync Users / Sync Coin Balances | No | Yes |
| Edit mode (reorder) / delete empty class | No | Yes |

Class tabs for staff: **assigned classes only**. Empty assignments → clear empty state asking an admin to set managed classes (not “Sync Users”).

### Homework Management

All three tabs usable by class staff, filtered to assigned classes only. Admin keeps “all classes” behaviour.

## Shared rule

`class_staff_assignments.class_id` must match `users.class` for students (exact string). For 4A that is already `4A`. Broader class-name normalization (`3A` vs `3A (2526)`) is **out of scope**.

## Out of scope

- Other admin pages beyond Class Dashboard + Homework Management
- Renaming / merging historical class name variants school-wide
- New permission flags beyond existing `class_staff` + assignments

## Success

4A Class Assistant logs in → sees 4A on Class Dashboard → can run class tools → can open Homework Management for 4A → cannot run school-wide sync/edit tools → admin unchanged.
