# Learning Community Backup

Snapshot the current **My Learning Community** (`learningHub` / Memory Palace) source trees, related migrations, and schema excerpts.

## Create a backup

```bash
node scripts/create_learning_community_backup.cjs
```

Output goes to a dated folder:

```text
.backups/learning-community-backup-<ISO-timestamp>/
  backup_manifest.json
  RESTORATION_INSTRUCTIONS.md
  STRUCTURE.md
  data/                 # INSERT slices from repo dumps
  source/…              # copied source trees
```

`.backups/` is gitignored. Keep the folder or a `.tar.gz` archive somewhere durable if you need offline recovery.

## What is included

- Room / city / region / shop / sidebar / furniture / map-editor / LearningHub components
- `MemoryPalacePage`, city/region/admin city pages
- `MemoryPalaceContext`, room/city/region/memory hooks & types
- Related utils and admin map/asset tooling
- Matching Supabase migrations (city/region/room/learning_hub keywords)
- Data INSERT sections from `public_data_dump.sql` / `dump.sql` for LC tables

## What is not included

- A brand-new live Supabase export (repo dumps may lag production)
- Google Drive `Learning_Community/` asset binaries

## Restore

See `RESTORATION_INSTRUCTIONS.md` inside the backup folder, or check out the git commit recorded in `backup_manifest.json`.
