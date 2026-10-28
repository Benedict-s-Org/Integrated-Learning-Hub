# Luanti Learning Community Stage 1 Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Cut student “My Learning Community” over from the isometric Memory Palace to a Luanti join flow with Hub-minted credentials and a Docker Luanti auth bridge.

**Architecture:** Supabase tables + `luanti-auth` Edge Function mint short-lived join passwords; Luanti `lh_auth` mod polls `auth-sync` and registers a custom authentication handler; React page replaces `MemoryPalacePage` for `learningHub`.

**Tech Stack:** React/Vite, Supabase (Postgres + Edge Functions), Docker Compose, Luanti + Lua mod

## Global Constraints

- UI strings English only  
- Keep `can_access_learning_hub` gate and nav id `learningHub`  
- Do not delete isometric source trees in Stage 1; remove from student nav/entry only  
- Coins stay on existing `coinService` / `user_room_data` (no economy sync yet)

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261028000000_luanti_community_foundation.sql`

**Produces:** Tables `luanti_accounts`, `luanti_join_secrets`, `admin_audit_log` with RLS

- [x] Create migration with columns, FKs to `users`, indexes, RLS (users read own account; service role for secrets; admins read audit)
- [x] Commit

### Task 2: Edge Function `luanti-auth`

**Files:**
- Create: `supabase/functions/luanti-auth/index.ts`
- Create: `supabase/functions/luanti-auth/config.json`

**Produces:** `mint-join`, `auth-sync`, `record-login` actions

- [x] Implement JWT mint-join and service-secret auth-sync/record-login
- [x] Sanitize Luanti usernames (lowercase, `[a-z0-9_]`, max 20)
- [x] Commit

### Task 3: Learning Community page + wire App

**Files:**
- Create: `src/pages/LearningCommunityPage.tsx`
- Create: `src/services/luantiAuthService.ts`
- Modify: `src/App.tsx` (lazy import + `learningHub` case)
- Modify: `src/components/UnifiedNavigation/UnifiedNavigation.tsx` (drop community Shop/City/Region section)
- Modify: `src/components/UnifiedNavigation/MobileMoreSheet.tsx` (same)
- Modify: `src/components/UnifiedNavigation/MobileTabBar.tsx` (optional prop cleanup if unused)

**Produces:** Student-facing join UI

- [x] Build page with Generate / Copy credentials
- [x] Swap `learningHub` render target
- [x] Remove isometric community sub-nav
- [x] Commit

### Task 4: Docker Luanti + `lh_auth` mod

**Files:**
- Create: `luanti/docker-compose.yml`
- Create: `luanti/README.md`
- Create: `luanti/mods/lh_auth/mod.conf`
- Create: `luanti/mods/lh_auth/init.lua`
- Create: `luanti/minetest.conf.example`

**Produces:** Runnable local server that syncs Hub join secrets

- [x] Compose service + mod poll auth-sync
- [x] Document env vars and join steps
- [x] Commit

### Task 5: Manifest + verify

**Files:**
- Modify: `.agent/codebase_manifest.md` (Learning Community → Luanti Stage 1 note)
- Test: typecheck / targeted tests if present

- [x] Update manifest
- [x] Run `npm run build` or `tsc` as available
- [x] Push branch and open PR
