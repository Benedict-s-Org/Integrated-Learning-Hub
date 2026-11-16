# Luanti Coastal Map MVP Acceptance Test Plan

**Status:** Ready for execution  
**Date:** 2026-11-13 (Asia/Hong_Kong)  
**Source of truth:** `docs/superpowers/specs/2026-11-13-luanti-coastal-map-mvp-design.md` (frozen)  
**Related:** `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp.md`, `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp-runbook.md`

## How to run

- **Executor:** Teacher or administrator.
- **Accounts:** One administrator (Hub admin/teacher with Luanti bypass), two distinct students (**Student A**, **Student B**) with `can_access_learning_hub`.
- **Environment:** Deployed Coastal Map MVP stack (Docker Luanti, Hub mint-join, generated Golden Beach → So Kwun Wat world, protection, ownership enforcement, backup store separate from live world).
- **Recording:** For each Test ID, mark Pass / Fail / Blocked and note evidence (screenshot, log snippet, backup filename).

## Coverage index

| Area | Test IDs |
|------|----------|
| Login success | AT-01 |
| Login failure | AT-02 |
| Privilege sync | AT-03, AT-04 |
| Immutable world-generated nodes | AT-05 |
| Build-zone restrictions | AT-06, AT-07 |
| Ownership protection | AT-08 |
| Owner self-edit | AT-09 |
| Admin override | AT-10 |
| Scheduled backup | AT-11 |
| Pre-restore backup | AT-12 |
| Full restore | AT-13 |
| Backup retention policy | AT-14 |
| Failed world generation | AT-15 |
| Failed protection refresh | AT-16 |

---

### AT-01 — Login success

| Field | Content |
|-------|---------|
| **Test ID** | AT-01 |
| **Purpose** | Verify a Hub student can mint credentials and join the coastal MVP world. |
| **Preconditions** | Student A logged into Learning Hub with learning community access; Luanti server running; `auth-sync` healthy; world mounted. |
| **Steps** | 1. Open My Learning Community. 2. Generate join credentials. 3. Connect Luanti client with shown host/port/username/password. |
| **Expected Result** | Student A authenticates and spawns in the Golden Beach → So Kwun Wat world; coast or major roads recognizable. |
| **Pass Criteria** | Join succeeds without manual Luanti account creation; world is the coastal MVP map. |

---

### AT-02 — Login failure

| Field | Content |
|-------|---------|
| **Test ID** | AT-02 |
| **Purpose** | Verify invalid or expired credentials cannot join. |
| **Preconditions** | Luanti server running; Student A can mint credentials. |
| **Steps** | 1. Mint credentials for Student A. 2. Wait until past expiry **or** alter password. 3. Attempt Luanti login with invalid/expired secret. |
| **Expected Result** | Login rejected; no session in world. |
| **Pass Criteria** | Client fails authentication; no unprotected in-world access granted. |

---

### AT-03 — Privilege sync success (transitional creative)

| Field | Content |
|-------|---------|
| **Test ID** | AT-03 |
| **Purpose** | Verify successful privilege sync grants student `interact`, `shout`, and transitional `creative`. |
| **Preconditions** | AT-01 path available; auth-sync returning student privilege list per spec. |
| **Steps** | 1. Student A joins successfully. 2. Inside a build zone, confirm creative/unlimited placeable materials work for placement attempts. 3. Confirm chat/`shout` works if enabled by server. |
| **Expected Result** | Student can place using transitional creative inside a build zone (subject to protection/ownership). |
| **Pass Criteria** | Privileges match Stage MVP student set; placement possible in build zone without Hub shop items. |

---

### AT-04 — Privilege sync failure

| Field | Content |
|-------|---------|
| **Test ID** | AT-04 |
| **Purpose** | Verify privilege sync failure does not admit unprotected guest creative. |
| **Preconditions** | Operator can temporarily break auth-sync (wrong `LUANTI_SERVICE_SECRET`, Edge Function down, or network block) in a **non-production** window. |
| **Steps** | 1. Break auth-sync. 2. Student B attempts mint (if Hub still up) and/or join while Luanti cannot sync privileges. 3. Observe server/mod behavior. 4. Restore auth-sync. |
| **Expected Result** | Player is denied or kicked; not left playing with unprotected creative. |
| **Pass Criteria** | No student remains in-world with full dig/build outside policy due to sync failure. |

---

### AT-05 — Immutable world-generated nodes

| Field | Content |
|-------|---------|
| **Test ID** | AT-05 |
| **Purpose** | Verify world-generated / public OSM nodes cannot be modified by students. |
| **Preconditions** | Student A in-world; known public feature (road, coast, school marker, or other worldgen terrain) identified. |
| **Steps** | 1. Student A attempts to dig or place on a world-generated/public protected node. |
| **Expected Result** | Action cancelled; short English hint (e.g. “Protected”). Node unchanged. |
| **Pass Criteria** | Node state unchanged after attempt; student cannot modify world-generated nodes. |

---

### AT-06 — Build-zone restriction (outside zone)

| Field | Content |
|-------|---------|
| **Test ID** | AT-06 |
| **Purpose** | Verify students cannot dig/build outside marked build zones. |
| **Preconditions** | Student A in-world; location clearly outside any build zone and not solely testing public OSM (empty non-zone area preferred). |
| **Steps** | 1. Move Student A outside build zones. 2. Attempt dig and place. |
| **Expected Result** | Both attempts fail; English hint as applicable. |
| **Pass Criteria** | No node change outside build zones by Student A. |

---

### AT-07 — Build-zone allowance (inside zone)

| Field | Content |
|-------|---------|
| **Test ID** | AT-07 |
| **Purpose** | Verify students may place nodes inside marked build zones. |
| **Preconditions** | Student A in-world; standing inside a marked build zone on allowable surface. |
| **Steps** | 1. Student A places at least one node inside the build zone. |
| **Expected Result** | Node placed; owned by Student A (for later ownership tests). |
| **Pass Criteria** | Placement succeeds only inside the zone; node remains after place. |

---

### AT-08 — Ownership protection (other student)

| Field | Content |
|-------|---------|
| **Test ID** | AT-08 |
| **Purpose** | Verify Student B cannot modify or remove Student A’s placed nodes. |
| **Preconditions** | AT-07 completed; Student A’s placed node exists in a build zone; Student B can join. |
| **Steps** | 1. Student B joins. 2. Student B attempts to dig or change Student A’s node. |
| **Expected Result** | Action cancelled; hint e.g. “Not your block”; node unchanged. |
| **Pass Criteria** | Only owner or administrator may modify player-placed nodes; B fails. |

---

### AT-09 — Owner self-edit

| Field | Content |
|-------|---------|
| **Test ID** | AT-09 |
| **Purpose** | Verify the placing player can modify or remove their own nodes. |
| **Preconditions** | Student A owns at least one placed node in a build zone. |
| **Steps** | 1. Student A digs or replaces their own placed node. |
| **Expected Result** | Modification succeeds. |
| **Pass Criteria** | Owner can edit own player-placed nodes. |

---

### AT-10 — Admin override

| Field | Content |
|-------|---------|
| **Test ID** | AT-10 |
| **Purpose** | Verify an administrator may modify or remove any player-placed node. |
| **Preconditions** | Student A has a placed node; administrator account joined with bypass privileges. |
| **Steps** | 1. Administrator digs or changes Student A’s placed node. |
| **Expected Result** | Modification succeeds. |
| **Pass Criteria** | Administrator can modify player-placed nodes that students cannot. |

---

### AT-11 — Scheduled backup

| Field | Content |
|-------|---------|
| **Test ID** | AT-11 |
| **Purpose** | Verify automatic daily world snapshot lands outside the live world directory. |
| **Preconditions** | Backup schedule configured; operator can wait for next scheduled run or trigger the same job path used by the schedule in a test window. |
| **Steps** | 1. Note current time and backup store path. 2. Allow scheduled job to run (or invoke the scheduled script identically). 3. List backup store and live world directory. |
| **Expected Result** | New snapshot artifact appears under backup store; live world directory is not the only copy. |
| **Pass Criteria** | Snapshot exists outside live world path; timestamp matches schedule/test run. |

---

### AT-12 — Pre-restore backup

| Field | Content |
|-------|---------|
| **Test ID** | AT-12 |
| **Purpose** | Verify full restore always snapshots the live world first; restore aborts if that backup cannot be written. |
| **Preconditions** | Live world has a distinguishable change (e.g. Student A placed a marker node); backup store writable for happy path; operator can also simulate backup write failure (e.g. backup volume full or permissions) in a controlled window. |
| **Steps** | **Happy path:** 1. Note live world marker. 2. Start full restore to a known tagged artifact or snapshot. 3. Confirm a new pre-restore backup was written before overwrite. **Failure path:** 4. Make backup store unwritable. 5. Attempt full restore. |
| **Expected Result** | Happy path: pre-restore backup exists, then restore proceeds. Failure path: restore aborts; live world not half-replaced. |
| **Pass Criteria** | No full restore completes without a successful pre-restore backup; aborted restore leaves world consistent (not partial). |

---

### AT-13 — Full restore

| Field | Content |
|-------|---------|
| **Test ID** | AT-13 |
| **Purpose** | Verify all-or-nothing full restore from a tagged worldgen version or retained snapshot. |
| **Preconditions** | AT-12 happy-path capability; tagged worldgen version available **or** retained snapshot available; live world differs from restore source. |
| **Steps** | 1. Perform full restore (pre-restore backup included). 2. Restart/rejoin as needed. 3. Inspect terrain/build state vs restore source. |
| **Expected Result** | World matches restore source; no partial mix of old and new terrain. |
| **Pass Criteria** | Restore completes atomically from operator perspective; world consistent with selected source. |

---

### AT-14 — Backup retention policy

| Field | Content |
|-------|---------|
| **Test ID** | AT-14 |
| **Purpose** | Verify retention keeps last 7 daily backups plus snapshots at 14, 21, and 30 days, and prunes others (except frozen investigation snapshots). |
| **Preconditions** | Backup store with enough dated snapshots to exercise prune (may use fixture timestamps in non-prod), or documented dry-run of retention script showing keep/delete decisions. |
| **Steps** | 1. Run retention prune (or dry-run with fixtures). 2. List remaining snapshots. |
| **Expected Result** | Retained set matches: last 7 dailies; plus 14-, 21-, and 30-day snapshots; extras removed unless explicitly frozen. |
| **Pass Criteria** | Policy match verified by operator checklist; restore may still use any retained snapshot. |

---

### AT-15 — Failed world generation

| Field | Content |
|-------|---------|
| **Test ID** | AT-15 |
| **Purpose** | Verify OSM/DEM/voxelize failure does not overwrite the live world. |
| **Preconditions** | Known-good live world mounted; operator can force pipeline failure (invalid bbox credentials, blocked network, bad DEM path). |
| **Steps** | 1. Record live world version/tag or a checksum/marker. 2. Run worldgen pipeline with induced failure. 3. Re-check live world. |
| **Expected Result** | Pipeline exits non-zero; live world unchanged. |
| **Pass Criteria** | No live world replacement after failed generation. |

---

### AT-16 — Failed protection refresh

| Field | Content |
|-------|---------|
| **Test ID** | AT-16 |
| **Purpose** | Verify protection refresh failure keeps previous areas/protection files. |
| **Preconditions** | Working protection/areas files on live stack; operator can induce refresh failure (bad export path, invalid areas file, permission error). |
| **Steps** | 1. Note current protection behavior (e.g. AT-05 still holds). 2. Run refresh protection with induced failure. 3. Retest public protection and build-zone boundaries. |
| **Expected Result** | Refresh fails; previous protection files remain; student rules unchanged. |
| **Pass Criteria** | No empty/broken protection left active; prior areas/protection preserved. |

---

## Exit criteria mapping

| Spec exit criterion | Tests |
|---------------------|-------|
| Hub mint → coastal world join | AT-01 |
| World-generated immutable | AT-05 |
| Outside zones no dig/build | AT-06 |
| Ownership + admin override | AT-08, AT-09, AT-10 |
| Scheduled backups outside live world + retention | AT-11, AT-14 |
| Pre-restore backup + full restore | AT-12, AT-13 |
| Creative revocation documented later (no shop) | Checked in Implementation Phase 2/7 docs review (not a gameplay test) |
| Excluded mods absent | Deployment checklist in Phase 7 / mod list inspection |

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Executor | | | |
| Reviewer (optional) | | | |
