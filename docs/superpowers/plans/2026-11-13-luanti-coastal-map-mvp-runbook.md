# Luanti Coastal Map MVP Operational Runbook

**Status:** Ready for operators  
**Date:** 2026-11-13 (Asia/Hong_Kong)  
**Source of truth:** `docs/superpowers/specs/2026-11-13-luanti-coastal-map-mvp-design.md` (frozen)  
**Related:** `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp.md`, `docs/superpowers/plans/2026-11-13-luanti-coastal-map-mvp-acceptance.md`

## Operator principles

- Prefer diagnosis over immediate full restore.
- Never restore without a successful **pre-restore backup**.
- Never delete retained backups only to free disk during an incident without an explicit prune decision.
- Do not install Technic, Mesecons, Pipeworks, SmartShop, or other excluded gameplay mods to “fix” incidents.
- Keep changes within frozen MVP scope (auth, worldgen, protection, ownership, backup/restore).

## Quick reference paths

| Item | Location (as deployed) |
|------|------------------------|
| Compose / Luanti | `luanti/docker-compose.yml` |
| Live world | Live world mount (not the backup store) |
| Backup store | Separate backup volume/path |
| Worldgen | `luanti/worldgen/` |
| Auth mod | `luanti/mods/lh_auth` |
| Ownership | `lh_build` or chosen mature equivalent |
| Hub auth | Supabase Edge Function `luanti-auth` |

---

## Incident: Student cannot join

### Symptoms

- Student reports mint or Luanti login failure.
- Client shows authentication error; student never appears in-world.

### Diagnostics

1. Confirm student can log into Learning Hub and open My Learning Community.
2. Confirm mint-join succeeds (credentials shown: host, port, username, password, expiry).
3. Confirm Luanti container is running and port reachable from the client network.
4. Confirm clock/expiry: password still within TTL.
5. Check `lh_auth` / server logs for auth-sync HTTP errors or secret mismatch.
6. Confirm `LUANTI_SERVICE_SECRET` matches Edge Function and `minetest.conf`.

### Recovery Procedure

1. If Hub mint fails: fix Hub/Edge Function/JWT session first; do not create manual Luanti accounts.
2. If mint OK but client fails: regenerate credentials and retry within TTL.
3. If server down: `docker compose` up; verify health; retry join.
4. If secret mismatch: align secrets; restart Luanti; retry auth-sync; have student re-mint.
5. After recovery, Student A smoke-test AT-01.

### Escalation Criteria

- Edge Function outage affecting all students.
- Persistent auth-sync 4xx/5xx after secret alignment.
- Network path to Luanti blocked for classroom subnet with no local fix.

---

## Incident: Authentication sync failure

### Symptoms

- Players kicked or denied on join.
- Logs show auth-sync failures; privilege list not applied.
- Spec requirement: never leave unprotected guest creative.

### Diagnostics

1. From Luanti host, call auth-sync endpoint with service secret (as documented in `luanti/README.md`).
2. Inspect HTTP status and body (`accounts` / privileges).
3. Compare `LUANTI_SERVICE_SECRET` across Edge Function env and Luanti config.
4. Check Edge Function deployment status and Supabase project health.
5. Confirm `lh_auth` poll interval and last successful sync timestamp in logs.

### Recovery Procedure

1. Restore Edge Function availability and correct secret.
2. Restart or signal `lh_auth` to repoll if required by mod design.
3. Verify sync returns student privileges including transitional `creative` and admin bypass flags.
4. Allow a test student to join; confirm deny/kick no longer occurs.
5. Do **not** temporarily disable ownership/protection to let students in.

### Escalation Criteria

- Cannot restore auth-sync within one class period.
- Suspected credential leak of `LUANTI_SERVICE_SECRET` (rotate secret; redeploy; restart).

---

## Incident: Backup failure

### Symptoms

- Scheduled job errors; missing daily snapshot in backup store.
- Alerts on backup write failure.
- Pre-restore backup step fails.

### Diagnostics

1. Check backup job logs and exit code.
2. Verify backup store path exists, is mounted, and is **outside** the live world directory.
3. Check free disk on the backup volume.
4. Confirm permissions for the backup user/container.
5. List recent snapshots; confirm retention prune did not run mid-write incorrectly.

### Recovery Procedure

1. Fix mount, permissions, or path configuration.
2. Manually run the **same** backup script used by the schedule; confirm artifact appears in backup store.
3. If disk full, follow **Disk full** incident — do not silently delete arbitrary snapshots.
4. Resume schedule; verify next automatic run.
5. If a restore was blocked solely by backup failure, only retry restore after a successful backup.

### Escalation Criteria

- No successful backup for 48 hours.
- Backup store corruption or repeated write failures after disk/permission fixes.

---

## Incident: Restore failure

### Symptoms

- Full restore aborts or world does not match selected source.
- Fear of partial terrain mix after interrupted restore.

### Diagnostics

1. Confirm whether **pre-restore backup** completed (required).
2. Identify restore source: tagged worldgen version vs retained snapshot.
3. Check restore script logs for mid-copy errors, disk full, or permission errors.
4. Verify live world mount target and that restore is all-or-nothing (no manual file cherry-picks).
5. If restore aborted early, determine whether live world was left untouched or inconsistent.

### Recovery Procedure

1. If pre-restore backup missing/failed: **stop**; do not continue overwrite.
2. If live world inconsistent: restore from the pre-restore backup taken at start of the failed attempt (if valid), or from the last known good retained snapshot.
3. Free space / fix permissions; re-run full restore from a chosen retained snapshot or tagged artifact.
4. Restart Luanti; verify with AT-05/AT-07 smoke checks.
5. Never apply “partial” file copies to “finish” a failed restore.

### Escalation Criteria

- No valid retained snapshot and no tagged worldgen artifact available.
- Repeated restore failures after disk and permission fixes.

---

## Incident: World corruption

### Symptoms

- Crashes on load; missing mapblocks; extreme terrain glitches; players fall through world.
- Suspected incomplete write or disk fault.

### Diagnostics

1. Capture Luanti logs and last successful backup timestamp.
2. Confirm whether corruption followed worldgen, protection refresh, or restore.
3. Check disk health and free space on live and backup volumes.
4. Inventory retained snapshots (7 / 14 / 21 / 30 policy) and tagged worldgen versions.

### Recovery Procedure

1. Stop Luanti to prevent further writes.
2. Take a forensic copy of the corrupt live world into backup store **if space allows**, and freeze that snapshot for investigation (retention exception).
3. Full restore from last known good retained snapshot (prefer recent daily); if map content is wrong but engine OK, consider tagged clean worldgen version (accepts loss of player builds per MVP).
4. Ensure pre-restore backup step runs against current (stopped) live data before overwrite when procedure allows.
5. Start server; run AT-01, AT-05, AT-07.

### Escalation Criteria

- Hardware/disk failure suspected.
- All retained snapshots also fail to load.

---

## Incident: Disk full

### Symptoms

- Backup failures; restore failures; container cannot write; OS disk warnings.

### Diagnostics

1. Identify which volume is full: live world, backup store, or host root.
2. Measure size of live world vs backup store.
3. List snapshots; compare to retention policy (last 7 dailies + 14/21/30-day keeps).
4. Check for accidental large files inside live world or log growth.

### Recovery Procedure

1. Do **not** delete random backups under pressure without checking retention.
2. Run the **official retention prune** to remove snapshots outside policy (preserve frozen investigation snapshots).
3. If still full: expand backup volume or archive a frozen incident snapshot offline, then prune.
4. Clear rotatable logs if appropriate.
5. Re-run backup job; confirm success before class use.
6. Do not move the only backup copy into the live world directory.

### Escalation Criteria

- Cannot free enough space via policy prune for next daily backup.
- Live world volume full (risk of corruption) — emergency expand or restore-to-larger-volume plan.

---

## Incident: OSM import failure

### Symptoms

- Worldgen pipeline exits non-zero (OSM/DEM fetch, filter, or voxelize).
- No new version tag produced.

### Diagnostics

1. Read worldgen logs for fetch, filter, or voxelize stage.
2. Confirm bbox config and network access to OSM/DEM sources.
3. Confirm staging output path writable.
4. Verify live world was **not** modified (spec: keep previous live world).

### Recovery Procedure

1. Leave live world serving the previous good version.
2. Fix network, credentials, bbox, or DEM inputs.
3. Re-run pipeline to staging/versioned output only.
4. Only promote/replace live world via **full restore** flow (with pre-restore backup), never by partial copy from a failed run.
5. Smoke-test terrain recognizability after successful promote.

### Escalation Criteria

- Upstream OSM/DEM unavailable beyond local workaround window.
- Pipeline succeeds but terrain unusable (escalate to worldgen maintainer; do not hand-edit prod world).

---

## Incident: Ownership enforcement failure

### Symptoms

- Students can dig others’ placed nodes.
- World-generated nodes become diggable by students.
- Owner cannot edit own nodes; admin bypass missing.

### Diagnostics

1. Confirm ownership mod (`lh_build` or chosen mature equivalent) is loaded in the world/mod list.
2. Check mod errors in Luanti log.
3. Reproduce with Student A place → Student B dig (AT-08) and admin dig (AT-10).
4. Confirm player names match Hub-linked Luanti usernames.
5. Confirm no excluded mods introduced conflicting protection behavior.

### Recovery Procedure

1. If mod crashed/unloaded: fix error, restart Luanti, retest AT-05/AT-08/AT-09/AT-10.
2. If misconfiguration: restore last known good mod config from backup/repo; restart.
3. If griefing already occurred: administrator cleanup; optionally full restore from retained snapshot if damage is widespread.
4. Do not disable protection globally to unblock building.

### Escalation Criteria

- Ownership rule cannot be enforced after restart and config rollback.
- Suspected mod incompatibility after an upgrade — roll back Luanti/mod versions to last known good.

---

## Incident: Protection refresh failure

### Symptoms

- Refresh protection command/script fails.
- Operators worry zones/public protection were wiped.

### Diagnostics

1. Read refresh script logs.
2. Confirm previous areas/protection files still present (spec: keep previous on failure).
3. In-game verify AT-05 and AT-06 still behave as before.
4. Validate new export files in staging before any swap.

### Recovery Procedure

1. Abort any manual overwrite of protection files.
2. Keep serving previous areas/protection files.
3. Fix export/path/permission issues in staging.
4. Re-run refresh only after staging validation.
5. Retest public immutability and outside-zone deny.

### Escalation Criteria

- Protection files missing or empty on live mount (treat as urgent): restore protection files from pre-refresh backup or last good snapshot **without** unnecessary full world wipe if only protection data is affected; if unsure, full restore from last good retained snapshot via standard restore procedure.

---

## Post-incident checklist

1. Confirm students can join (AT-01).
2. Confirm immutable public nodes and build-zone denies (AT-05, AT-06).
3. Confirm ownership (AT-08, AT-09) and admin override (AT-10).
4. Confirm latest backup exists outside live world.
5. Record: time, impact, actions, snapshot names used, follow-ups.
