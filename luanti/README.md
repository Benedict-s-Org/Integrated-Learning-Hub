# Learning Community Luanti (Stage 1)

Local Luanti server scaffold with Learning Hub authentication bridge (`lh_auth`).

## Prerequisites

- Docker + Docker Compose
- Deployed Supabase Edge Function `luanti-auth`
- `supabase/config.toml` includes `[functions.luanti-auth]` with `verify_jwt = false`
- Secrets:
  - `LUANTI_SERVICE_SECRET` (same value in Edge Function env and `minetest.conf`)
  - `LUANTI_SERVER_HOST` / `LUANTI_SERVER_PORT` for Hub UI display

## Setup

1. Copy config:

```bash
cp minetest.conf.example minetest.conf
```

2. Edit `minetest.conf` and set:
   - `lh_auth.sync_url`
   - `lh_auth.record_login_url`
   - `lh_auth.service_secret`
   - `secure.http_mods = lh_auth`
   - `lh_auth.poll_interval = 1` (recommended)

3. Start:

```bash
docker compose up -d
```

4. In Learning Hub, open **My Learning Community**, generate credentials, wait about 3 seconds, then join from a Luanti client.

## Auth flow

1. Student signs into Learning Hub.
2. Hub calls `luanti-auth/mint-join` (Supabase JWT).
3. `lh_auth` polls `auth-sync` with the service secret and caches password hashes.
4. Student joins with the join password.
5. On login, the mod keeps an established auth entry and calls `record-login`.
6. Reconnect with the same password works until expiry or remint.
7. Unknown names cannot self-register (`create_auth` is refused).

## Docker path troubleshooting

The compose file mounts:

- `./world` → world data
- `./mods/lh_auth` → `.../worldmods/lh_auth`
- `./minetest.conf` → `/etc/luanti/minetest.conf`

If the container image uses a different home directory:

1. Run `docker compose run --rm luanti sh` (or the image shell).
2. Find where worlds and mods load (look under `/var/lib/luanti`, `/home/minetest`, or `/root/.minetest`).
3. Update the volume paths in `docker-compose.yml` to match.
4. Confirm `lh_auth` appears in the server log as registered.

## Notes

- After a Luanti process restart, students may need to remint until durable auth is added in a later stage.
- Stage 1 does not import Tuen Mun OSM/DEM yet (Stage 4).
- Economy/shop/land arrive in Stages 2–3.
