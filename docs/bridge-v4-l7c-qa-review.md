# Bridge v4 / L7C: Clean / Retry Preview QA Review

## 1. Review Verdict
**VERDICT: PASS WITH FIXES**

The L7B controlled preview implementation successfully blocks actual file mutations, restricts traversal attempts, and prevents the return of raw document contents or internal filesystem metadata to the frontend UI. 

During the QA review, two minor safety findings were identified and proactively fixed in this phase:
1. **TTL Session Cleanup:** The in-memory tracking of preview sessions did not have an expiration mechanism. A TTL (Time-To-Live) cleanup mechanism was added so sessions expire automatically after 1 hour (3600 seconds).
2. **Response Sanitization Verification:** A hardcoded action `fix_markdown_headers` was returning the keyword `markdown`, which violated strict response sanitization rules. This was changed to `fix_headers` to satisfy the security requirement.

## 2. Files Reviewed
- `C:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\backend\main.py`
- `C:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\backend\tests\test_preview_endpoints.py`
- `C:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub\src\pages\AdminLocalMarkdownPipelinePage.tsx`
- `C:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub\docs\bridge-v4-l7b-status.md`

## 3. Files Changed
- `C:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\backend\main.py`: Added in-memory session cleanup logic (`_cleanup_expired_preview_sessions()`) invoked opportunistically on preview start and status requests. Updated `plannedPreviewActions` in clean status response to exclude the word "markdown".
- `C:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\backend\tests\test_preview_endpoints.py`: Expanded with comprehensive assertions for sanitization (asserting no occurrences of rawText, markdown, snippet, traceback, etc.), a test for TTL cleanup (`test_preview_session_ttl_cleanup`), and a test ensuring no files are mutated on disk (`test_no_file_mutation`).

## 4. Tests Added & Updated
- Expanded `test_clean_preview_happy_path` and `test_retry_preview_happy_path` to assert that responses do not contain `rawText`, `snippet`, `fullPath`, `markdown`, `traceback`, absolute paths like `C:\`, `/Users/`, or any raw content representations.
- Added `test_preview_session_ttl_cleanup` to confirm preview session cleanup works correctly.
- Added `test_no_file_mutation` to confirm the local `tmp_path` does not get written to by preview endpoints.
- Re-verified existing tests including dry_run rejection, path traversal rejection, and blocking of legacy endpoints.

**Test Run Results:**
All 11 tests passed successfully using `pytest`. 

## 5. Security Checks Performed
- **Path Validation:** Checked that `target_file` strings with `..`, `/`, and `\` are successfully blocked returning `400 ERR_INVALID_PATH`.
- **Dry-Run Enforcement:** Confirmed that omitting `dry_run=true` or passing `dry_run=false` prevents execution.
- **Frontend Verbiage:** Verified `AdminLocalMarkdownPipelinePage.tsx` uses safe labels like "Generate Clean Preview", "Generate Retry Preview", clearly stating "Preview only — no files will be changed" and omitting any dangerous execution calls like "Apply" or "Promote".
- **Namespace Segregation:** Tested direct local endpoints (`/api/clean`, `/api/retry`, `/api/promote`, `/api/manifest`, etc.) and confirmed they are not bridged into the `/api/controlled/*` namespace, returning `404` or `405`.
- **Memory Leak Mitigation:** Identified and resolved the potential indefinitely expanding `_active_clean_preview_sessions` and `_active_retry_preview_sessions` dictionaries.

## 6. Findings & Fixes
- **Finding:** Preview session memory unbounded.
  - **Fix:** Implemented `_cleanup_expired_preview_sessions()` acting conditionally on the timestamp of the session with `MAX_PREVIEW_AGE_SEC = 3600`.
- **Finding:** Response contained string `"fix_markdown_headers"`.
  - **Fix:** Sanitized output to `"fix_headers"` to strictly align with L7C's prompt constraint avoiding the return of the string `"markdown"`.

## 7. Explicit Confirmations
- **No actual clean execution enabled:** Confirmed.
- **No actual retry execution enabled:** Confirmed.
- **No promote enabled:** Confirmed.
- **No Supabase write/import enabled:** Confirmed.
- **No GitHub API enabled:** Confirmed.
- **No file mutation from preview endpoints:** Confirmed, verified by newly added code inspection and `tmp_path` integrity tests.
- **No raw document content returned:** Confirmed, no full text, OCR text, file contents, tracebacks, or absolute paths returned in payload or UI.

## 8. Remaining Follow-up Items
- None blocking L8. The integration remains fully read-only and safe as requested.
