# Learning Community Luanti (Stage 1)

Local Luanti server scaffold with Learning Hub authentication bridge (`lh_auth`).

## Prerequisites

- Docker + Docker Compose
- Deployed Supabase Edge Function `luanti-auth`
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

3. Start:

```bash
docker compose up -d
```

4. In Learning Hub, open **My Learning Community**, generate credentials, and join from a Luanti client.

## Auth flow

1. Student signs into Learning Hub.
2. Hub calls `luanti-auth/mint-join` (Supabase JWT).
3. `lh_auth` polls `auth-sync` with the service secret and caches password hashes.
4. Student joins with the one-time password.
5. On login, mod calls `record-login`.

## Notes

- Image path/layout may vary by Luanti image tag; adjust volume mounts if the container uses a different home directory.
- Stage 1 does not import Tuen Mun OSM/DEM yet (Stage 4).
- Economy/shop/land arrive in Stages 2–3.
