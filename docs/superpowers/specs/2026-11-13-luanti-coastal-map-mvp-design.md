# Luanti Coastal Map MVP Design

**Status:** Draft (pending user review)  
**Date:** 2026-11-13 (Asia/Hong_Kong)  
**Supersedes stage order in:** `docs/superpowers/specs/2026-10-28-luanti-learning-community-design.md` (Stages 2–5 sequencing only; Stage 1 foundation unchanged)  
**Depends on:** Stage 1 Foundation (Hub join credentials, `luanti-auth`, `lh_auth`, Docker scaffold)

## Goals

Ship a joinable Luanti world for the **Golden Beach → So Kwun Wat** coastal strip before any economy work:

- OSM + DEM terrain that students can recognize (coast, major roads, selected public facilities).
- Hard protection on public OSM features.
- Building only inside marked **build zones**, with **per-player block ownership** (students cannot edit others’ placed blocks).
- Transitional **creative** privileges for free materials; explicitly revocable when economy lands later.

## Design Principles

Default policy:

- **Vanilla-first** — prefer stock Luanti / Minetest Game capabilities before adding mods or custom code.
- **Existing Luanti mods before custom development** — evaluate mature community mods for protection, areas, and related needs before writing Learning Hub–specific Lua.
- **Custom development only when required** — add custom mods (e.g. `lh_build`) only when a required capability does not exist in mature community mods, or when Hub identity/auth integration cannot be met safely by an existing mod.
- **Mods only for defined need** — install a mod only when it supports a defined learning objective or operational need (auth, map ops, protection, backups). Do not install mods “for later fun.”

## Mod Scope Policy

MVP intentionally excludes:

- Technic
- Mesecons
- Pipeworks
- SmartShop
- other economy, automation, logistics, or machine-based gameplay mods

**Rationale:** reduce maintenance burden, compatibility risk, and upgrade complexity while the coastal map and build rules stabilize.

## Non-goals

- Hub shop, coin spend, inventory → Luanti item grants
- `luanti_plots` claim / assign / reclaim in Supabase
- Full Tuen Mun district import
- Student-drawn zones or claims
- Smart re-import that preserves player builds (MVP is full restore only)
- Trading, blueprints, in-browser voxel client
- Economy / automation / logistics / machine gameplay mods listed under Mod Scope Policy

## Revised stage order

1. **Foundation** — done (auth bridge, Learning Community page, Docker + `lh_auth`)
2. **Coastal Map MVP** — this document
3. **Economy bridge** — remove transitional `creative`; grant placeables via Hub shop / inventory
4. **Private plots** — Supabase land SoT; may replace or subdivide build zones
5. **Expand + admin hardening** — wider Tuen Mun, override / suspend / restore policies

Original “Stage 2 = Economy, Stage 4 = Tuen Mun world” is reordered: **map subset + build rules first**, economy later.

## Architecture

```
OSM + DEM (bbox config)
  → luanti/worldgen pipeline (repeatable)
  → Luanti world + areas/protection export + version tag
  → Docker Luanti (lh_auth + lh_build + world mount)

Learning Hub
  → mint-join / auth-sync (unchanged SoT for accounts)
  → optional English copy on LearningCommunityPage (scope + build rules)
```

**Data ownership (unchanged principle):**

| Store | Owns |
|-------|------|
| Supabase | Users, roles, coins (unused here), audit, `luanti_accounts` |
| Luanti | Terrain, blocks, buildings, in-game ownership metadata, areas |
| worldgen output | Versioned world archives and protection/zone definitions |
| Backup store | Scheduled and pre-restore world snapshots (separate from live world) |

Hub does **not** sync terrain or per-block ownership in this stage.

## Geographic scope

- **Named MVP:** Golden Beach → So Kwun Wat (coastal strip + short inland band; not all of Tuen Mun).
- **Machine scope:** WGS84 bounding box in config (e.g. `luanti/worldgen/bbox.json`), locked after OSM validation; expand later by config + re-run only.
- **Feature filter (aligned with master community intent):** keep schools, libraries, government, hospitals, parks, major roads, coastlines, rivers; **exclude** residential estates and most private/commercial buildings.

## Import pipeline

Repeatable steps under `luanti/worldgen/`:

1. Fetch OSM + DEM for bbox.
2. Filter and simplify geometries.
3. Rasterize / voxelize into Luanti world scale.
4. Write world directory (or restorables archive).
5. Emit **protected public regions** and **build zones** (auto from non-public empty land + optional `manual: true` zones preserved across protection refresh).
6. Stamp **version tag** (date / git hash / bbox).

**Restore policy (MVP):** **full restore** only — replace terrain from a tagged version or retained backup snapshot; clears player builds unless restoring a snapshot that already contains them. No half-applied imports: failed pipeline must not overwrite the live world. **Before any full restore, take an automatic backup** of the current live world (see Automatic Backup).

**Admin ops (document + script first; Hub UI optional):**

1. **Refresh protection** — update public / build-zone areas without wiping the world file.
2. **Full restore** — snapshot live world, then overwrite from a tagged worldgen version or any retained backup snapshot.

## Automatic Backup

- Take an **automatic world snapshot** on a fixed schedule (daily at a configured time).
- **Before any full restore**, take a backup of the current live world even if a scheduled snapshot already exists that day.
- Store backup artifacts **outside** the live world directory (dedicated backup volume/path). Live world mounts must not be the sole copy of recoverable state.

## Backup Retention Policy

**Daily backups**

- Retain the last **7 days** of daily snapshots.

**Extended backups**

- Retain snapshots from **14 days** ago.
- Retain snapshots from **21 days** ago.
- Retain snapshots from **30 days** ago.

Restore operations may use **any** retained snapshot. Prune anything outside this retention set unless an operator explicitly freezes a snapshot for incident investigation (operational exception; not a gameplay feature).

## Protection and building

### Three layers

1. **Public OSM / world-generated terrain** — immutable for students; students cannot dig or build.
2. **Outside build zones** — students cannot dig or build.
3. **Inside build zones** — students may place nodes; modification rules follow ownership below.

### Ownership rule

All world-generated nodes are immutable.

All player-placed nodes are owned by the placing player.

Only the owner or an administrator may modify or remove a player-placed node.

### Enforcement (`lh_build` or equivalent mature mod)

- Prefer a mature community mod if it fully enforces the ownership rule above with Hub-compatible player names; otherwise use a minimal custom `lh_build`.
- On place: record owner = Luanti username (same identity as Hub-linked `luanti_accounts`).
- On dig/change: allow only owner or administrator (Hub admin/teacher bypass mapped to Luanti admin-capable privileges).
- This is **in-game ownership only** — not Supabase plot registry. Plots stage may layer later without discarding this rule.

### Transitional creative

- Students receive privileges including `interact`, `shout`, and `creative` via existing `auth-sync` privilege mapping.
- Creative is **not** a permanent product rule: economy stage removes `creative` and switches to Hub-granted items; protection + ownership remain valid.
- Administrators get protection/ownership bypass for cleanup and assistance.

### Mutual griefing

- Students **must not** be able to break or edit other students’ placed blocks (requirement confirmed for this MVP).
- Shared-zone free-for-all edit is explicitly rejected.

## Hub / Edge changes

- **Required:** none for auth contracts beyond privilege lists served by `auth-sync` (add/adjust `creative` and bypass flags as needed).
- **Optional:** `LearningCommunityPage` English-only copy stating map scope (Golden Beach–So Kwun Wat) and rules (build in marked zones; only edit blocks you placed).
- **Out of scope:** shop APIs, plot RPCs, inventory grants.

## Error handling

| Case | Behavior |
|------|----------|
| Mint-join failure | Existing Hub errors; world untouched |
| Privilege sync failure on join | Deny/kick; never admit unprotected guest creative |
| Dig immutable / out of zone / others’ blocks | Cancel action + short English hint (“Protected” / “Not your block”) |
| OSM/DEM/voxelize failure | Keep previous live world; non-zero exit |
| Full restore without pre-restore backup | Forbidden; abort restore |
| Backup write failure | Alert operator; do not delete older retained snapshots to “make room” without explicit policy run |
| Partial restore | Forbidden; restore is all-or-nothing |
| Protection refresh failure | Keep previous areas/protection files |

## Exit criteria

1. Student mints Hub credentials and joins the coastal MVP world; coast / major roads recognizable.
2. Public / world-generated nodes: student cannot modify (immutable).
3. Outside build zones: student cannot dig/build.
4. Inside build zones: student A’s placed nodes cannot be edited by student B; A can edit own nodes; administrator can edit any player-placed node.
5. Scheduled automatic backups land outside the live world directory; retention matches the Backup Retention Policy.
6. Admin full restore always snapshots live world first, then can restore from a tagged worldgen version or any retained snapshot.
7. Docs state how economy will revoke `creative` later (no shop implementation required now).
8. MVP mod set excludes Technic, Mesecons, Pipeworks, SmartShop, and other economy/automation/logistics/machine mods.

## File / responsibility map

| Path | Role |
|------|------|
| `luanti/worldgen/` | Bbox, fetch, voxelize, world + protection/zone export, versioning |
| `luanti/mods/lh_auth` | Auth sync + privilege application |
| `luanti/mods/lh_build` (or chosen mature equivalent) | Ownership rule enforcement |
| `luanti/docker-compose.yml` | Mount world + mods + separate backup volume/path |
| Backup store (outside live world) | Scheduled and pre-restore snapshots |
| `src/pages/LearningCommunityPage.tsx` | Optional English scope/rules copy |
| Supabase | Unchanged for plots/shop; accounts remain Stage 1 |

## Future Expansion Candidates

The following mods are **explicitly deferred**. They are not part of Coastal Map MVP. Status for each: **Future Consideration** only—evaluate against Design Principles and a defined learning/operational need before install.

### Travelnet

- **Purpose:** Place linked teleporters for fast travel between stations.
- **Potential Learning Hub use cases:** Move classes between coastal landmarks / build zones without long walks; teacher-set campus waypoints.
- **Status:** Future Consideration

### Mesecons

- **Purpose:** Redstone-like circuitry, sensors, and logic switching.
- **Potential Learning Hub use cases:** Simple STEM logic puzzles; interactive exhibits on the map.
- **Status:** Future Consideration

### Technic

- **Purpose:** Machines, power, and industrial-style progression.
- **Potential Learning Hub use cases:** Later “systems” electives; power/machine labs tied to Hub quests.
- **Status:** Future Consideration

### Pipeworks

- **Purpose:** Item/liquid transport tubes and logistics plumbing.
- **Potential Learning Hub use cases:** Logistics challenges; factory-style classroom projects (with Technic or similar).
- **Status:** Future Consideration

### SmartShop

- **Purpose:** In-world player/admin shops and item exchange UI.
- **Potential Learning Hub use cases:** Optional in-world storefront after Hub economy bridge; display of Hub-purchased catalogues.
- **Status:** Future Consideration

## Risks

- DEM/OSM scale vs voxel resolution looks coarse — mitigate with config re-runs, not hand-edited prod worlds.
- Areas protection + ownership enforcement can interact surprisingly — acceptance tests with two student accounts are mandatory.
- Creative trains “free build” habits — product copy and later economy stage must communicate the tighten.
- Auto build-zone heuristics may miss good sites — support `manual: true` zones and protection refresh without full wipe.
- Custom `lh_build` increases upgrade cost — prefer a mature mod when it fully meets the ownership rule; keep custom surface area minimal.
- Backup disk growth — enforce retention pruning; never keep backups only inside the live world directory.

## Self-review

- No TBD placeholders for MVP behavior; bbox numeric values intentionally live in config after OSM check, not hard-coded here.
- Consistent with Stage 1 auth (poll `auth-sync`, Hub as only student login).
- Scope limited to one implementation plan: coastal import + protection/zones + ownership enforcement + backups + docs/copy.
- Ambiguities resolved: economy deferred; approach = world-first pipeline; geographic subset = Golden Beach–So Kwun Wat; build = creative transition; immutable world-generated nodes; owner-or-admin for player-placed nodes; full restore only after pre-restore backup; OSS/vanilla-first mod policy; listed heavy mods deferred under Future Consideration.
- Review lens applied: security (no unprotected join, ownership/immutability, restore guards), stability (all-or-nothing restore, backup-before-restore), maintainability / upgrade risk (mod scope exclusion, vanilla-first), OSS-first (prefer mature mods; defer Travelnet/Mesecons/Technic/Pipeworks/SmartShop).
