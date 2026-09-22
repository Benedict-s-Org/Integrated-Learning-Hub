# Bridge v4 / L8A: QA Review Checklist

**Important Note:** This checklist is for evaluating the *future* implementation of L8A.

## Pre-Execution & Approval
- [ ] Approval explicitly required before execution.
- [ ] No approval token = no clean execution.
- [ ] Expired approvals are rejected immediately.
- [ ] Reused/consumed approvals are rejected.
- [ ] Changed preview payload (file drifted on disk) results in approval rejection.
- [ ] Changed target (`jobId` swap) results in approval rejection.
- [ ] Changed operation (e.g., trying to run retry with a clean approval) results in rejection.
- [ ] Path traversal attempts in `jobId` or related fields are rejected.
- [ ] Arbitrary absolute or relative paths are rejected.

## Execution & Filesystem Safety
- [ ] `raw.md` is strictly preserved and NEVER modified by the clean action.
- [ ] Output writes are atomic (e.g., via temp files and rename).
- [ ] Rollback information exists and is utilized if a write fails.
- [ ] Tests explicitly cover failure during write (crash simulations).

## Data Leakage & API Boundaries
- [ ] No raw Markdown content is returned in the API response.
- [ ] No document snippets are returned.
- [ ] No full local paths are returned (only safe display names).
- [ ] Audit log entry is created for approval generation, start, and completion/failure.

## UI & UX Integrity
- [ ] UI features clear, required confirmation copy.
- [ ] UI does not use ambiguous wording (no "Clean Now", "Apply All").
- [ ] Tests cover user cancellation of the approval flow.
- [ ] Tests cover multi-click / double-submit on the execution button (verifying single-use token logic).

## Architectural Boundaries
- [ ] Direct access to legacy `/api/clean` remains blocked.
- [ ] Supabase write/import functionality remains strictly disabled.
- [ ] GitHub API integration remains strictly disabled.
