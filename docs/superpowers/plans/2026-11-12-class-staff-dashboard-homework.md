# Class Staff Dashboard + Homework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Class assistants can use Class Dashboard and Homework Management for their assigned classes only; school-wide sync/edit tools stay admin-only; managed-class assignments actually persist.

**Architecture:** Persist `managed_classes` into `class_staff_assignments` in `user-management`. Add a small frontend helper to load assigned class names. Gate Class Dashboard class-scoped UI with `isStaff`, keep school-wide ops on `isAdmin`, filter class lists for staff. Expose Homework Management in nav for staff and filter homework boards to assigned classes.

**Tech Stack:** Supabase Edge Function (`user-management`), React + AuthContext (`isStaff` / `isAdmin`), existing homework boards.

**Spec:** `docs/superpowers/specs/2026-11-12-class-staff-dashboard-homework-design.md`

## Global Constraints

- Class staff scope = exact `class_staff_assignments.class_id` match to `users.class`
- School-wide ops stay admin-only: Sync Users, Sync Coin Balances, Edit mode, delete empty class
- Out of scope: Habit Tracker, Makeup, Timetable, Broadcast, class-name normalization school-wide
- UI copy in product surfaces remains English where newly added

---

### Task 1: Persist managed_classes + patch 4A assignment

**Files:**
- Modify: `supabase/functions/user-management/index.ts` (`update-user` action)
- Data: SQL upsert for `4a@superleekam.edu.hk` → `4A`

**Interfaces:**
- Consumes: request body `managed_classes?: string[]`, `role?: string`, `userId`
- Produces: rows in `class_staff_assignments` with `(staff_user_id, class_id, is_active)`

- [ ] **Step 1: After successful `users` update in `update-user`, sync assignments**

When `managed_classes` is an array OR `role` is provided:

```ts
const finalRole = role !== undefined ? role : updatedUser.role;
if (finalRole === 'class_staff' && Array.isArray(managed_classes)) {
  const desired = [...new Set(managed_classes.filter(Boolean))];
  const { data: existing } = await supabase
    .from('class_staff_assignments')
    .select('id, class_id, is_active')
    .eq('staff_user_id', userId);
  const existingMap = new Map((existing || []).map((r: any) => [r.class_id, r]));
  for (const classId of desired) {
    const row = existingMap.get(classId);
    if (row) {
      if (!row.is_active) {
        await supabase.from('class_staff_assignments').update({ is_active: true }).eq('id', row.id);
      }
    } else {
      await supabase.from('class_staff_assignments').insert({
        staff_user_id: userId,
        class_id: classId,
        is_active: true,
      });
    }
  }
  for (const row of existing || []) {
    if (!desired.includes(row.class_id) && row.is_active) {
      await supabase.from('class_staff_assignments').update({ is_active: false }).eq('id', row.id);
    }
  }
} else if (role !== undefined && role !== 'class_staff') {
  await supabase.from('class_staff_assignments').update({ is_active: false }).eq('staff_user_id', userId);
}
```

Place this **before** the success response return (after auth update is fine).

- [ ] **Step 2: Deploy / ensure edge function change is live** (local source of truth; deploy if project uses remote functions)

- [ ] **Step 3: Data patch via Supabase SQL**

```sql
INSERT INTO public.class_staff_assignments (staff_user_id, class_id, is_active)
VALUES ('4acfbfb3-4dfc-4c26-a005-1c5d59a0c62b', '4A', true)
ON CONFLICT (staff_user_id, class_id)
DO UPDATE SET is_active = true;
```

- [ ] **Step 4: Verify**

```sql
SELECT staff_user_id, class_id, is_active
FROM public.class_staff_assignments
WHERE staff_user_id = '4acfbfb3-4dfc-4c26-a005-1c5d59a0c62b';
```

Expected: one row `4A`, `is_active = true`.

---

### Task 2: Frontend helper for managed classes

**Files:**
- Create: `src/lib/staff/managedClasses.ts`
- Test: `src/test/staff/managedClasses.test.ts` (pure filter helpers)

**Interfaces:**
- Produces:
  - `fetchManagedClassIds(userId: string, accessToken?: string): Promise<string[]>`
  - `filterToManagedClasses<T extends { name: string }>(items: T[], managed: string[] | null, isAdmin: boolean): T[]`
  - `isClassManaged(className: string, managed: string[] | null, isAdmin: boolean): boolean`

- [ ] **Step 1: Write failing tests for filter helpers**

```ts
import { describe, expect, it } from 'vitest';
import { filterToManagedClasses, isClassManaged } from '@/lib/staff/managedClasses';

describe('managedClasses helpers', () => {
  it('admin sees all classes', () => {
    const items = [{ name: '4A' }, { name: '3A' }];
    expect(filterToManagedClasses(items, ['4A'], true).map((i) => i.name)).toEqual(['4A', '3A']);
  });

  it('staff sees only managed classes', () => {
    const items = [{ name: '4A' }, { name: '3A' }];
    expect(filterToManagedClasses(items, ['4A'], false).map((i) => i.name)).toEqual(['4A']);
  });

  it('staff with empty assignments sees none', () => {
    expect(filterToManagedClasses([{ name: '4A' }], [], false)).toEqual([]);
  });

  it('isClassManaged allows admin any class', () => {
    expect(isClassManaged('3A', ['4A'], true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `npx vitest run src/test/staff/managedClasses.test.ts`

- [ ] **Step 3: Implement helper**

```ts
import { supabase } from '@/integrations/supabase/client';

export function isClassManaged(className: string, managed: string[] | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!managed) return false;
  return managed.includes(className);
}

export function filterToManagedClasses<T extends { name: string }>(
  items: T[],
  managed: string[] | null,
  isAdmin: boolean
): T[] {
  if (isAdmin) return items;
  if (!managed || managed.length === 0) return [];
  const set = new Set(managed);
  return items.filter((item) => set.has(item.name));
}

export async function fetchManagedClassIds(userId: string, accessToken?: string): Promise<string[]> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data, error } = await supabase.functions.invoke('user-management/get-staff-assignments', {
    headers: {
      Authorization: `Bearer ${accessToken || anonKey}`,
      apikey: anonKey,
    },
    body: { userId },
  });
  if (error) throw error;
  return (data?.assignments as string[]) || [];
}
```

- [ ] **Step 4: Run tests — expect pass**

---

### Task 3: Class Dashboard staff gates + class filter

**Files:**
- Modify: `src/pages/ClassDashboardPage.tsx`

**Interfaces:**
- Consumes: `fetchManagedClassIds`, `filterToManagedClasses`, `isClassManaged`
- Keeps `isAdmin` for Sync Users, Sync Coin Balances, Edit mode UI, delete empty class

- [ ] **Step 1: Load managed classes when `isStaff && !isAdmin`**

On mount / when `currentUser.id` changes, call `fetchManagedClassIds` and store in state `managedClassIds: string[] | null` (`null` = admin / unrestricted).

- [ ] **Step 2: When setting `orderedClasses`, filter for staff**

After building `classData`, set:

```ts
setOrderedClasses(filterToManagedClasses(classData, isAdmin ? null : managedClassIds, !!isAdmin));
```

Also filter which keys appear in class view for staff (only managed + activities still OK if needed — activities view unchanged for YAGNI unless it leaks other-class students; student list already comes from scoped `list-users`).

- [ ] **Step 3: Unlock class-scoped admin UI for staff**

Change these from `isAdmin` to `isStaff` (or `isStaff && !isGuest`):
- Set Tomorrow's Homework button
- `ClassDashLinkPanel` wrapper
- Test-class controls (if present)

Keep `isAdmin` for:
- Sync Users (toolbar + empty state)
- Sync Coin Balances
- Edit mode toolbar
- Delete empty class banner

- [ ] **Step 4: Empty assignment state**

If `isStaff && !isAdmin && managedClassIds?.length === 0`, show English empty state: "No managed classes assigned. Ask an admin to set Managed Classes for your account." Do not show Sync Users.

---

### Task 4: Homework Management nav + class scoping

**Files:**
- Modify: `src/components/UnifiedNavigation/UnifiedNavigation.tsx`
- Modify: `src/components/UnifiedNavigation/MobileMoreSheet.tsx`
- Modify: `src/components/admin/homework/EnglishHomeworkBoard.tsx`
- Modify: `src/components/admin/homework/MissingHomeworkLedger.tsx`
- Modify: `src/pages/AdminHomeworkRecordPage.tsx` (if it has a class picker listing all classes)

**Interfaces:**
- Consumes: `fetchManagedClassIds`, AuthContext `isAdmin` / `isStaff` / `user` / `session`

- [ ] **Step 1: Nav — Homework Management for staff**

Desktop: move or duplicate Homework Management item so `isStaff && !isUserView` can see it (e.g. under Teacher Administration or a small Teaching & Records block for staff), without exposing full Admin section.

Mobile: if `isStaff && !isAdmin && !isUserView`, add a section with Class Dashboard + Homework Management only.

- [ ] **Step 2: EnglishHomeworkBoard + MissingHomeworkLedger**

Load managed classes for non-admin staff; filter `classes` list; default `classFilter` to first managed class; hide/disable `all` option for staff.

- [ ] **Step 3: AdminHomeworkRecordPage**

If class dropdown exists, apply same managed-class filter for staff.

- [ ] **Step 4: Manual verify**

- Staff nav shows Homework Management
- Boards only list assigned classes

---

### Task 5: Smoke verification

- [ ] Confirm DB assignment for 4A staff
- [ ] Confirm `update-user` path writes assignments (code review + optional invoke)
- [ ] Confirm Class Dashboard gates in code match spec table
- [ ] Confirm Homework nav + filters for staff

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Persist managed_classes | Task 1 |
| Patch 4A assignment | Task 1 |
| Class Dashboard feature gates | Task 3 |
| Class tabs scoped | Task 2 + 3 |
| Homework nav for staff | Task 4 |
| Homework filtered to managed | Task 4 |
| Admin school-wide ops remain | Task 3 |
| Out of scope pages untouched | Tasks avoid them |
