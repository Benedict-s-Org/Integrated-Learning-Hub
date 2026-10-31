# Learning Community → Luanti Design

**Status:** Approved  
**Date:** 2026-10-28 (Asia/Hong_Kong)  
**Source:** Learning Community Master Spec v0.5  
**Product decision:** Replace isometric Memory Palace / City / Region community UI entirely (option 2.A). Unrelated Learning Hub features stay.

## Goals

Replace the React isometric “My Learning Community” world with a Luanti (formerly Minetest) server, keeping Learning Hub as the only student login and Supabase as master data for users, coins, inventory, land, and audit.

## Non-goals (v0.5 open / later)

- Trading between students  
- Shared community land rules  
- Blueprint system  
- Final shop catalogue and coin pricing model  
- In-browser voxel client (native Luanti client)

## Architecture

```
Learning Hub (React)
  → Supabase Auth + public.users
  → Edge Functions (mint join credentials, mod APIs)
  → Luanti Server (terrain, blocks, buildings, world state)
```

**Account chain:** Supabase Auth user → `public.users` (Learning Hub) → `luanti_accounts` (1:1).

**Auth model:** Students never manage separate Luanti credentials. Hub mints short-lived join passwords; a Luanti auth mod syncs them from Supabase over HTTPS (shared service secret). Native Luanti SSO is not available yet upstream.

**Data ownership:**

| Store | Owns |
|-------|------|
| Supabase | Users, roles, coins, inventory, land ownership/permissions, audit log, Luanti account links |
| Luanti | Terrain, blocks, buildings, world state |

**World scope (Stage 4):** Hong Kong → Tuen Mun District. OSM facilities (schools, libraries, government, hospitals, parks, major roads, coastlines, rivers). DEM for height. Exclude residential estates and most commercial/private buildings.

**Economy:** Coins remain the only currency; admins add/remove via existing Hub coin flows (`coinService` / `user_room_data`). Shop spends coins for blocks/decorations (Stage 2).

**Roles:** System Admin, School Admin, Teacher, Student — mapped to Hub roles + Luanti privileges. System Admin may override gameplay restrictions; all admin actions are audited.

## Stages

### Stage 0 — Spec & contracts
This document plus API sketches. No product behavior change.

### Stage 1 — Foundation
- New Learning Community page (replace `MemoryPalacePage` for `learningHub`)
- Tables: `luanti_accounts`, `luanti_join_secrets`, `admin_audit_log`
- Edge Function `luanti-auth`: mint join credentials (JWT), get-auth sync for Luanti mod (service secret)
- Docker Compose Luanti scaffold + `lh_auth` mod
- Remove isometric Shop / City / Region nav controls
- Keep isometric code out of student path; full archive in Stage 4

**Exit:** Logged-in student with `can_access_learning_hub` can mint credentials and join Luanti with Hub session only.

### Stage 2 — Economy bridge
Hub shop + inventory in Supabase; Luanti grants placeable items; role→priv mapping.

### Stage 3 — Private plots
`luanti_plots`, claim/assign/reclaim RPCs, protection alignment, school admin land tools.

### Stage 4 — Tuen Mun world
OSM + DEM import pipeline; admin import/restore; archive leftover isometric community code from nav/admin.

### Stage 5 — Admin hardening
Full override policy, audit coverage, suspend/reactivate, inventory restore. Leave pricing/catalogue/trading/shared land open.

## Stage 1 API contracts

### `POST /functions/v1/luanti-auth/mint-join`
- Auth: Supabase JWT (student or admin)
- Ensures `luanti_accounts` row (username derived from Hub username, Luanti-safe)
- Creates/rotates join secret (TTL default 10 minutes)
- Writes `admin_audit_log` when an admin mints for another user (future); self-mint logged as `luanti.mint_join`
- Response: `{ luantiUsername, password, serverHost, serverPort, expiresAt }`

### `GET /functions/v1/luanti-auth/auth-sync`
- Auth: `X-Luanti-Service-Secret` header (not student JWT)
- Returns active join secrets for the auth mod to hash and cache:  
  `{ accounts: [{ luantiUsername, password, privileges, expiresAt }] }`

### `POST /functions/v1/luanti-auth/record-login`
- Auth: service secret  
- Body: `{ luantiUsername }`  
- Marks secret used, updates `last_login_at`, audit `luanti.login`

## UI copy (English only)

- Nav label remains **My Learning Community**
- Page explains install/open Luanti client, shows host/port/username/password, **Generate join credentials** / **Copy** actions
- No Chinese strings in UI

## Risks

- Luanti password hash must be computed inside the game engine (`core.get_password_hash`); Hub stores plaintext join secret only until expiry and only readable by service role / auth-sync
- Edge Function → student path does not require inbound HTTP into Luanti; mod polls `auth-sync`
- Production needs `LUANTI_SERVICE_SECRET`, `VITE_LUANTI_SERVER_HOST`, `VITE_LUANTI_SERVER_PORT`

## Stage 1 hardening (2026-10-29)

- `lh_auth` refuses `create_auth` / client `set_password`; only Hub-minted names authenticate
- Established login cache survives `record-login` (reconnect until expiry/remint; remint after server restart)
- One unused join secret per account (partial unique index)
- `supabase/config.toml` registers `luanti-auth` with `verify_jwt = false`
- Service secret compared in constant time; expired/used secrets purged on mint/sync
- UI asks students to wait ~3 seconds after mint before join

## Self-review

- No unresolved placeholders for Stage 1 behavior  
- Stages 2–5 intentionally deferred; contracts above are Stage 1 only  
- Aligns with master spec auth, SoT, and replace-entirely decision  
- Does not delete Memory Palace source in Stage 1 (avoids massive unrelated churn); student entry is cut over
