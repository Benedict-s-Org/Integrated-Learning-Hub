# QA Review Checklist: L7A Security Design

## 1. Introduction
This checklist is to be used by QA and Security engineers during the implementation and PR review phase for the L7A milestone.

## 2. Dry-Run & Mutation Prevention
- [ ] Verify that `POST /api/controlled/clean-preview/start` strictly defaults `dry_run` to `true`.
- [ ] Verify that sending `{"dry_run": false}` to the clean-preview endpoint returns a 400/403 error.
- [ ] Verify that `POST /api/controlled/retry-preview/start` strictly defaults `dry_run` to `true`.
- [ ] Verify that sending `{"dry_run": false}` to the retry-preview endpoint returns a 400/403 error.
- [ ] Audit the code path for clean-preview: confirm **no** file deletion, overwrite, or move commands are reachable.
- [ ] Audit the code path for retry-preview: confirm **no** actual OCR, conversion, or heavy operations are executed.

## 3. Input Sanitization
- [ ] Test the `target_file` payload with directory traversal strings (e.g., `../../etc/passwd`, `..\..\Windows\System32`). Confirm the request is rejected.
- [ ] Test with absolute paths (e.g., `/var/log/syslog`). Confirm the request is rejected.
- [ ] Verify that no shell commands (`subprocess.run`, `os.system`) use the `target_file` input directly.

## 4. Output Sanitization & Privacy
- [ ] Inspect the `/status` responses for both clean and retry previews.
- [ ] Confirm full server file paths (e.g., `C:\Users\...`) do not appear in the JSON output.
- [ ] Confirm no `.env` values, API keys, or database URIs are leaked in the output or error messages.
- [ ] Confirm that raw document content is truncated or securely summarized in the preview.

## 5. Architectural Boundaries
- [ ] Verify that no Supabase write/import functions are imported or invoked in the L7A code paths.
- [ ] Verify that no GitHub API clients are instantiated or invoked in the L7A code paths.
- [ ] Confirm that the implementation introduces *only* the preview endpoints and does not accidentally enable the forbidden endpoints (e.g., `/api/promote`, direct `/api/clean`).

## 6. Frontend Safety UX
- [ ] Confirm the UI explicitly labels the new features as "Preview Only".
- [ ] Verify there are no functional "Apply" or "Execute" buttons attached to these preview workflows.
