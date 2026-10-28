/**
 * Learning Community (Memory Palace / learningHub) source + schema backup.
 *
 * Mirrors scripts/create_essay_marking_backup.cjs:
 * - Copies current LC source trees into .backups/learning-community-backup-<timestamp>/
 * - Verifies SHA-256 for every copied file
 * - Snapshots related SQL migrations + CREATE TABLE excerpts from dump.sql
 * - Writes backup_manifest.json + RESTORATION_INSTRUCTIONS.md
 *
 * Usage: node scripts/create_learning_community_backup.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR_NAME = `learning-community-backup-${TIMESTAMP}`;
const BACKUP_ROOT = path.join(PROJECT_ROOT, '.backups', BACKUP_DIR_NAME);

/** Top-level directories to copy recursively (relative to project root). */
const DIRS_TO_BACKUP = [
  'src/components/room',
  'src/components/city',
  'src/components/region',
  'src/components/sidebar',
  'src/components/shop',
  'src/components/LearningHub',
  'src/components/furniture',
  'src/components/map-editor',
  'src/components/editor',
];

/** Individual files (pages, context, hooks, types, utils, admin tooling). */
const FILES_TO_BACKUP = [
  'src/pages/MemoryPalacePage.tsx',
  'src/pages/CityPage.tsx',
  'src/pages/RegionPage.tsx',
  'src/pages/AdminCityEditorPage.tsx',
  'src/contexts/MemoryPalaceContext.tsx',
  'src/hooks/useRoomData.ts',
  'src/hooks/useRoomInteraction.ts',
  'src/hooks/useRoomLayout.ts',
  'src/hooks/useInventory.ts',
  'src/hooks/useMemoryPoints.ts',
  'src/hooks/useCityLayout.ts',
  'src/hooks/useAdminCityLayout.ts',
  'src/hooks/useRegion.ts',
  'src/hooks/useStudySession.ts',
  'src/types/room.ts',
  'src/types/city.ts',
  'src/types/game.ts',
  'src/types/furniture.ts',
  'src/utils/roomGeometry.ts',
  'src/utils/assetPersistence.ts',
  'src/utils/storageUpload.ts',
  'src/components/MemoryContentModal.tsx',
  'src/components/MemoryPalacePanel.tsx',
  'src/components/MemoryPointModal.tsx',
  'src/components/SpaceDesignCenter.tsx',
  'src/components/admin/UnifiedMapEditor.tsx',
  'src/components/admin/AssetUploader.tsx',
  'src/components/admin/AdminAssetUploader.tsx',
  'src/components/ui-builder/AssetUploadCenter.tsx',
  'MERGE_PLAN.md',
];

/** Migration filename substrings that belong to Learning Community. */
const MIGRATION_KEYWORDS = [
  'learning_hub',
  'city',
  'region',
  'room',
  'user_room',
  'memories',
  'palace',
];

/**
 * Tables whose data sections are sliced from dump.sql / public_data_dump.sql.
 * Repo dumps are data-only (INSERT), not CREATE TABLE.
 */
const DATA_TABLES = [
  'user_room_data',
  'rooms',
  'memories',
  'regions',
  'region_plots',
  'region_map_elements',
  'public_facilities',
  'city_style_assets',
  'city_visits',
];

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function walkFiles(absDir) {
  const results = [];
  if (!fs.existsSync(absDir)) return results;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function collectSourceRelativePaths() {
  const relPaths = new Set(FILES_TO_BACKUP);

  for (const dir of DIRS_TO_BACKUP) {
    const abs = path.join(PROJECT_ROOT, dir);
    for (const absFile of walkFiles(abs)) {
      relPaths.add(path.relative(PROJECT_ROOT, absFile).replace(/\\/g, '/'));
    }
  }

  const migrationsDir = path.join(PROJECT_ROOT, 'supabase/migrations');
  if (fs.existsSync(migrationsDir)) {
    for (const name of fs.readdirSync(migrationsDir)) {
      const lower = name.toLowerCase();
      if (MIGRATION_KEYWORDS.some((k) => lower.includes(k))) {
        relPaths.add(path.join('supabase/migrations', name).replace(/\\/g, '/'));
      }
    }
  }

  return Array.from(relPaths).sort();
}

function copyWithVerify(relPath, manifestEntries) {
  const srcPath = path.join(PROJECT_ROOT, relPath);
  const destPath = path.join(BACKUP_ROOT, 'source', relPath);

  if (!fs.existsSync(srcPath)) {
    console.error(`[Backup ERROR] Source file not found: ${relPath}`);
    return false;
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);

  const srcHash = computeSha256(srcPath);
  const destHash = computeSha256(destPath);
  const srcStat = fs.statSync(srcPath);
  const destStat = fs.statSync(destPath);
  const isMatch = srcHash === destHash && srcStat.size === destStat.size;

  if (!isMatch) {
    console.error(`[Backup ERROR] Integrity mismatch for ${relPath}`);
  }

  manifestEntries.push({
    relativePath: relPath.replace(/\\/g, '/'),
    originalPath: srcPath.replace(/\\/g, '/'),
    backupPath: destPath.replace(/\\/g, '/'),
    sizeBytes: srcStat.size,
    sha256: srcHash,
    backupSha256: destHash,
    verified: isMatch,
    timestamp: new Date().toISOString(),
  });

  return isMatch;
}

function extractTableDataSection(dumpText, tableName) {
  const headerRe = new RegExp(
    `^-- Data for Name: ${tableName}; Type: TABLE DATA; Schema: public; Owner:.*$`,
    'm'
  );
  const headerMatch = headerRe.exec(dumpText);
  if (!headerMatch) return null;

  const start = headerMatch.index;
  const after = dumpText.slice(start + headerMatch[0].length);
  const nextHeader = after.search(/^-- Data for Name: /m);
  const section =
    nextHeader === -1
      ? dumpText.slice(start).trim()
      : dumpText.slice(start, start + headerMatch[0].length + nextHeader).trim();
  return section;
}

function extractDataFromDumps() {
  const preferredSources = ['public_data_dump.sql', 'dump.sql'];
  let sourceName = null;
  let dumpText = null;

  for (const name of preferredSources) {
    const dumpPath = path.join(PROJECT_ROOT, name);
    if (fs.existsSync(dumpPath)) {
      sourceName = name;
      dumpText = fs.readFileSync(dumpPath, 'utf8');
      break;
    }
  }

  if (!dumpText) {
    console.warn('[Backup] No dump.sql / public_data_dump.sql found; skipping data excerpt.');
    return null;
  }

  const dataDir = path.join(BACKUP_ROOT, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const tableResults = [];
  const combinedParts = [
    '-- Learning Community data excerpt (INSERT sections)',
    `-- Source: ${sourceName} @ backup ${BACKUP_DIR_NAME}`,
    `-- Generated: ${new Date().toISOString()}`,
    '-- NOTE: Repo dumps are snapshots, not necessarily live production.',
    '',
  ];

  for (const table of DATA_TABLES) {
    const section = extractTableDataSection(dumpText, table);
    const outPath = path.join(dataDir, `${table}.sql`);
    if (section) {
      fs.writeFileSync(outPath, `${section}\n`, 'utf8');
      combinedParts.push(section, '');
      tableResults.push({
        table,
        relativePath: `data/${table}.sql`,
        sizeBytes: Buffer.byteLength(section, 'utf8'),
        found: true,
      });
      console.log(`[Backup] Extracted data section: ${table}`);
    } else {
      const missing = `-- Data section for ${table} not found in ${sourceName}\n`;
      fs.writeFileSync(outPath, missing, 'utf8');
      combinedParts.push(missing);
      tableResults.push({
        table,
        relativePath: `data/${table}.sql`,
        sizeBytes: Buffer.byteLength(missing, 'utf8'),
        found: false,
      });
      console.warn(`[Backup] Missing data section: ${table}`);
    }
  }

  const combinedPath = path.join(dataDir, 'learning_community_data.sql');
  const combined = combinedParts.join('\n');
  fs.writeFileSync(combinedPath, combined, 'utf8');

  return {
    source: sourceName,
    relativePath: 'data/learning_community_data.sql',
    sizeBytes: Buffer.byteLength(combined, 'utf8'),
    sha256: crypto.createHash('sha256').update(combined, 'utf8').digest('hex'),
    tables: tableResults,
  };
}

function getGitMeta() {
  try {
    const commit = execSync('git rev-parse HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }).trim();
    const short = execSync('git rev-parse --short HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }).trim();
    return { commit, branch, short };
  } catch (err) {
    console.warn('[Backup] Could not read git metadata:', err.message);
    return null;
  }
}

console.log(`[Backup] Initializing backup at: ${BACKUP_ROOT}`);
fs.mkdirSync(BACKUP_ROOT, { recursive: true });

const relativePaths = collectSourceRelativePaths();
const manifestEntries = [];
let allPassed = true;

for (const relPath of relativePaths) {
  const ok = copyWithVerify(relPath, manifestEntries);
  if (!ok) allPassed = false;
}

const gitMeta = getGitMeta();

const structureNotes = {
  uiLabel: 'My Learning Community',
  appStatePage: 'learningHub',
  mounts: 'MemoryPalacePage (Memory Palace)',
  views: ['room', 'map (city)', 'region'],
  access: 'can_access_learning_hub || role === admin (+ nav visibility)',
  orphanNote:
    'src/components/LearningHub/* Notion activity grid is included but is not the current learningHub entry point.',
  communityNav: [
    'Shop',
    'City Map',
    'Region Map',
    'Furniture',
    'Memory Points',
    'Room History',
  ],
  primaryTables: DATA_TABLES,
};

const schemaInfo = extractDataFromDumps();

const manifest = {
  backupId: BACKUP_DIR_NAME,
  feature: 'learning-community',
  createdAt: new Date().toISOString(),
  git: gitMeta,
  structure: structureNotes,
  totalFiles: manifestEntries.length,
  allVerified: allPassed,
  dataExcerpt: schemaInfo,
  liveDataNote:
    'Includes INSERT snapshots sliced from repo dump.sql / public_data_dump.sql when present. That is a committed dump snapshot, not a fresh live Supabase export. Re-run `npx supabase db dump` for up-to-date production data.',
  files: manifestEntries,
};

const manifestPath = path.join(BACKUP_ROOT, 'backup_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

const restoreGuide = `# Learning Community Backup — Restoration Instructions

Created: ${manifest.createdAt}
Backup ID: \`${BACKUP_DIR_NAME}\`
Git: ${gitMeta ? `${gitMeta.branch} @ ${gitMeta.short} (${gitMeta.commit})` : 'unavailable'}
Files: ${manifest.totalFiles}
Checksums verified: ${manifest.allVerified ? 'YES' : 'NO'}

## What this backup contains

1. **source/** — Learning Community / Memory Palace source trees (room, city, region, shop, sidebars, furniture studio, map editor, pages, hooks, types, related utils/admin tools).
2. **data/** — INSERT sections for LC tables sliced from \`public_data_dump.sql\` / \`dump.sql\` (repo snapshot, not necessarily live production).
3. **backup_manifest.json** — Per-file SHA-256 checksums and paths.

## Current product structure (at backup time)

- UI: **My Learning Community**
- App state: \`page: 'learningHub'\`
- Renders: \`MemoryPalacePage\` under \`MemoryPalaceContext\`
- Views: room → city map → region map

## Restore source files

\`\`\`bash
BACKUP_DIR=".backups/${BACKUP_DIR_NAME}"
node -e "
const fs=require('fs');const path=require('path');
const m=JSON.parse(fs.readFileSync('$BACKUP_DIR/backup_manifest.json','utf8'));
for (const f of m.files) {
  fs.mkdirSync(path.dirname(f.originalPath),{recursive:true});
  fs.copyFileSync(f.backupPath, f.originalPath);
  console.log('Restored', f.relativePath);
}
"
\`\`\`

## Restore via git (code-only)

If you only need the code state from this backup moment:

\`\`\`bash
git checkout ${gitMeta ? gitMeta.commit : '<commit-from-manifest>'}
\`\`\`

## Fresh live database export

For up-to-date production rows (beyond the repo dump snapshot), export separately:

\`\`\`bash
npx supabase db dump -f learning_community_data.sql --data-only
\`\`\`

## Safety

- No \`.env\` secrets are copied by this script.
- \`.backups/\` is gitignored; keep archives offline or in a private artifact store.
`;

fs.writeFileSync(path.join(BACKUP_ROOT, 'RESTORATION_INSTRUCTIONS.md'), restoreGuide, 'utf8');

const structurePath = path.join(BACKUP_ROOT, 'STRUCTURE.md');
fs.writeFileSync(
  structurePath,
  `# Learning Community Structure Snapshot

- **UI label:** My Learning Community
- **AppState:** \`learningHub\`
- **Page:** \`MemoryPalacePage\`
- **Views:** room / city (map) / region
- **Nav (in community):** Shop, City Map, Region Map, Furniture, Memory Points, Room History
- **Access:** \`can_access_learning_hub\` or admin + nav visibility
- **Git:** ${gitMeta ? `${gitMeta.branch} @ ${gitMeta.commit}` : 'n/a'}
- **Backup ID:** ${BACKUP_DIR_NAME}
`,
  'utf8'
);

console.log(
  `[Backup Result] Verified: ${allPassed ? 'SUCCESS' : 'FAILED'}, Files: ${manifestEntries.length}`
);
console.log(`[Backup Manifest] Written to: ${manifestPath}`);
console.log(`[Backup Root] ${BACKUP_ROOT}`);
