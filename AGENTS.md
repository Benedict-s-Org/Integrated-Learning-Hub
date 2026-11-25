# Agent notes — Integrated Learning Hub

## Commit / push → update web

Live: https://learninghub.benedicttsang.uk (Cloud Run, `cloudbuild.yaml`).

When asked to commit and push: also update the live site. Push to `main`, then trigger Cloud Build (`gcloud builds submit --config cloudbuild.yaml` or Console → Cloud Build). `git push origin main` alone may not refresh the site if no auto-trigger fires.

## Elephant-Goldfish Model (EGM)

Shared Cursor install. Do not edit the plugin tree by hand.

EGM artifact directory: .dev/docs
EGM_ROOT: C:\Users\bened\.cursor\plugins\local\egm

Upgrade: `git -C C:\AI\Tools\elephant-goldfish-model pull` then run `C:\AI\Tools\egm-sync.ps1`, then reload Cursor. How-to: `C:\AI\Tools\EGM_HOWTO.md`.
