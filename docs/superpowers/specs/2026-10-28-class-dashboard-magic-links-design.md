# Class Dashboard Magic Links — Design

**Date:** 2026-10-28  
**Status:** Approved for planning  
**Approach:** Rebuild scoped `shared_links` + Edge Function proxy writes (Approach 1)

## Problem

Teachers need a per-active-class URL that opens the Class Dashboard **without login** during school hours, limited to that class’s dashboard actions (homework, coins, behaviour, morning duties, etc.). Other site features must stay unavailable. Device binding is unreliable on school PCs that log out daily; wired-only enforcement is not detectable from the web app unless egress IPs differ.

## Goals

- One stable secret link per active class
- Valid only **Mon–Fri 07:30–15:30 Asia/Hong_Kong**
- No login required for classroom use
- Immediate writes (same as logged-in Class Dashboard); rely on existing records / revert — no pending-approval queue
- Locked to the link’s class; no navigation to other app areas
- Admin manages links from Class Dashboard (logged-in only): generate / copy / regenerate / disable
- Optional school IP/CIDR allowlist later; empty means no IP restriction

## Non-goals

- Reliable “ethernet only / no Wi‑Fi” detection (not available to the web app)
- Device fingerprint / cookie pairing (school machines clear sessions daily)
- `pending_rewards` / guest approval workflow
- Guest access to any page outside Class Dashboard
- Changing Admin’s normal login workflow (Admin continues to use the normal URL + login)

## Prior art

Guest mode previously used `shared_links` + broad anon RLS and was removed in `20260312001500_remove_guest_mode.sql` for security. `App.tsx` still has leftover `?token=` UI checks that hide nav on `classDashboard`. This design rebuilds link storage with **token-validated Edge Functions** instead of opening anon table writes.

## Architecture

```text
Admin (logged in)  →  Generate/Regenerate/Disable  →  shared_links
Classroom browser  →  GET /class-dash/<token>
                   →  validate-class-dash-link (time window, active, class, optional IP)
                   →  Locked Class Dashboard (no nav, class fixed)
                   →  class-dash-action / scoped RPCs (token + class checks)
                   →  Existing coin / homework / behaviour / morning-duty writes
```

1. Admin creates or rotates a secret token for an active class (row in `shared_links`).
2. Classroom opens `/class-dash/<token>`.
3. Validation checks: link active, class not archived, current time in Mon–Fri 07:30–15:30 HKT, optional IP allowlist.
4. On success, render Class Dashboard in **guest mode** with `target_class` + token context; hide UnifiedNavigation and MobileTabBar.
5. All mutations go through Edge Functions (or token-aware RPCs) using `service_role` after validating the token; never grant anon direct DML on sensitive tables.
6. Outside hours or invalid token → English error page only (not the full admin login shell for guest users).

## Data model

### Table: `shared_links` (rebuild)

| Column | Purpose |
|--------|---------|
| `id` | UUID PK |
| `token` | Long random hex/string; unique; used in URL |
| `type` | `'class_dashboard'` |
| `target_class` | Class name (e.g. `3A`); locks guest session |
| `is_active` | Admin disable switch |
| `created_by` | Admin user id |
| `created_at` | Created timestamp |
| `rotated_at` | Last regenerate timestamp (nullable) |
| `allowed_cidrs` | Optional `text[]` of IPs/CIDRs; empty/null = no IP filter |
| `description` | Optional note |

**Do not rebuild** `pending_rewards`.

**Uniqueness:** at most one `is_active = true` row per `target_class` for `type = 'class_dashboard'`.

**Time window:** global rule (not per-link expiry): Monday–Friday 07:30–15:30 `Asia/Hong_Kong`. Prefer a single config constant or `system_config` key so hours can change in one place.

### Lifecycle

1. **Generate** — Admin creates active link for a class that has none.
2. **Regenerate** — New token; previous token deactivated immediately.
3. **Disable** — `is_active = false`; URL stops working.
4. **Archive class** — Auto-disable that class’s link(s).
5. Optional **IP allowlist** — Admin/config may set `allowed_cidrs` later; omitted in v1 UI if unused.

## Frontend

### Route

- Path: `/class-dash/<token>`
- Accessible without login
- Replace leftover `?token=` checks with an explicit guest/session context flag

### Guest mode UI

- No `UnifiedNavigation`, no `MobileTabBar`
- Class selector locked or hidden; only `target_class`
- Preserve existing Class Dashboard capabilities for that class: student grid, coins, behaviour, homework setup, morning duties, in-dashboard broadcast tools already present there
- Small English banner: e.g. `Class Dashboard · 3A · Guest access` (optional remaining-hours hint)
- No entry points to other pages; path/hash escapes redirected back to guest dashboard or error page
- Link management controls **hidden** in guest mode

### Admin UI (logged-in only)

- Location: **Class Dashboard top bar after an active class is selected** (only entry point in v1)
- Controls: Generate link | show URL | Copy | Regenerate | Disable
- Helper text: valid Mon–Fri 07:30–15:30 HKT; guest access locked to this class
- Admin day-to-day work continues via normal site URL + login; magic links are for classroom no-login use

### Error pages (English UI)

| Condition | Message intent |
|-----------|----------------|
| Outside Mon–Fri 07:30–15:30 HKT | Outside school hours |
| Invalid / disabled / rotated token | Link invalid or disabled |
| Class archived | Class not available |
| IP allowlist fail (when configured) | Access denied |
| Mutation after window closes | Toast / error; action rejected |

## Backend / security

### `validate-class-dash-link`

- Input: token (+ request IP when allowlist configured)
- Checks: active, class not archived, time window, optional CIDR
- Output: `{ target_class, valid_until }` or structured error code

### Mutations (`class-dash-action` or per-action functions)

- Require valid token on every write
- Re-check time window and active status on every write
- Enforce target students belong to `target_class`; reject cross-class
- Execute existing business logic (coin RPCs, `daily_homework`, morning duty RPCs, audited student records)
- Audit metadata: e.g. `source: class_dash_link` + link id for revert/investigation
- Reads similarly scoped to that class; no public SELECT on full sensitive tables for anon

### Explicitly forbidden

- Restoring broad anon RLS write/select on `student_records`, `user_room_data`, etc. as in the removed guest mode

## Testing (v1)

- Generate / copy / regenerate / disable from Class Dashboard admin UI
- In-window: open link without login → locked dashboard for that class only
- Outside window: link fails with Outside school hours
- Guest cannot navigate to other app features
- Coins, behaviour, homework, morning duties write immediately and only for that class’s students
- Regenerated link: old URL fails; new URL works
- Archiving a class disables its link
- Logged-in Admin normal URL behaviour unchanged

## Open follow-ups (out of v1 unless trivial)

- Admin UI to edit `allowed_cidrs`
- Remaining-hours countdown on guest banner
- Central `system_config` editor for school hours

## Decision log

| Topic | Decision |
|-------|----------|
| Access window | Mon–Fri 07:30–15:30 HKT |
| Writes | Immediate; existing logs/revert |
| Who manages links | Admin only |
| Device lock | Not used |
| Wired-only | Not enforceable; optional IP later |
| Security baseline | Secret token + time window; optional IP |
| Link policy | One stable link per active class; regenerate/disable |
| Class scope | Locked to link’s class |
| Link admin UI | Class Dashboard top (logged-in, class selected) |
| Approach | Edge Function proxy + `shared_links` rebuild |
