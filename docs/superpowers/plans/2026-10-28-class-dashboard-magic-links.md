# Class Dashboard Magic Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each active class a secret `/class-dash/<token>` URL that opens a navigation-locked Class Dashboard without login during Mon–Fri 07:30–15:30 HKT, with immediate writes proxied through Edge Functions.

**Architecture:** Rebuild `shared_links` for class-dashboard tokens. Admins manage links from Class Dashboard. Guests hit a dedicated route that validates the token, then render Class Dashboard in guest mode. Reads/writes go through a `class-dash` Edge Function (service role) that re-checks token, time window, and class membership — no broad anon RLS.

**Tech Stack:** React + Vite, React Router, Supabase (Postgres + Edge Functions/Deno), Vitest, existing `coinService` / Class Dashboard RPCs.

## Global Constraints

- Access window: Monday–Friday **07:30–15:30 Asia/Hong_Kong** only
- UI copy: **English only** on all new UI strings
- Immediate writes; no `pending_rewards`
- Guest locked to link’s `target_class`; hide nav and non-dashboard pages
- Admin manages links only from logged-in Class Dashboard (selected class)
- Do **not** restore broad anon SELECT/DML on sensitive tables
- Optional `allowed_cidrs` column in schema; IP UI can wait for follow-up
- Branch: `cursor/class-dash-magic-links-d3ed`

## File map

| File | Responsibility |
|------|----------------|
| `src/utils/classDashAccess.ts` | Pure school-hours + error-code helpers |
| `src/test/utils/classDashAccess.test.ts` | Unit tests for access window |
| `supabase/migrations/YYYYMMDDHHMMSS_class_dashboard_magic_links.sql` | `shared_links` + archive disable trigger |
| `supabase/functions/class-dash/index.ts` | validate / manage / bootstrap / action |
| `src/services/classDashLinkService.ts` | Frontend client for Edge Function |
| `src/context/ClassDashGuestContext.tsx` | Guest token + targetClass context |
| `src/pages/ClassDashGuestPage.tsx` | Route shell: validate → error or dashboard |
| `src/components/admin/ClassDashLinkPanel.tsx` | Admin generate/copy/regenerate/disable |
| `src/pages/ClassDashboardPage.tsx` | Guest lock + panel mount + hide external nav buttons |
| `src/App.tsx` | Route `/class-dash/:token`; guest nav hide; remove `?token=` leftovers |
| `.agent/codebase_manifest.md` | Document magic links |

---

### Task 1: School-hours access helper + tests

**Files:**
- Create: `src/utils/classDashAccess.ts`
- Create: `src/test/utils/classDashAccess.test.ts`

**Interfaces:**
- Produces:
  - `CLASS_DASH_TZ = 'Asia/Hong_Kong'`
  - `isWithinClassDashHours(now?: Date): boolean`
  - `getClassDashWindowEndISO(now?: Date): string | null` — next 15:30 HKT end for today if inside window, else null
  - `ClassDashErrorCode = 'outside_hours' | 'invalid_link' | 'class_unavailable' | 'access_denied' | 'action_rejected'`
  - `classDashErrorMessage(code: ClassDashErrorCode): string`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { isWithinClassDashHours, classDashErrorMessage } from '@/utils/classDashAccess';

/** Build a Date whose Asia/Hong_Kong wall time equals the given parts. */
function hkWallTime(parts: {
  year: number; month: number; day: number;
  hour: number; minute: number;
}): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoGuess = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:00+08:00`;
  return new Date(isoGuess);
}

describe('isWithinClassDashHours', () => {
  it('allows weekday 07:30', () => {
    // 2026-10-28 is Wednesday
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 7, minute: 30 }))).toBe(true);
  });
  it('allows weekday 15:30 inclusive end-of-minute start, rejects 15:31', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 15, minute: 30 }))).toBe(true);
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 15, minute: 31 }))).toBe(false);
  });
  it('rejects before 07:30 on weekday', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 7, minute: 29 }))).toBe(false);
  });
  it('rejects Saturday even at noon', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 31, hour: 12, minute: 0 }))).toBe(false);
  });
  it('rejects Sunday', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 11, day: 1, hour: 10, minute: 0 }))).toBe(false);
  });
});

describe('classDashErrorMessage', () => {
  it('returns English outside hours copy', () => {
    expect(classDashErrorMessage('outside_hours')).toMatch(/school hours/i);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- --run src/test/utils/classDashAccess.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helper**

```typescript
// src/utils/classDashAccess.ts
export const CLASS_DASH_TZ = 'Asia/Hong_Kong';

export type ClassDashErrorCode =
  | 'outside_hours'
  | 'invalid_link'
  | 'class_unavailable'
  | 'access_denied'
  | 'action_rejected';

export function classDashErrorMessage(code: ClassDashErrorCode): string {
  switch (code) {
    case 'outside_hours':
      return 'Outside school hours. Class Dashboard guest links work Monday to Friday, 07:30–15:30 (Hong Kong time).';
    case 'invalid_link':
      return 'This link is invalid or has been disabled.';
    case 'class_unavailable':
      return 'This class is not available.';
    case 'access_denied':
      return 'Access denied.';
    case 'action_rejected':
      return 'This action could not be completed.';
  }
}

function hkParts(now: Date): { weekday: string; hour: number; minute: number; date: string } {
  const weekday = now.toLocaleDateString('en-US', { timeZone: CLASS_DASH_TZ, weekday: 'long' });
  const date = now.toLocaleDateString('en-CA', { timeZone: CLASS_DASH_TZ });
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: CLASS_DASH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hourStr, minuteStr] = time.split(':');
  return { weekday, hour: parseInt(hourStr, 10), minute: parseInt(minuteStr, 10), date };
}

export function isWithinClassDashHours(now: Date = new Date()): boolean {
  const { weekday, hour, minute } = hkParts(now);
  if (weekday === 'Saturday' || weekday === 'Sunday') return false;
  const val = hour * 100 + minute;
  return val >= 730 && val <= 1530;
}

export function getClassDashWindowEndISO(now: Date = new Date()): string | null {
  if (!isWithinClassDashHours(now)) return null;
  const { date } = hkParts(now);
  return new Date(`${date}T15:30:00+08:00`).toISOString();
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- --run src/test/utils/classDashAccess.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/classDashAccess.ts src/test/utils/classDashAccess.test.ts
git commit -m "feat(class-dash): add school-hours access helper"
```

---

### Task 2: Rebuild `shared_links` migration + archive auto-disable

**Files:**
- Create: `supabase/migrations/20261028030000_class_dashboard_magic_links.sql`

**Interfaces:**
- Produces table `public.shared_links` with columns from the design spec
- Partial unique index: one active `class_dashboard` link per `target_class`
- Trigger/function: when `classes.is_archived` becomes true, deactivate matching links

- [ ] **Step 1: Write migration SQL**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.shared_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  type text NOT NULL DEFAULT 'class_dashboard',
  description text,
  target_class text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  allowed_cidrs text[] DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS shared_links_one_active_class_dashboard
  ON public.shared_links (target_class)
  WHERE (is_active = true AND type = 'class_dashboard');

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links (token);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage shared links" ON public.shared_links;
CREATE POLICY "Admins can manage shared links" ON public.shared_links
  FOR ALL TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_links TO authenticated;
GRANT ALL ON public.shared_links TO service_role;
-- Explicitly no broad grants to anon for table DML

CREATE OR REPLACE FUNCTION public.deactivate_shared_links_on_class_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_archived IS TRUE AND (OLD.is_archived IS DISTINCT FROM TRUE) THEN
    UPDATE public.shared_links
    SET is_active = false
    WHERE type = 'class_dashboard'
      AND target_class = NEW.name
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_shared_links_on_class_archive ON public.classes;
CREATE TRIGGER trg_deactivate_shared_links_on_class_archive
  AFTER UPDATE OF is_archived ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_shared_links_on_class_archive();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261028030000_class_dashboard_magic_links.sql
git commit -m "feat(class-dash): rebuild shared_links for magic links"
```

---

### Task 3: `class-dash` Edge Function (validate / manage / bootstrap / action)

**Files:**
- Create: `supabase/functions/class-dash/index.ts`

**Interfaces:**
- `POST` body `{ op: 'validate' | 'manage' | 'bootstrap' | 'action', ... }`
- validate (anon OK): `{ op:'validate', token }` → `{ target_class, valid_until }` or `{ error: ClassDashErrorCode }`
- manage (admin JWT): `{ op:'manage', action:'get'|'generate'|'regenerate'|'disable', target_class }`
- bootstrap (token): returns students + minimal dashboard payload for `target_class`
- action (token): `{ op:'action', token, action, payload }` for:
  - `award_coins` → RPC `increment_room_coins`
  - `insert_record` → RPC `insert_audited_student_record`
  - `upsert_daily_homework` → upsert `daily_homework`
  - `morning_duty` → RPC `upsert_morning_duty_log` (pass through fields)
- Duplicate school-hours check in Deno (same Mon–Fri 07:30–15:30 HKT logic as `classDashAccess.ts`)
- On every validate/bootstrap/action: load link by token; require `is_active`; class not archived; hours; optional CIDR if `allowed_cidrs` set
- On award/insert: verify student `users.class` equals `target_class`

- [ ] **Step 1: Implement Edge Function** following existing Deno `serve` + `createClient` pattern in `supabase/functions/weekly-coin-transfer/index.ts`. Use service role client for DB. For `manage`, verify caller JWT role is admin via anon client `auth.getUser`. CORS headers like other functions if present in repo.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/class-dash/index.ts
git commit -m "feat(class-dash): add validate/manage/bootstrap/action edge function"
```

---

### Task 4: Frontend `classDashLinkService` + guest context

**Files:**
- Create: `src/services/classDashLinkService.ts`
- Create: `src/context/ClassDashGuestContext.tsx`
- Create: `src/test/services/classDashLinkService.test.ts` (mock `supabase.functions.invoke`)

**Interfaces:**
- Produces:
  - `invokeClassDash<T>(body: object): Promise<T>`
  - `validateClassDashLink(token: string)`
  - `manageClassDashLink(action, targetClass)`
  - `bootstrapClassDash(token: string)`
  - `runClassDashAction(token, action, payload)`
  - `ClassDashGuestProvider` with `{ token, targetClass, validUntil, isGuest: true }`
  - `useClassDashGuest(): { isGuest: boolean; token?: string; targetClass?: string }`

- [ ] **Step 1: Write service using `supabase.functions.invoke('class-dash', { body })`**
- [ ] **Step 2: Write context provider**
- [ ] **Step 3: Unit-test manage/validate client error mapping with mocked invoke**
- [ ] **Step 4: Commit**

```bash
git add src/services/classDashLinkService.ts src/context/ClassDashGuestContext.tsx src/test/services/classDashLinkService.test.ts
git commit -m "feat(class-dash): add link service and guest context"
```

---

### Task 5: Guest route page + App wiring

**Files:**
- Create: `src/pages/ClassDashGuestPage.tsx`
- Modify: `src/App.tsx` (add Route; bypass login for this path; replace `?token=` checks with `useClassDashGuest().isGuest`)

**Interfaces:**
- Route: `/class-dash/:token`
- On mount: `validateClassDashLink`; on failure show English full-page error using `classDashErrorMessage`
- On success: wrap `ClassDashboardPage` in `ClassDashGuestProvider`
- Hide UnifiedNavigation / MobileTabBar when guest
- Allow `classDashboard` without `user` when guest context active
- Remove dependence on `URLSearchParams ... get('token')`

- [ ] **Step 1: Implement `ClassDashGuestPage`**
- [ ] **Step 2: Register route in `AppRoutes` before the `*` catch-all**
- [ ] **Step 3: Update login gate / nav visibility for guest**
- [ ] **Step 4: Commit**

```bash
git add src/pages/ClassDashGuestPage.tsx src/App.tsx
git commit -m "feat(class-dash): add guest route and lock shell navigation"
```

---

### Task 6: Admin ClassDashLinkPanel on Class Dashboard

**Files:**
- Create: `src/components/admin/ClassDashLinkPanel.tsx`
- Modify: `src/pages/ClassDashboardPage.tsx` — render panel when logged-in admin, `activeClass !== 'all'`, and `!isGuest`

**Interfaces:**
- Panel props: `{ className: string }`
- Buttons: Generate / Copy / Regenerate / Disable
- Shows full URL: `${window.location.origin}/class-dash/${token}`
- Helper text: `Mon–Fri 07:30–15:30 HKT · locked to this class`
- Calls `manageClassDashLink`

- [ ] **Step 1: Implement panel**
- [ ] **Step 2: Mount under Class Dashboard header actions area**
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ClassDashLinkPanel.tsx src/pages/ClassDashboardPage.tsx
git commit -m "feat(class-dash): admin link generate/copy/regenerate/disable panel"
```

---

### Task 7: Guest mode behaviour inside ClassDashboardPage + write proxy

**Files:**
- Modify: `src/pages/ClassDashboardPage.tsx`
- Modify: `src/services/coinService.ts` (optional guest branch via injected token getter OR wrapper used by dashboard only)

**Requirements:**
- When `useClassDashGuest().isGuest`:
  - Force `activeClass` to `targetClass`; hide class switcher / “all” / Progress Log / Manage Broadcast / other off-dashboard navigations that leave the page
  - Show English guest banner
  - Load students via `bootstrapClassDash` instead of admin-only queries where those fail for anon
  - Coin awards / behaviour inserts / homework upsert / morning duty writes go through `runClassDashAction` with token
- Keep logged-in admin path unchanged

- [ ] **Step 1: Wire guest lock + banner + hide external links**
- [ ] **Step 2: Proxy guest mutations through `runClassDashAction`**
- [ ] **Step 3: Proxy guest bootstrap read path**
- [ ] **Step 4: Run unit tests**

Run: `npm test -- --run src/test/utils/classDashAccess.test.ts src/test/services/classDashLinkService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClassDashboardPage.tsx src/services/coinService.ts
git commit -m "feat(class-dash): lock dashboard and proxy guest writes"
```

---

### Task 8: Manifest update + PR sync

**Files:**
- Modify: `.agent/codebase_manifest.md` — replace stale “Guest mode uses token from URL parameter” with magic-link design summary

- [ ] **Step 1: Update manifest Class Dashboard section**
- [ ] **Step 2: `npm run typecheck` (fix any new errors introduced)**
- [ ] **Step 3: Commit + push + update PR**

```bash
git add .agent/codebase_manifest.md
git commit -m "docs: update manifest for class dashboard magic links"
git push -u origin cursor/class-dash-magic-links-d3ed
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Mon–Fri 07:30–15:30 HKT | 1, 3 |
| Secret per-class link | 2, 6 |
| Generate/copy/regenerate/disable | 3, 6 |
| No login guest route | 5 |
| Locked class + no other pages | 5, 7 |
| Immediate writes via Edge Function | 3, 7 |
| No pending_rewards / no broad anon RLS | 2, 3 |
| Archive disables link | 2 |
| Optional allowed_cidrs column | 2 |
| Admin normal login unchanged | 5, 7 |
| English UI | 1, 5, 6 |

## Execution note

User approved spec with “通過執行”. Prefer **inline executing-plans** in this cloud session unless subagents are explicitly requested.
