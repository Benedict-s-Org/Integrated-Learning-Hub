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

### 2. Accidental Data Wipe in Migrations
**Problem**: Including immediate execution commands (like `SELECT reset_function();`) in migration files causes them to run automatically during deployment, potentially wiping data or triggering unintended side effects.

**Prevention**:
- **Definition Only**: Migration files should primary contain **definitions** (`CREATE TABLE`, `CREATE FUNCTION`, `ALTER TABLE`), not **executions**.
- **Avoid Immediate SELECT**: Never include `SELECT function_name();` at the end of a migration unless it is a mandatory, one-time data transformation that has been thoroughly tested.
- **Manual Triggering**: Significant actions (like resetting coins or clearing history) should be triggered manually from the Admin UI via an RPC call, not automatically by the database migration system.
- **Dry Run Verification**: Before pushing a migration that modifies data, verify the impact on a local or staging database.

### 3. Missing Import Statements
**Problem**: After editing component JSX, imports like `useState`, `useEffect`, `Package`, `Grid` were missing.

**Prevention**:
- When adding new components/icons, always check the import block first
- When refactoring, verify all used symbols are still imported
- Keep imports organized: React hooks → External libs → Internal components → Types

### 4. Unused Variable Warnings
**Problem**: Lint errors for declared but unused variables (`apiStatus`, `handleRefine`, `refinementPrompt`).

**Prevention**:
- When removing UI elements, also remove their associated state/handlers
- Use IDE lint feedback to clean up unused code immediately
- Before committing, run `npm run lint` to catch warnings

### 5. Type Mismatches
**Problem**: `FurnitureItem` required `icon` but catalog items didn't provide it.

**Prevention**:
- When adding new data sources, check the type definition first
- Make optional fields explicit with `?` in interfaces
- Use `Partial<T>` or create variants for different use cases

### 6. Nested Router Conflict (Blank Page)
**Problem**: React application fails to render (blank screen) because a `MemoryRouter` (or other router) is nested inside a top-level `BrowserRouter`.

**Prevention**:
- Ensure only one top-level Router exists in the application hierarchy.
- If a sub-page or standalone component needs routing, verify it is not already wrapped in a `<Router>` by the main app.
### 7. Supabase Schema-Type Mismatches
**Problem**: Auto-generated types in `src/integrations/supabase/types.ts` were out of sync with newly created tables/columns, causing persistent lint errors when using `supabase.from('table')`.

**Prevention**:
- When the schema is newer than the types, use double-casting: `((supabase as any).from('table')... as any)`
- Always cast the final result to your app-specific interface: `const data = (res.data || []) as unknown as MyInterface[]`
- Standardize on one field name (e.g., `question_text` vs `question`) across DB and UI to avoid mapping spaghetti.

### 8. React Context Scoping Errors
**Problem**: During refactoring, helper functions were moved outside the `Provider` component, causing them to lose access to local state (`useState` setters) and props (`userId`).

**Prevention**:
- Keep all logic that interacts with component state or props **inside** the component body.
- If a function is moved out, pass all required state and setters as arguments.
- Re-verify scope after any large code movement.

### 9. Refactoring-Induced Syntax Bugs
**Problem**: Large scale `multi_replace_file_content` calls or moving blocks of code often resulted in missing `try` blocks, misplaced `}` or `;`, and broken file structures.

**Prevention**:
- After moving large blocks, `view_file` the entire file to check for structural integrity.
- Pay attention to lint errors like `Declaration or statement expected` or `'}' expected`.
- Break large refactors into smaller, verifiable chunks.

### 10. Lack of Async Feedback (Unresponsive UI)
**Problem**: Heavy async operations (like importing 50 questions) had no loading state, leading to "unresponsive button" complaints.

**Prevention**:
- Every async primary action (Save, Delete, Import) **must** have an `isSaving` or `isLoading` state.
- Disable buttons during these operations to prevent double-submissions.
- Provide clear visual feedback (spinners, success toasts).

### 11. Supabase Query URL Length Limits (400 Bad Request)
**Problem**: Using `.in('id', array)` with a large array (e.g., 50+ UUIDs) generates a GET URL that exceeds the proxy or server's length limit, resulting in a `400 Bad Request` or `414 URI Too Long`.

**Prevention**:
- Never pass an unbounded array directly to an `.in()` query.
- Chunk the array into smaller batches (e.g., 30 items per batch) and use `Promise.all` to fetch them concurrently.
- Alternatively, if the RLS policy automatically restricts rows to what the user needs, fetch all rows and filter client-side.

### 12. Removing Deprecated Exports (SyntaxError Crashes)
**Problem**: Deleting or renaming an export in a shared utility file (e.g., `avatarParts.ts`) causes `Uncaught SyntaxError: The requested module does not provide an export named X` and entirely crashes the application if legacy components still import it.

**Prevention**:
- Before removing an export, perform a workspace-wide search for its usage.
- If a full migration of all dependent components is too large for one PR/session, leave the legacy export in place.
- Explicitly mark it with `// @deprecated` or `// Legacy Support (Do not remove until X is updated)` so future developers know its purpose.

### 13. Interface Synchronization Across Component Trees
**Problem**: Modifying the shape of a data object fetched in a parent component (e.g., swapping `avatar_config` for `equipped_items`), but failing to update the shared interfaces (`UserWithCoins`) and prop declarations in deeply nested child components. This leads to silent data loss at runtime or complex TypeScript compilation errors.

**Prevention**:
- When modifying a core data structure, trace its exact path down the component tree.
- Update the shared interface definition *first*. Let the TypeScript compiler surface the errors in all child components that consume that interface, and fix them systematically from the top down.
- Avoid redefining the same interface in multiple files; export a single shared interface from a common types file to ensure consistency.

### 14. Unpushed Schema Migrations (400 Bad Request)
**Problem**: The application throws `400 Bad Request` or `column X does not exist` when fetching data, despite the code and local Supabase types being perfectly in sync. This happens when the developer connects their local frontend to the **production/online** Supabase instance but forgets to push the latest local migration file.

**Prevention**:
- Always verify if `VITE_SUPABASE_URL` in `.env` is pointing to `localhost` or the production `.supabase.co` URL.
- When adding new columns or tables in a local `supabase/migrations/` file, the online database doesn't magically update. You **must** run `npx supabase db push` before testing the live environment.
- If a post-record `select('new_column')` starts failing with a 400, your remote schema is lagging behind your codebase.

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
- [ ] **Check types** - Does the change match expected types? (Use `as any` if schema is out of sync)
- [ ] **Check scoping** - Are you moving functions outside their state/prop scope?
- [ ] **Check dependencies** - Will removing code break other files?
- [ ] **Loading States** - If adding an async action, did you add an `isLoading` state?
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

## 🚫 CRITICAL: STOP PERFORMING DOM

Do NOT perform automated DOM inspections, element extractions, or subagent-based visual verification. This is a mandatory safety and efficiency rule.

---

## 🌐 Browser Tool Usage Policy

To optimize token usage and ensure accuracy:
1. **Block Automated DOM Verification**: Do NOT use browser subagents or DOM extraction tools for verifying visual changes or UI updates. Automated DOM inspection is generally a waste of tokens and often inaccurate for complex layouts.
2. **Prioritize User Verification**: Whenever a UI change is made, document the change clearly and ASK THE USER to "see if it works" or verify the result manually.
3. **Exploration Only**: Only use browser tools for initial exploration (finding a URL or seeing a basic page structure) if absolutely necessary, but never for verification of your own edits.
4. **Follow User Guidance**: If the user asks to "check", do not run automated scripts. Instead, provide a specific checklist for the USER to verify.

---

## ✅ Post-Edit Verification

After making changes:

1. **Check for lint errors**: Look at IDE feedback
2. **Verify build**: `npm run build` should pass
3. **Strictly Manual Verification**: Do NOT perform automated browser DOM inspection or subagent tasks to verify UI changes. Instead, inform the user of the changes made and ask them to "see if it works" or verify the results manually. This is the mandatory verification method for all UI-related tasks.
4. **Test functionality**: Does the feature still work?
5. **Review git diff**: `git diff` to see all changes
6. **Commit incrementally**: Small, focused commits

---

## 🛠️ Localhost Connectivity Troubleshooting

If the dev server is running but `localhost` is unreachable:

1. **Check Process**: Run `ps aux | grep vite` to see if the server is actually running.
2. **Check Port**: Run `lsof -i :8080` to see if a process is listening on the expected port.
3. **Host Binding**: Ensure `vite.config.ts` uses `server.host: true` (or `0.0.0.0`). Binding only to `::` (IPv6) can sometimes fail if the system expects `127.0.0.1` (IPv4).
4. **Restart**: If the port is stuck, kill the process with `kill -9 <PID>` and restart `npm run dev`.

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

---

## ⚡ Token Efficiency & Context Management

To ensure work is fast and cost-effective, follow these rules for context retrieval:

### 1. Artifacts as "Active Memory"
Before starting any sub-task, read the `.gemini/antigravity/brain/` directory:
- **`task.md`**: Current checklist and progress.
- **`implementation_plan.md`**: The approved technical roadmap.
- **`walkthrough.md`**: History of what has already been built.

### 2. Knowledge Items (KIs) vs. Chat Logs
- **KIs First**: Always check provided Knowledge Item summaries before researching. They are the distilled "Long-Term Memory" of the project.
- **Logs Last**: Only read raw chat logs if a KI is missing or ambiguous. Reading logs is token-expensive and prone to noise.

### 3. Targeted Code Reading
- **Range-Limited**: Use `view_file` with `StartLine` and `EndLine` to read only relevant logic. 
- **Search First**: Use `grep_search` or `view_file_outline` to locate code rather than scrolling through whole files.
- **Outline First**: Use `view_file_outline` to understand file structure before reading the content.
```
