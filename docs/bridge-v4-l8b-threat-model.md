# Bridge v4 / L8B: Threat Model

This document outlines the threats and mitigations specifically for the human-approved retry action design.

## 1. Execution & Approval Threats

| Threat | Mitigation |
|---|---|
| **Accidental retry execution** | Requires explicit two-step process: preview -> explicit approval -> execute. UX requires strict confirmation copy. |
| **Batch accidental approval** | API and backend logic strictly accept only a single `jobId` per approval and execution. Wildcards are rejected. |
| **Stale retry preview approval** | Approvals are tied to a `preview_payload_hash` or `previewId`. If the underlying file changes between preview and execution, the approval is rejected. |
| **Approval token reuse / Replay attack** | `approvalId` is strictly single-use. It is marked as `used` or deleted atomically when execution starts. |
| **Stale in-memory session** | Approvals have a strict, short expiration time (`expiresAt` e.g., 5 minutes). |
| **Race condition between preview and approval** | Atomic checks ensure that the token is claimed exactly once. If state drifts, execution aborts. |

## 2. Integrity & Swapping Threats

| Threat | Mitigation |
|---|---|
| **Target swapping** | Approval token cryptographically binds the `jobId` and `previewId`. Client cannot swap the target path during the `/start` request. |
| **Engine swapping** | Approval binds the `selected_retry_engine`. Client cannot inject a different engine in the execute payload. |
| **Operation swapping** | Operation mode is fixed by the approval context. |

## 3. Path & File System Threats

| Threat | Mitigation |
|---|---|
| **Path traversal** | API only accepts opaque `jobId`s. Backend maps these to predefined safe directories. |
| **Arbitrary path injection** | All paths are resolved internally. User input never constructs a file path directly. |
| **Accidental overwrite of original outputs** | Code enforces output paths appending `.retry.<engine>.<ext>`. Overwriting original (`.md`, `.json`) is technically impossible in the retry routine. |
| **Partial variant write / crash during retry** | If execution crashes, incomplete variant files are cleaned up or ignored. Originals remain safe. |
| **Corrupted variant output** | Handled gracefully. Corrupt variants are never promoted automatically. |

## 4. Environment & Tool Drift

| Threat | Mitigation |
|---|---|
| **Arbitrary engine injection** | Engine requested must be in a hardcoded allowlist of approved engines (e.g., `marker`, `opendataloader`). |
| **External tool execution drift** | Backend verifies tool availability at execution time. Fails safe if missing. |
| **Marker/OpenDataLoader availability drift** | Same as above. If the tool is uninstalled between preview and execution, execution safely aborts. |
| **GitHub API / external API drift** | All external APIs and Sync endpoints remain fully disabled at the bridge level. |
| **Unauthorized Supabase import** | Supabase write/import remains blocked. Variant outputs exist purely on the local disk. |
| **Accidental promote** | The retry execution routine is strictly decoupled from the promote routine. Promotion requires a separate manual action design. |

## 5. Leakage & Payload Threats

| Threat | Mitigation |
|---|---|
| **Full content leakage** | Endpoints return only status metadata. No raw markdown or document snippets are returned in the JSON response. |
| **Local path leakage** | Full local paths (e.g., `C:\AI\...`) are sanitized out of responses. `targetDisplayName` is used instead. |
| **Prompt injection in file content or metadata** | Filenames and user data are treated as untrusted strings and are properly escaped when used as arguments to execution subprocesses. |
| **Sensitive student / exam material retry risk** | Data remains entirely local. No data is sent to external LLMs or cloud endpoints without user configuration and explicit consent. |

## 6. Client-Side & UI Threats

| Threat | Mitigation |
|---|---|
| **UI wording confusion** | UI guidelines forbid ambiguous words like "Fix Everything", "Auto Retry", enforcing explicit "Approve Retry for This File". |
| **CSRF-like local request risk** | CORS restrictions apply. Only the authenticated local Learning Hub frontend is permitted to call the control API. |
| **Malicious browser tab triggering localhost endpoint** | Same as above. Tokens and proper origin checks mitigate unauthorized triggers. |
