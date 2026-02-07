---
description: Safe development practices to prevent errors and accidental deletions
---

# Safe Development Workflow

This workflow documents common errors encountered during development and best practices to prevent them.

---

## 🚨 Common Errors Encountered

### 1. File Edit Failures (Target Content Not Found)
**Problem**: When editing files, the target content didn't match exactly due to:
- Whitespace differences (spaces vs tabs, trailing spaces)
- Line number drift from previous edits
- Content already modified by earlier changes

**Prevention**:
- Always `view_file` the exact line range before editing
- Use smaller, targeted edits instead of large block replacements
- After a failed edit, re-read the file before retrying
- Don't assume line numbers are stable after edits

---

## 📊 Automatic Error Logging

The system includes an **Error Logger Service** that automatically:
1. **Sanitizes sensitive data** before storing (passwords, tokens, emails, file paths)
2. **Deduplicates errors** by incrementing occurrence count
3. **Categorizes errors** for easy filtering

### Using the Logger

```typescript
import { logError, logLintError, logBuildError, logTypeError } from '@/services/errorLogger';

// Log a generic error
await logError({
    category: 'file_edit',
    error_message: 'Target content not found',
    file_path: 'src/components/MyComponent.tsx',
    solution: 'Re-read the file before editing',
    prevention: 'Use smaller edit chunks',
    tags: ['edit', 'content']
});

// Quick helpers
await logLintError('Unused variable', 'src/App.tsx', 42);
await logBuildError('Module not found', 'ENOENT');
await logTypeError('Property missing', 'src/types.ts');
```

### Security Protections

The logger automatically redacts:
- ❌ API keys and tokens
- ❌ Email addresses
- ❌ File paths containing usernames
- ❌ IP addresses
- ❌ Database connection strings
- ❌ Environment variable values

File paths are normalized to relative paths (e.g., `src/components/...`).


### 2. Missing Import Statements
**Problem**: After editing component JSX, imports like `useState`, `useEffect`, `Package`, `Grid` were missing.

**Prevention**:
- When adding new components/icons, always check the import block first
- When refactoring, verify all used symbols are still imported
- Keep imports organized: React hooks → External libs → Internal components → Types

### 3. Unused Variable Warnings
**Problem**: Lint errors for declared but unused variables (`apiStatus`, `handleRefine`, `refinementPrompt`).

**Prevention**:
- When removing UI elements, also remove their associated state/handlers
- Use IDE lint feedback to clean up unused code immediately
- Before committing, run `npm run lint` to catch warnings

### 4. Type Mismatches
**Problem**: `FurnitureItem` required `icon` but catalog items didn't provide it.

**Prevention**:
- When adding new data sources, check the type definition first
- Make optional fields explicit with `?` in interfaces
- Use `Partial<T>` or create variants for different use cases

---

## 🛡️ Protective Measures

### Before Destructive Operations

```bash
# NEVER run these without confirmation:
rm -rf [folder]
git reset --hard
git clean -fd
DROP TABLE
DELETE FROM
```

**Best Practice**:
1. List contents first: `ls -la [folder]`
2. Use dry-run when available: `rm -i` or `git clean -n`
3. Move to trash instead of delete: `mv [file] ~/.Trash/`
4. Create backups before bulk operations

### Folder Rename/Move Operations

**Instead of**:
```bash
rm -rf old-folder && mkdir new-folder
```

**Use**:
```bash
mv old-folder new-folder  # Preserves contents
```

### Database Operations

**Always**:
1. Create a backup before migrations: `npx supabase db dump -f backup.sql`
2. Test migrations on a staging environment first
3. Use transactions for multi-step changes
4. Keep migration files versioned in git

---

## 📋 Pre-Edit Checklist

Before making changes, verify:

- [ ] **Read the file** - View the exact lines you're editing
- [ ] **Check imports** - Will new components need imports?
- [ ] **Check types** - Does the change match expected types?
- [ ] **Check dependencies** - Will removing code break other files?
- [ ] **Backup if needed** - Is this a critical file?

---

## 🔄 Recovery Procedures

### If You Accidentally Delete Files

```bash
# Check git status
git status

# If file was tracked, restore it
git checkout -- path/to/file

# If recently deleted, check reflog
git reflog

# If committed, revert the commit
git revert [commit-hash]
```

### If You Break the Build

```bash
# Quick reset to last working state
git stash                    # Save current changes
git checkout main            # Go to stable branch
npm run build                # Verify build works
git stash pop                # Bring back changes and debug
```

### If Database Gets Corrupted

```bash
# Restore from backup
npx supabase db reset        # Reset to migrations
# OR
psql -f backup.sql           # Restore from dump
```

---

## 📁 Protected Folders

These folders should NEVER be deleted without explicit user confirmation:

| Folder | Reason |
|--------|--------|
| `src/` | All source code |
| `public/` | Static assets |
| `supabase/migrations/` | Database schema history |
| `.git/` | Version control history |
| `node_modules/` | Dependencies (can be rebuilt but takes time) |

---

## 🏷️ Safe Naming Conventions

### For Temporary/Experimental Files
- Prefix with `_temp_` or `_draft_`
- Use `.backup` extension for copies
- Date stamp important backups: `file_2024-02-07.backup`

### For Assets
- Use descriptive names: `orange_sofa.png` not `image1.png`
- Include category: `furniture_couch_modern.png`
- Avoid spaces: use underscores or hyphens

---

## ✅ Post-Edit Verification

After making changes:

1. **Check for lint errors**: Look at IDE feedback
2. **Verify build**: `npm run build` should pass
3. **Test functionality**: Does the feature still work?
4. **Review git diff**: `git diff` to see all changes
5. **Commit incrementally**: Small, focused commits

---

## 🔒 Git Safety Commands

```bash
# Save work before risky operations
git stash push -m "Before [operation]"

# Create a safety branch
git checkout -b backup/before-refactor

# Verify what will be deleted
git clean -n     # Dry run
git reset --dry-run HEAD~1

# Protect important branches
git config branch.main.protect true
```

---

## 📝 Session Notes Template

When starting a complex task, document:

```markdown
## Task: [Description]
## Date: [YYYY-MM-DD]

### Files to Modify
- [ ] file1.tsx
- [ ] file2.ts

### Backup Created
- [x] Git commit: abc1234

### Rollback Plan
If something breaks:
1. git checkout abc1234 -- path/to/file

### Completion Checklist
- [ ] All edits applied
- [ ] Lint errors resolved
- [ ] Build passes
- [ ] Feature tested
```
