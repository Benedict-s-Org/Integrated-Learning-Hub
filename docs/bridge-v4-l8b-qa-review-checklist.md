# Bridge v4 / L8B: QA Review Checklist

This checklist is intended for the future implementation review of the L8B Human-approved Retry Action. 

**Note:** L8B is design-only. This checklist must be executed during the actual implementation phase.

## Approval & Execution Controls
- [ ] Approval required before retry execution.
- [ ] No approval = no retry.
- [ ] Expired approval rejected gracefully.
- [ ] Reused approval token rejected (double-submit protection).
- [ ] Changed preview state rejected (preview drift).
- [ ] Changed target rejected (target swapping).
- [ ] Changed selected engine rejected (engine swapping).
- [ ] Changed operation rejected (operation swapping).

## Input & Injection Protection
- [ ] Traversal rejected (e.g., `../`, `..\` in identifiers).
- [ ] Arbitrary path input rejected.
- [ ] Arbitrary engine injection rejected (must be allowlisted).

## File System Integrity
- [ ] Original raw/cleaned/final outputs are NEVER modified.
- [ ] Retry output is written strictly as a separate variant (e.g., `.retry.marker.md`).
- [ ] No automatic promote occurs after retry execution.
- [ ] Output write is atomic (or cleans up on partial failure).
- [ ] Rollback info / variant tracking exists.

## Audit & Response Safety
- [ ] Audit log entry is generated for every execution attempt.
- [ ] No raw content returned in the API response.
- [ ] No document snippets returned.
- [ ] No full local paths returned.

## UX & Wording Validation
- [ ] UI has clear confirmation copy (e.g., "This will create a separate retry variant only").
- [ ] UI does NOT use ambiguous or dangerous wording (e.g., "Auto Retry", "Fix All").

## Perimeter Enforcement
- [ ] Direct `/api/retry` remains blocked.
- [ ] Direct `/api/clean` remains blocked.
- [ ] `/api/promote` remains blocked.
- [ ] Supabase write/import remains disabled.
- [ ] GitHub API remains disabled.

## Edge Case Testing
- [ ] Tests cover external engine unavailable at execution time.
- [ ] Tests cover failure/crash during variant write.
- [ ] Tests cover user cancellation (abandoned approval).
- [ ] Tests cover multi-click / double-submit of the execute button.
