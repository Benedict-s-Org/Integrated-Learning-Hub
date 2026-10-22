const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR_NAME = `essay-marking-backup-${TIMESTAMP}`;
const BACKUP_ROOT = path.join(PROJECT_ROOT, '.backups', BACKUP_DIR_NAME);

const FILES_TO_BACKUP = [
  // 1. Prompt File
  'bridges/essay-marking-bridge/prompts/essay-marking.md',

  // 2. Bridge Configuration, Code & Environment
  'bridges/essay-marking-bridge/package.json',
  'bridges/essay-marking-bridge/.env.example',
  'bridges/essay-marking-bridge/.env',
  'bridges/essay-marking-bridge/src/config.js',
  'bridges/essay-marking-bridge/src/server.js',
  'bridges/essay-marking-bridge/src/localModelClient.js',
  'bridges/essay-marking-bridge/src/auth.js',
  'bridges/essay-marking-bridge/src/imageValidator.js',
  'bridges/essay-marking-bridge/src/jobManager.js',
  'bridges/essay-marking-bridge/src/mathpixClient.js',

  // 3. Request/Response Schemas, Types & Services
  'src/modules/essay-marking/types.ts',
  'src/modules/essay-marking/services/essayServiceTypes.ts',
  'src/modules/essay-marking/services/bridgeMarkingService.ts',
  'src/modules/essay-marking/services/essayServiceRegistry.ts',
  'src/modules/essay-marking/services/unconfiguredServices.ts',

  // 4. State & Persistence & Batch/Background Queue Logic
  'src/modules/essay-marking/utils/essayMarkingStorage.ts',
  'src/modules/essay-marking/utils/backgroundMarkingQueue.ts',
  'src/modules/essay-marking/utils/markingBatchQueue.ts',
  'src/modules/essay-marking/utils/markingTextAlignment.ts',
  'src/modules/essay-marking/utils/continuationPageLogic.ts',
  'src/modules/essay-marking/utils/transcriptionBatchQueue.ts',
  'src/modules/essay-marking/hooks/useEssayTranscription.ts',

  // 5. Frontend Components & Report Generation Code
  'src/modules/essay-marking/EssayMarkingPage.tsx',
  'src/modules/essay-marking/components/MarkingReviewPanel.tsx',
  'src/modules/essay-marking/components/InlineMarkingView.tsx',
  'src/modules/essay-marking/components/ReportPanel.tsx',
  'src/modules/essay-marking/components/BatchMarkingModal.tsx',
  'src/modules/essay-marking/components/BatchMarkingProgressBanner.tsx',
  'src/modules/essay-marking/components/WorkflowStepper.tsx',
  'src/modules/essay-marking/components/WorkbenchHeader.tsx',
  'src/modules/essay-marking/utils/htmlReportGenerator.ts',
  'src/modules/essay-marking/utils/markdownReportGenerator.ts',
  'src/modules/essay-marking/utils/docxReportGenerator.ts',

  // 6. Relevant Tests
  'bridges/essay-marking-bridge/test/server.test.js',
  'src/test/modules/essay-marking/bridgeMarkingService.test.ts',
  'src/test/modules/essay-marking/markingBatchQueue.test.ts',
  'src/test/modules/essay-marking/markingReviewPanel.test.tsx',
  'src/test/modules/essay-marking/unifiedVerifyReviewMarking.test.tsx',
  'src/test/modules/essay-marking/exportAllReportsHtml.test.tsx',
  'src/test/modules/essay-marking/reportAnnotationRegression.test.ts',
  'src/test/modules/essay-marking/minimalUnitAndReportAnnotation.test.ts',
  'src/test/modules/essay-marking/sessionPersistenceAndErrorLog.test.tsx',
  'src/test/modules/essay-marking/matchedStudentOrderPreservation.test.tsx',
];

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

console.log(`[Backup] Initializing backup at: ${BACKUP_ROOT}`);
if (!fs.existsSync(BACKUP_ROOT)) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
}

const manifestEntries = [];
let allPassed = true;

for (const relPath of FILES_TO_BACKUP) {
  const srcPath = path.join(PROJECT_ROOT, relPath);
  const destPath = path.join(BACKUP_ROOT, relPath);

  if (!fs.existsSync(srcPath)) {
    console.error(`[Backup ERROR] Source file not found: ${relPath}`);
    allPassed = false;
    continue;
  }

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Copy file
  fs.copyFileSync(srcPath, destPath);

  // Compute checksums
  const srcHash = computeSha256(srcPath);
  const destHash = computeSha256(destPath);
  const srcStat = fs.statSync(srcPath);
  const destStat = fs.statSync(destPath);

  const isMatch = srcHash === destHash && srcStat.size === destStat.size;
  if (!isMatch) {
    console.error(`[Backup ERROR] Integrity mismatch for ${relPath}`);
    allPassed = false;
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
}

// Check and save git previous prompt version
let gitPromptRecovered = false;
let gitPromptHash = null;
let gitPromptSize = 0;
try {
  const previousPromptContent = execSync('git show fa05dbb:bridges/essay-marking-bridge/prompts/essay-marking.md', {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  if (previousPromptContent && previousPromptContent.trim().length > 0) {
    const gitPromptDest = path.join(BACKUP_ROOT, 'bridges/essay-marking-bridge/prompts/essay-marking.git-fa05dbb.md');
    fs.writeFileSync(gitPromptDest, previousPromptContent, 'utf8');
    gitPromptHash = crypto.createHash('sha256').update(Buffer.from(previousPromptContent, 'utf8')).digest('hex');
    gitPromptSize = Buffer.byteLength(previousPromptContent, 'utf8');
    gitPromptRecovered = true;
    console.log(`[Backup] Successfully retrieved previous committed prompt from fa05dbb (sha256: ${gitPromptHash})`);
  }
} catch (gitErr) {
  console.warn('[Backup] Notice: Could not extract git prompt version:', gitErr.message);
}

const manifest = {
  backupId: BACKUP_DIR_NAME,
  createdAt: new Date().toISOString(),
  totalFiles: manifestEntries.length,
  allVerified: allPassed,
  gitPreviousPrompt: gitPromptRecovered
    ? {
        commit: 'fa05dbbe6a506caf26a705cb120b6dc9403f64b4',
        relativePath: 'bridges/essay-marking-bridge/prompts/essay-marking.git-fa05dbb.md',
        sizeBytes: gitPromptSize,
        sha256: gitPromptHash,
      }
    : null,
  files: manifestEntries,
};

const manifestPath = path.join(BACKUP_ROOT, 'backup_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

// Also write a restoration guide in the backup directory
const restoreGuide = `# Restoration Instructions

This backup was created automatically on ${manifest.createdAt}.

## Backup Metadata
- Backup ID: \`${BACKUP_DIR_NAME}\`
- Files Backed Up: ${manifest.totalFiles}
- All Checksums Verified: ${manifest.allVerified ? 'YES' : 'NO'}

## How to Restore
To restore these files to their original working directory locations without altering any other files:

### Windows PowerShell:
\`\`\`powershell
$backupDir = "${BACKUP_ROOT.replace(/\\/g, '\\\\')}"
$manifest = Get-Content (Join-Path $backupDir "backup_manifest.json") | ConvertFrom-Json

foreach ($file in $manifest.files) {
    $src = $file.backupPath
    $dest = $file.originalPath
    $destParent = Split-Path -Path $dest -Parent
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "Restored: $($file.relativePath)"
}
Write-Host "Restoration complete."
\`\`\`

## Safety Notice
- Secret-bearing environment files (.env) are stored in this backup directory only and credentials were not transmitted or printed.
- To restore the previous git prompt version (fa05dbb), copy \`bridges/essay-marking-bridge/prompts/essay-marking.git-fa05dbb.md\` to \`bridges/essay-marking-bridge/prompts/essay-marking.md\`.
`;

fs.writeFileSync(path.join(BACKUP_ROOT, 'RESTORATION_INSTRUCTIONS.md'), restoreGuide, 'utf8');

console.log(`[Backup Result] Verified: ${allPassed ? 'SUCCESS' : 'FAILED'}, Files: ${manifestEntries.length}`);
console.log(`[Backup Manifest] Written to: ${manifestPath}`);
