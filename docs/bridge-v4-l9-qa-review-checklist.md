# Bridge v4 / L9: QA Review Checklist

This checklist is for evaluating the **future implementation** of the L9 design.

## Pre-execution Checks
- [ ] Promote preview required before promote approval.
- [ ] Import preview required before import approval.
- [ ] Promote approval required before promote execution.
- [ ] Import approval required before import execution.
- [ ] Promote and import approvals are completely separate steps.
- [ ] No approval = no promote/import execution possible.

## Approval & Execution Constraints
- [ ] Expired approval is rejected by the backend.
- [ ] Reused approval token is rejected by the backend.
- [ ] Changed candidate rejects the approval.
- [ ] Changed target rejects the approval.
- [ ] Changed selected version rejects the approval.
- [ ] Changed operation (e.g., using a promote token for import) is rejected.
- [ ] Path traversal attempts are rejected.
- [ ] Arbitrary path injections are rejected.

## Data Safety & Integrity
- [ ] Original raw, cleaned, and final outputs are NEVER destructively overwritten.
- [ ] Promote action only records the selected candidate/version.
- [ ] Supabase import NEVER runs automatically after a promote action.
- [ ] Import sends ONLY the approved final candidate and approved metadata.
- [ ] NO raw unreviewed OCR or raw document content is imported.

## Security & Credentials
- [ ] NO Supabase credentials exposed in frontend code.
- [ ] NO Supabase credentials accepted in request bodies.
- [ ] NO Supabase service role key exposed.
- [ ] RLS (Row Level Security) / least-privilege policy is documented and verified on the Supabase side.

## API & Response Safety
- [ ] NO raw content returned in status responses.
- [ ] NO document snippets returned in status responses.
- [ ] NO full absolute local paths returned in any response.

## UX & Documentation
- [ ] UI has clear, unambiguous confirmation copy (matching L9 design requirements).
- [ ] UI does not use forbidden wording ("Promote Now", "Publish", etc.).
- [ ] Direct `/api/promote` legacy endpoint remains blocked.
- [ ] Direct `/api/import` legacy endpoint remains blocked.
- [ ] Supabase write/import remains disabled until formal implementation review.
- [ ] GitHub API integration remains completely disabled.
- [ ] Rollback / recovery instructions exist.
- [ ] Audit log entries are successfully created for all actions.
- [ ] Duplicate import prevention logic is confirmed working.

## Edge Case Testing (To be verified during implementation)
- [ ] Test behavior when Supabase is completely unavailable.
- [ ] Test behavior on duplicate submit / rapid double-click in UI.
- [ ] Test recovery from a partial import failure.
- [ ] Test user cancellation of approvals.
- [ ] Test rejection of attempts to import to a wrong destination/workspace.
