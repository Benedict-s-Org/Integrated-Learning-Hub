# Bridge v4 / L9: Threat Model

This document outlines the threats and mitigations for the future promote and Supabase import workflows.

| Threat | Mitigation |
| :--- | :--- |
| **Accidental Promote** | Requires explicit user confirmation via `promote-approval/create`. The UI requires acknowledging specific copy. |
| **Accidental Supabase Import** | Requires a completely separate approval step (`import-approval/create`) after promotion. |
| **Automatic Import After Promote** | The system design strictly separates the `promote-approved/start` and `import-preview/start` workflows. No backend hook connects them. |
| **Stale Candidate Approval** | Approvals are time-limited (e.g., 15 mins) and cryptographically tied to the `candidateHash` and target version. If the candidate changes, the approval is rejected. |
| **Replay Attack / Token Reuse** | Approval tokens are strictly single-use. Once `promote-approved/start` or `import-approved/start` is called, the token is consumed and invalidated. |
| **Target / Version / Operation Swapping** | Approvals embed the target ID, version ID, and operation type (`promote` vs `supabase_import`). The execution endpoints explicitly enforce these constraints. |
| **Path Traversal / Arbitrary Path Injection** | Endpoints accept `candidateId` and `jobId`, not raw file paths. The backend resolves these IDs to safe, constrained directory spaces. |
| **Raw Content / OCR Leakage** | The `import-preview` only generates sanitized metadata and the final approved text. It explicitly excludes raw OCR outputs. API responses are strictly filtered. |
| **Local Path Leakage** | API responses only return `targetDisplayName` (basenames or sanitized aliases), never absolute local paths. |
| **Batch Accidental Approval** | Endpoints and UI are designed to handle exactly one `candidateId` at a time. No batch arrays are accepted in request schemas. |
| **UI Wording Confusion** | Strict adherence to the UX copy requirements (e.g., "Approve Promote for This File" instead of "Publish"). |
| **CSRF-like Local Request Risk / Malicious Tab** | The requirement for a multi-step workflow (preview -> explicit approval -> execute) with unique `previewId`s and `approvalId`s mitigates simple CSRF attacks against localhost endpoints. |
| **Stale In-memory Session** | The backend relies on persistent, time-stamped approval records rather than fragile in-memory session state. |
| **Race Condition (Preview vs Approval)** | The approval token generation locks the state. If the underlying candidate changes before execution, the payload hash validation fails. |
| **Partial Promote Record Write / Crash** | Promote is an append-only metadata operation. If it crashes mid-write, the original files are untouched, and the state can be safely reconciled or retried. |
| **Corrupted Promoted Candidate Record** | Validated on read. If corrupted, it's treated as un-promoted, causing dependent endpoints to fail safely. |
| **Supabase Partial Write** | Import logic should use transactions if inserting multiple related rows. If a failure occurs, the local state remains safe, and a new approval is required to retry. |
| **Duplicate Import** | The import logic must check for existing records (via unique hashes or candidate IDs) before inserting to prevent duplication. |
| **Wrong Workspace / Wrong Table Import** | Backend configuration strictly binds the local project to a specific Supabase project/table. Credentials and endpoints are fixed on the backend, not supplied by the frontend. |
| **Supabase Credential Leakage** | Credentials are stored securely on the backend (e.g., `.env`) and never exposed to the frontend or included in API responses. |
| **Service Role Key Misuse** | Only the absolute necessary permissions are granted. The service role key is never leaked to the browser. |
| **Row Level Security Bypass Risk** | Ensure Supabase tables have strict RLS policies enabled, even if the backend uses a service key, to maintain defense-in-depth. |
| **Unauthorized Public Sharing** | Data imported to Supabase must default to private/unlisted. |
| **GitHub API / External API Drift** | GitHub APIs are explicitly out of scope and disabled. |
| **Prompt Injection in File Content** | The import payload is treated purely as data. It must not be executed or evaluated by the backend or Supabase. |
| **Sensitive Student/Exam Material Import Risk** | Mitigated by the explicit human review requirement and the strict "No Batch Import" rule. |
| **Audit Log Tampering** | Audit logs are written locally to append-only files or secure stores not accessible via the bridge API. |
