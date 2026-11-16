# Luanti Coastal Map MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase. Track progress with the phase Definition of Done checklists.

**Goal:** Ship a joinable Golden Beach → So Kwun Wat Luanti world with protected public terrain, build zones, player-placed ownership, transitional creative, and backup/restore — before any economy work.

**Architecture:** Repeatable `luanti/worldgen` OSM+DEM pipeline produces a versioned world plus protection/build-zone exports; Docker Luanti mounts that world with `lh_auth` (Hub auth-sync) and ownership enforcement (`lh_build` or equivalent mature mod); backups live on a separate volume; Hub auth contracts stay Stage 1 with privilege-list adjustments only.

**Tech Stack:** Docker Compose, Luanti, Lua mods, OSM/DEM tooling in `luanti/worldgen/`, existing Supabase `luanti-auth` Edge Function, React `LearningCommunityPage` (optional English copy only).

**Source of truth:** `docs/superpowers/specs/2026-11-13-luanti-coastal-map-mvp-design.md` (frozen).

## Global Constraints

- Do not change architecture, scope, stages, ownership model, backup policy, mod policy, authentication model, or world-generation design from the frozen spec.
- UI strings English only.
- Vanilla-first; prefer mature community mods before custom Lua; custom only when required capability is missing.
- MVP excludes Technic, Mesecons, Pipeworks, SmartShop, and other economy/automation/logistics/machine mods.
- No Hub shop, plots, inventory grants, trading, or full Tuen Mun expansion.
- Full restore only; pre-restore backup mandatory; backups never solely inside the live world directory.
- Economy later revokes `creative`; document that path, do not implement shop.

## File map (expected)

| Path | Responsibility |
|------|----------------|
| `luanti/docker-compose.yml` | World, mods, separate backup volume/path |
| `luanti/minetest.conf` / example | Server + service secret + backup-related settings as needed |
| `luanti/worldgen/` | Bbox, fetch, filter, voxelize, version tag, protection/zone export |
| `luanti/mods/lh_auth` | Auth-sync poll, privilege application, deny unsafe join |
| `luanti/mods/lh_build` or chosen mature equivalent | Ownership rule enforcement |
| Protection/areas mod (mature, if required) | Public + build-zone regions |
| Backup scripts under `luanti/` (e.g. `scripts/`) | Scheduled snapshot, pre-restore snapshot, retention prune, restore |
| `src/pages/LearningCommunityPage.tsx` | Optional English scope/rules copy |
| `supabase/functions/luanti-auth` | Privilege list adjustments only (`creative`, admin bypass flags) |

---

## Phase 1 — Infrastructure and Docker

### Goal

Runnable Luanti container stack with separate live world and backup storage paths, ready to mount generated world and MVP mods only.

### Tasks

- Confirm/extend `luanti/docker-compose.yml` mounts: live world directory, mods (`lh_auth`, ownership mod, areas/protection if used), config, **backup volume/path outside live world**.
- Document required env vars (`LUANTI_SERVICE_SECRET`, server host/port, backup path, schedule time) in `luanti/README.md` without inventing new Hub APIs.
- Ensure compose does not pull or enable Technic, Mesecons, Pipeworks, SmartShop, or other excluded gameplay mods.
- Add placeholder directories for world output and backup store so operators do not write backups into the live world tree.

### Deliverables

- Updated Docker Compose + README env/mount documentation.
- Empty or documented `world/` and backup store paths separated on disk.

### Dependencies

- Stage 1 Foundation already present (`lh_auth`, docker scaffold, Hub mint-join).

### Definition of Done

- [ ] `docker compose` starts Luanti with distinct live world and backup mounts.
- [ ] README lists env vars and mount layout.
- [ ] No excluded economy/automation/logistics/machine mods in the MVP compose/mod set.

---

## Phase 2 — Authentication and privilege sync

### Goal

Students join only via Hub-minted credentials; privilege sync applies transitional student privileges and administrator bypass; failed sync never admits unprotected guest creative.

### Tasks

- Adjust `auth-sync` privilege payloads so students receive `interact`, `shout`, and transitional `creative`.
- Map Hub admin/teacher (or existing admin-capable Hub roles used by Stage 1) to Luanti privileges that allow ownership/protection bypass for cleanup.
- Verify `lh_auth` denies or kicks when privilege sync fails (per spec error handling).
- Optionally add English copy on `LearningCommunityPage` for map scope (Golden Beach–So Kwun Wat) and rules (build in marked zones; only edit blocks you placed).
- Document (in README or short note under `luanti/`) that economy stage will remove `creative` later — no shop implementation.

### Deliverables

- Privilege mapping in Edge Function and/or `lh_auth` aligned with frozen spec.
- Optional Learning Community page copy (English only).
- Short “creative revocation later” note for operators/devs.

### Dependencies

- Phase 1 mounts and secrets available.
- Existing `luanti-auth` mint-join / auth-sync / record-login.

### Definition of Done

- [ ] Student with Hub access can mint-join and authenticate when sync succeeds.
- [ ] Failed privilege sync does not leave a student in unprotected creative.
- [ ] Student privileges include transitional `creative`; administrators can bypass for cleanup.
- [ ] No new shop/plot/inventory APIs.

---

## Phase 3 — World generation pipeline

### Goal

Repeatable OSM + DEM pipeline for Golden Beach → So Kwun Wat bbox that writes a version-tagged world without overwriting live world on failure.

### Tasks

- Create `luanti/worldgen/` with bbox config (e.g. `bbox.json`), locked after OSM validation for the named coastal strip.
- Implement fetch → filter (public facilities/roads/coast/rivers; exclude residential estates and most private/commercial) → simplify → voxelize → world output.
- Stamp version tag (date / git hash / bbox).
- Write output to a staging/versioned path; never replace live world on non-zero exit.
- Document how to run the pipeline and how expand-later is config + re-run only.

### Deliverables

- `luanti/worldgen/` scripts/config.
- At least one tagged world artifact for the coastal MVP bbox.
- Pipeline docs (inputs, filters, version tag, failure behavior).

### Dependencies

- Phase 1 directory layout for world artifacts.

### Definition of Done

- [ ] Pipeline runs end-to-end for the MVP bbox and produces a loadable world.
- [ ] Coast / major roads are recognizable in-game when the world is mounted.
- [ ] Failed fetch/voxelize leaves previous live world untouched and exits non-zero.
- [ ] Version tag recorded with the artifact.

---

## Phase 4 — Protection and build zones

### Goal

Hard-protect public/world-generated regions; allow student building only inside marked build zones; support protection refresh without wiping the world.

### Tasks

- Emit protected public regions and build zones from worldgen (auto from non-public empty land + optional `manual: true` zones).
- Install/configure mature areas/protection mod as required by Design Principles (vanilla-first / existing mods first).
- Implement **Refresh protection** admin/script path: update areas/protection files without wiping world; on failure keep previous files.
- Ensure students cannot dig/build outside build zones or on protected public OSM regions.
- Preserve `manual: true` zones across protection refresh.

### Deliverables

- Protection/zone export from pipeline.
- Refresh-protection script/procedure wired to Docker mounts.
- Documented zone layout for operators.

### Dependencies

- Phase 3 tagged world.
- Phase 1 compose mounts for protection data.

### Definition of Done

- [ ] Public OSM / world-generated protected regions reject student dig/build.
- [ ] Outside build zones, students cannot dig/build.
- [ ] Inside build zones, students can place (ownership enforced in Phase 5).
- [ ] Failed protection refresh retains previous areas/protection files.
- [ ] Manual zones survive refresh.

---

## Phase 5 — Ownership enforcement

### Goal

Enforce the frozen ownership rule for all player-placed nodes; leave world-generated nodes immutable.

### Tasks

- Evaluate mature community mods for Hub-compatible ownership; if none fully meet the rule, implement minimal `lh_build`.
- On place: owner = Luanti username (Hub-linked `luanti_accounts` identity).
- On dig/change: allow only owner or administrator; deny others with short English hint.
- World-generated / ownerless map nodes remain immutable to students.
- Keep enforcement in-game only (no Supabase plot registry).

### Deliverables

- `lh_build` or documented chosen mature mod + config.
- English deny hints (“Protected” / “Not your block” as applicable).

### Dependencies

- Phase 2 usernames/privileges.
- Phase 4 build zones (placement allowed only in zones).

### Definition of Done

- [ ] All world-generated nodes are immutable to students.
- [ ] All player-placed nodes are owned by the placing player.
- [ ] Only owner or administrator may modify/remove a player-placed node.
- [ ] Student B cannot edit Student A’s placed nodes; A can edit own; admin can edit any player-placed node.

---

## Phase 6 — Backup and restore

### Goal

Automatic scheduled backups, mandatory pre-restore backup, retention policy, and all-or-nothing full restore from tagged worldgen versions or retained snapshots.

### Tasks

- Implement scheduled daily world snapshot to backup store (outside live world) at configured time.
- Implement full restore flow: (1) backup live world, (2) replace from tagged worldgen version or retained snapshot, (3) abort if pre-restore backup fails; no partial restore.
- Implement retention: keep last 7 daily snapshots; also retain snapshots from 14, 21, and 30 days ago; prune outside that set unless operator freezes a snapshot for investigation.
- On backup write failure: alert operator; do not delete older retained snapshots to free space without an explicit policy/prune run.
- Document restore sources: any retained snapshot or tagged worldgen artifact.

### Deliverables

- Backup/restore/retention scripts + cron/scheduler wiring (host or compose sidecar as chosen operationally).
- Operator commands documented in README or runbook cross-link.

### Dependencies

- Phase 1 separate backup volume.
- Phase 3 tagged artifacts for worldgen restore source.

### Definition of Done

- [ ] Daily automatic backups appear outside the live world directory.
- [ ] Full restore always creates a pre-restore backup first or aborts.
- [ ] Restore can load a tagged worldgen version or any retained snapshot.
- [ ] Retention matches 7 / 14 / 21 / 30 policy.
- [ ] Backup failure does not auto-purge older snapshots to make room.

---

## Phase 7 — Deployment and validation

### Goal

Deploy the coastal MVP stack and prove frozen exit criteria via the Acceptance Test Plan.

### Tasks

- Deploy compose stack with generated world, protection, ownership mod, auth secrets, and backup schedule.
- Confirm mod set excludes Technic, Mesecons, Pipeworks, SmartShop, and other excluded categories.
- Run Acceptance Test Plan with one admin/teacher and two student accounts.
- Fix only defects that violate the frozen spec (no scope additions).
- Cross-link Implementation Plan, Acceptance Test Plan, and Operational Runbook in `luanti/README.md`.

### Deliverables

- Deployed MVP environment.
- Completed acceptance results (pass/fail log).
- README links to the three MVP docs.

### Dependencies

- Phases 1–6 complete.
- `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp-acceptance.md`
- `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp-runbook.md`

### Definition of Done

- [ ] All frozen exit criteria satisfied.
- [ ] Acceptance tests for required coverage areas executed and recorded.
- [ ] Operators can follow the runbook for listed incidents.
- [ ] No excluded mods installed; no economy/plots features added.

---

## Out of scope (do not implement)

Hub shop/economy bridge, `luanti_plots`, Travelnet/Mesecons/Technic/Pipeworks/SmartShop, smart re-import preserving builds, student-drawn claims, full Tuen Mun expansion, Hub UI for admin ops beyond optional Learning Community copy.
