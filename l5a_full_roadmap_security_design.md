# L5A: Learning Hub × local-markdown-pipeline Full Roadmap Security Design

## 1. Executive Summary
- **Status Checkpoint:** L1–L4B are complete and have passed Security / QA review.
- **Current Posture:** The current system should remain at a stable read-only checkpoint.
- **L5A Goal:** L5A is a design-only phase. It establishes a secure roadmap and threat model for any future expansion of the bridge between Learning Hub and the local-markdown-pipeline.

## 2. Current Architecture Summary
- **local-markdown-pipeline Role:** A standalone, local-first FastAPI backend with a vanilla frontend designed to safely process local markdown files with operations like scan, convert, clean, OCR, and AI review.
- **Learning Hub Role:** Acts as a safe admin launcher and a read-only bridge. It does not replace the standalone pipeline UI.
- **Current Allowed Calls (from Learning Hub):**
  - `GET /health`
  - `GET /api/status`
  - `POST /api/summary/preview`
- **Current Prohibited Calls:**
  - `/api/manifest`
  - `/api/compare`
  - `/api/scan`
  - `/api/convert`
  - `/api/clean`
  - `/api/ocr`
  - `/api/review`
  - `/api/retry`
  - `/api/promote`
- **Current Security Boundary:** The bridge is strictly read-only, local-only (localhost/127.0.0.1 CORS), relies on no credentials, and exposes no raw local paths, file contents, or sensitive metadata to the Learning Hub frontend.

## 3. Long-Term Target Architecture
- **Bridge Architecture:** The safest long-term architecture maintains the `local-markdown-pipeline` as an isolated, local-first processing engine. The Learning Hub will only interact with it via tightly controlled wrapper endpoints specifically designed for the bridge.
- **local-markdown-pipeline Responsibilities:** Holds all raw local paths, performs all file I/O operations, executes heavy processing (OCR, AI reviews), and maintains the canonical state of local files. The standalone pipeline UI remains the primary manual control surface for high-risk operations.
- **Learning Hub Responsibilities:** Triggers controlled local executions via sanitized identifiers, views sanitized status and preview summaries, and acts as a gateway for eventual human-approved, sanitized data import into Supabase.
- **Data Prohibited from Crossing by Default:** Raw local paths, filenames, full document contents, OCR text, AI review comments, raw error stack traces, and local directory structures must *never* cross the bridge unless explicitly approved in a dedicated future security phase.

## 4. Risk Tier Model

### Tier 0: Launcher Only
- **Allowed:** Display link/button to launch local pipeline UI.
- **Prohibited:** Any API calls to the local pipeline.
- **Data Allowed:** None.
- **Data Prohibited:** All.
- **Confirmation:** None required (just standard navigation).
- **Review Requirement:** None (N/A).

### Tier 1: Read-only Status and Sanitized Summaries (Current L4B State)
- **Allowed:** `GET /health`, `GET /api/status`, `POST /api/summary/preview`.
- **Prohibited:** Any state-modifying actions, directory scanning, file operations.
- **Data Allowed:** Numeric job aggregates, safe booleans, predefined short status codes, sanitized summary numeric metrics.
- **Data Prohibited:** File paths, filenames, document contents, sensitive metadata.
- **Confirmation:** None required for read-only polls.
- **Review Requirement:** Standard security/QA review for path leakage and CORS (Passed in L1-L4B).

### Tier 2: Controlled Local Execution Without Import
- **Allowed:** Triggering allowlisted processing jobs (e.g., scan-only, convert) via strictly designed wrapper endpoints.
- **Prohibited:** Arbitrary command execution, providing raw output paths via URL/payload, returning raw paths in responses, triggering broad original endpoints directly.
- **Data Allowed:** Predefined job type IDs, simple execution status (success/failed), sanitized error codes.
- **Data Prohibited:** Raw job logs, shell output, local environment variables.
- **Confirmation:** Explicit single user confirmation required before triggering execution.
- **Review Requirement:** Verification of wrapper isolation, parameter validation, and safe error handling.

### Tier 3: Controlled Sanitized Result Selection
- **Allowed:** Requesting specific sanitized results of completed jobs (e.g., successful conversions ready for import).
- **Prohibited:** Accessing raw source files, arbitrary directory listing.
- **Data Allowed:** Anonymized/hashed job IDs, sanitized status identifiers, aggregated metadata necessary for selection.
- **Data Prohibited:** Original document text, specific student PII, raw OCR text.
- **Confirmation:** Standard UI interaction.
- **Review Requirement:** Review of identifier generation to ensure no path reconstruction is possible.

### Tier 4: Controlled Learning Hub Import
- **Allowed:** Transferring sanitized, finalized data (e.g., cleaned markdown content) from the local pipeline memory/temp space into Learning Hub's volatile frontend state.
- **Prohibited:** Direct writes to Supabase, direct GitHub commits, importing unsanitized raw OCR text or AI comments without review.
- **Data Allowed:** Explicitly approved, sanitized output content intended for long-term use.
- **Data Prohibited:** Raw local paths, intermediate temp files.
- **Confirmation:** Strong second user confirmation (human approval gate) before data crosses the bridge.
- **Review Requirement:** Strict data sanitization review, PII leakage checks, validation of human-in-the-loop gating.

### Tier 5: Supabase Write/Import and Long-Term Storage
- **Allowed:** Persisting explicitly imported and approved data from Tier 4 to the Supabase database.
- **Prohibited:** Storing local file paths, unredacted student data, or original copyrighted raw materials.
- **Data Allowed:** Final sanitized content, approved metadata, learning hub structure links.
- **Data Prohibited:** Any local machine context, raw paths, internal pipeline job IDs.
- **Confirmation:** Covered by Tier 4's strong confirmation, plus clear UI feedback on persistence.
- **Review Requirement:** Database schema review, RLS policy audit, data retention and deletion verification.

### Tier 6: OCR / AI Review Text Handling
- **Allowed:** Generating OCR text and AI reviews strictly within the local pipeline. Potential controlled, sanitized surfacing to Learning Hub if explicitly justified.
- **Prohibited:** Sending unreviewed AI comments directly to Supabase, exposing student PII from OCR to unauthorized views.
- **Data Allowed:** Sanitized, aggregated AI quality scores (if approved).
- **Data Prohibited:** Raw, unreviewed OCR text, raw AI model prompt injections.
- **Confirmation:** Explicit warning and confirmation regarding sensitive/copyrighted material.
- **Review Requirement:** Highest risk review. Requires audit of AI prompt safety, PII redaction logic, and strict isolation of OCR buffers.

## 5. Proposed Phase Roadmap

- **L5A:** Full roadmap security design / threat model (Current Phase)
- **L5B:** Minimal controlled scan-only wrapper design or implementation candidate
- **L5C:** Security / QA review for L5B
- **L6A:** Controlled convert workflow design
- **L6B:** Controlled convert implementation
- **L6C:** Security / QA review for L6B
- **L7A:** Controlled clean / retry design
- **L7B:** Controlled clean / retry implementation
- **L7C:** Security / QA review
- **L8A:** Controlled OCR and AI review design
- **L8B:** Controlled OCR and AI review implementation candidate
- **L8C:** High-risk Security / QA review
- **L9A:** Sanitized result selection design
- **L9B:** Sanitized result selection implementation
- **L9C:** Security / QA review
- **L10A:** Learning Hub import approval flow design
- **L10B:** Import approval implementation
- **L10C:** Security / QA review
- **L11A:** Supabase persistence design
- **L11B:** Supabase write/import implementation
- **L11C:** Final Security / QA review

## 6. Recommended Next Implementable Phase

**Comparison of Options:**
- **A. Stay read-only:** Safest immediate option, preserves zero risk of unintended modifications.
- **B. Scan-only wrapper (Tier 2):** Introduces minimal controlled execution. It only reads the file system and generates a manifest locally. No destructive actions.
- **C. Scan + convert:** Higher risk, as conversion consumes resources and creates new files on the local disk.
- **D. Direct import (Tier 4/5):** Too high risk. Skips crucial intermediate validation and sanitization steps.

**Recommendation:** Option A (Stay read-only) is the default safest state until business needs demand otherwise. If forward momentum is required, **Option B (scan-only wrapper, Phase L5B)** is the only recommended next implementable phase.
**Why:** A scan-only wrapper introduces controlled execution (Tier 2) at the lowest possible risk level. It performs read-only operations on the local file system (directory traversal) and updates local state (manifest), but does not modify source files, run heavy external binaries (like OCR), or export data to the Learning Hub. It provides a testbed for our "controlled wrapper" endpoint pattern before moving to riskier operations.

## 7. Proposed L5B Scope (If proceeding)

If proceeding to L5B (Minimal controlled scan-only wrapper):
- **Exact Allowed Job Type:** `scan_directory` (strictly defined and allowlisted).
- **Endpoint Shape:** `POST /api/bridge/execute/scan` (Note: distinct from existing `/api/scan`).
- **Request Body:** `{ "job_type": "scan_directory", "confirm": true }` (No paths provided; backend uses hardcoded/configured root).
- **Response Body:** `{ "status": "success", "message": "Scan initiated", "job_id_hash": "a1b2c3d4" }` (No raw paths, no manifest contents).
- **Allowed Error Codes:** `ERR_SCAN_IN_PROGRESS`, `ERR_SCAN_FAILED`, `ERR_UNAUTHORIZED`.
- **Frontend UX Flow:** User clicks "Run Local Scan" -> Modal appears explaining what will happen locally -> User checks "I confirm" -> Post request sent -> UI shows loading spinner -> UI polls `/api/status` to show completion.
- **Required Confirmation Copy:** "This will trigger a scan of your local markdown directory. No files will be uploaded or modified. Do you want to proceed?"
- **What Must Remain Out of Scope:** Returning the manifest data, specifying custom directories from the UI, converting files, or any automated repeating scans.

## 8. Data Flow Diagrams (Text Form)

### Current L1–L4B Read-Only Flow
```text
[Learning Hub Frontend]
       |
       | (GET /health, GET /api/status, POST /api/summary/preview)
       V
[FastAPI Bridge Endpoints] (Localhost CORS only)
       |
       | (Reads in-memory status or parses manifest JSON)
       V
[local-markdown-pipeline State]
```

### Proposed L5B Scan-Only Flow
```text
[Learning Hub Frontend]
       |
       | (POST /api/bridge/execute/scan with confirm=true)
       V
[FastAPI Bridge Wrapper] -> Validates request, checks idempotency
       |
       | (Triggers internal function)
       V
[local-markdown-pipeline Core] -> Scans predefined local directory
       |
       V
[Updates Local Manifest.json] (No raw paths returned to Frontend)
```

### Future Controlled Convert Flow (L6)
```text
[Learning Hub Frontend]
       |
       | (POST /api/bridge/execute/convert with safe_job_id)
       V
[FastAPI Bridge Wrapper] -> Maps safe_job_id to internal path
       |
       | (Triggers internal convert logic)
       V
[local-markdown-pipeline Core] -> Converts files, writes to local /output
```

### Future Import Approval Flow (L10)
```text
[Learning Hub Frontend] <- Views sanitized preview of converted data
       |
       | (User clicks "Approve and Import")
       | (POST /api/bridge/import with safe_job_id)
       V
[FastAPI Bridge Wrapper] -> Loads sanitized output JSON
       |
       | (Returns sanitized content payload)
       V
[Learning Hub Frontend] -> Stores in volatile React state for review
```

### Future Supabase Persistence Flow (L11)
```text
[Learning Hub Frontend] (Holds validated, user-approved payload in state)
       |
       | (POST /api/learning-hub/save)
       V
[Next.js API Route / Supabase Client] -> Applies RLS policies
       |
       V
[Supabase Database] (Persists sanitized content, no local paths)
```

## 9. Threat Model Table

| Threat | Affected Tier / Phase | Risk | Mitigation | Residual Risk | Review Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Local path leakage** | Tier 1-4 | High | Never include paths in JSON responses. Map safe IDs internally. | Low | Payload inspection. |
| **Filename leakage** | Tier 1-4 | Med | Return numeric summaries. If filenames needed later, sanitize strictly. | Low | Payload inspection. |
| **Document content leakage** | Tier 3-4 | High | Keep content in local pipeline until explicit human-approved import. | Low | Source code review of bridge endpoints. |
| **OCR text leakage** | Tier 6 | High | OCR text stays local. If imported, requires strict PII redaction and warning. | Med | Audit of OCR bridging logic. |
| **AI review comment leakage** | Tier 6 | High | AI comments stay local until human approved. Filter system prompts out. | Med | Audit of AI response handling. |
| **Accidental Supabase persistence** | Tier 5 | High | Supabase write logic isolated to dedicated L11 phase. RLS enforcement. | Low | Database schema & RLS review. |
| **Accidental Learning Hub import** | Tier 4 | High | Require strong double-confirmation gate before any bridge data transfer. | Low | UI/UX flow audit. |
| **Arbitrary command execution** | Tier 2-6 | Critical | No shell execution from frontend input. Use allowlisted job types only. | Low | Source code review of subprocess calls. |
| **Frontend tampering** | Tier 2-6 | Med | Backend validation of all inputs. Do not trust frontend state. | Low | Endpoint input validation tests. |
| **CORS expansion** | All Tiers | High | Hardcode `127.0.0.1:5180` and `localhost:5180`. No wildcards. | Low | Middleware configuration review. |
| **Credentials exposure** | Tier 1-6 | High | Bridge endpoints do not require/transmit secrets. | Low | Network traffic analysis. |
| **Job replay / Double submission** | Tier 2-6 | Med | Backend idempotency checks, lock files, or `ERR_SCAN_IN_PROGRESS` blocks. | Low | Concurrency testing. |
| **Stale status** | Tier 1-6 | Low | Standardized polling. Cache invalidation on job completion. | Low | UX functional testing. |
| **Unsafe error messages** | All Tiers | Med | Catch-all exception handlers returning predefined error codes (no stack traces). | Low | Error handling code review. |
| **Logs leaking sensitive values** | All Tiers | Med | Exclude paths/contents from console.log or telemetry. | Low | Logging configuration review. |
| **Browser history leakage** | All Tiers | Med | Use POST bodies instead of URL query parameters for sensitive operations. | Low | Network/URL review. |
| **localStorage / sessionStorage leakage** | Tier 3-5 | Med | Store sensitive transient data strictly in volatile React state. | Low | Frontend code review. |
| **Unauthorized network access** | All Tiers | High | No public LAN origin binding. FastAPI binds to 127.0.0.1 only. | Low | Deployment config review. |
| **Future GitHub API misuse** | Tier 5 | Med | Out of scope until specifically justified and architected in a separate phase. | Low | Architecture review. |
| **Future token/secret mishandling** | Tier 5 | High | Do not prompt for tokens in UI. Use local .env exclusively for pipeline secrets. | Low | Secret management review. |

## 10. Safe Endpoint Design Principles
- **POST over Query String:** All state-modifying or data-requesting operations must use POST bodies. No sensitive parameters in URL query strings.
- **Allowlisted Job Types:** Any execution endpoint must strictly validate against a hardcoded list of allowed `job_type` strings.
- **No Arbitrary Commands:** No shell commands can be constructed using input originating from the frontend.
- **No Direct Passthrough:** Bridge endpoints must be dedicated wrappers. They must not directly proxy to the broad, existing `/api/scan` or `/api/convert` endpoints of the standalone pipeline.
- **Sanitized Responses Only:** Responses must be whittled down to the minimum viable data (e.g., booleans, numeric aggregates).
- **Predefined Error Codes:** Unhandled exceptions must be caught and converted to predefined strings (e.g., `INTERNAL_ERROR`). No raw error messages or stack traces.
- **No Raw Paths in Response:** Absolute or relative local file paths must never be returned in a JSON response.
- **No Filenames by Default:** Unless explicitly required for a specific selection UI (and approved in that phase), filenames should not be transmitted.
- **No Document Text by Default:** Document contents remain local until Tier 4 import.
- **Confirmation Gates:** Endpoints should require a `{ "confirm": true }` payload flag to enforce frontend intent.
- **Idempotency / Concurrency:** Endpoints triggering long-running jobs must check if a job is already running and return an appropriate status (e.g., 409 Conflict) rather than double-submitting.
- **Cancellation Policy:** If jobs can be cancelled, it must be via a secure, allowlisted abort signal.

## 11. Safe Frontend Design Principles
- **Volatile State Only:** If paths or sensitive identifiers must be tracked (in future phases), use volatile React state (`useState`).
- **No Persistent Storage:** Do not use `localStorage` or `sessionStorage` for anything bridge-related.
- **No URL Params:** Do not place job IDs, filenames, or status indicators in URL routes or query parameters.
- **No Analytics/Logging:** Ensure frontend analytics (e.g., Vercel Analytics, Posthog) do not capture bridge payloads or errors containing sensitive local data.
- **No Hidden Auto-run:** Bridge executions must never be triggered automatically on page load or component mount.
- **Explicit Confirmation:** Any action that triggers local execution or data import must require an explicit button click, usually behind a confirmation modal.
- **Clear Safety Copy:** UI must clearly state what the action does (e.g., "This reads your local files. It does not upload them.")
- **Safe Status Display:** Display statuses based on sanitized codes, not raw backend messages.
- **No Raw Output Display:** Do not display raw manifest files, raw comparison output, or raw filenames unless specifically designed and approved for that phase.

## 12. Safe Backend Design Principles
- **Enforce Localhost Only:** Uvicorn/FastAPI must bind strictly to `127.0.0.1`.
- **Strict CORS:** CORS middleware must explicitly allow only `http://localhost:5180` and `http://127.0.0.1:5180`.
- **Path Validation:** The backend must rely on its own environment variables or hardcoded constants for the target working directory.
- **Path Resolution:** If specific file targeting is added later, the backend must resolve paths securely (e.g., `os.path.abspath`) and assert they remain within the defined base directory to prevent path traversal (`../../`).
- **Directory-Only Requirements:** Operations like scanning should only operate on the predefined root directory, ignoring frontend path suggestions.
- **Hardcoded Manifest:** The output location and name of the manifest file must be strictly controlled by the backend, not the frontend.
- **No Recursive Scan Without Limits:** Scans must be controlled to prevent symlink loops or excessive disk usage.
- **No Secret Handling:** The bridge API must never ask for or transmit API keys, Supabase tokens, or Github PATs.
- **No Supabase Write (Yet):** The local pipeline must not write to Supabase. That is the Learning Hub's responsibility in a later phase.
- **No GitHub API (Yet):** GitHub integration remains out of scope.

## 13. Supabase Import and Persistence Design Guardrails (Tier 4/5)
- **Why it's Higher Risk:** Moves local, private, potentially sensitive or copyrighted data into a persistent, cloud-hosted database.
- **Separate Approval Required:** Moving from local pipeline processing to Supabase persistence requires a dedicated architecture and security review (L10/L11).
- **Data Allowed to be Stored:** Finalized, cleaned markdown content, sanitized metadata, semantic tagging.
- **Data Prohibited:** Raw local file paths, host system information, unredacted PII.
- **Original Files:** Original raw files should *not* be stored in Supabase unless specifically architected as a secure blob storage requirement later.
- **Avoiding Local Paths:** The bridge must map local files to UUIDs or hashes before transmitting to Learning Hub. Supabase only sees the UUID.
- **Deletion / Rollback:** Imported data must be easily identifiable (e.g., via an `import_batch_id`) to allow bulk deletion if an import was mistaken.
- **Student/Private/Copyrighted Materials:** Must be assumed present. RLS policies must strictly isolate imported data to the authenticated admin/teacher role.
- **Human Approval:** No automated pipeline runs can push directly to Supabase. A human must click "Approve and Import" in the Learning Hub UI.

## 14. OCR / AI Review Guardrails (Tier 6)
- **Why it's Higher Risk:** OCR and AI processes can extract or generate sensitive PII, student names, grades, or copyrighted material from images. AI prompts can be subject to injection or hallucinations.
- **Crossing into Learning Hub:** Raw OCR text should generally *not* cross into Learning Hub. It should be used locally to generate the cleaned markdown. If review is needed, it must be highly sanitized.
- **AI Review Comments:** AI suggestions (e.g., formatting fixes) can cross into Learning Hub *only* if they are sanitized and isolated from the raw source text.
- **Sanitizing Previews:** Any preview of OCR/AI output must strip identifiable information where possible, or be placed behind a strict "View Sensitive Content" warning.
- **Handling Private Materials:** Local processing ensures private materials don't leak to the cloud during processing (assuming a local LLM or a trusted, zero-retention enterprise API is used by the pipeline).
- **Final Audit Model:** When critical data fidelity is required, a stronger model (e.g., Claude 3.5 Sonnet) should be used for the final audit pass, provided data privacy agreements (zero retention) are established for the API key used by the local pipeline.

## 15. Implementation Gating Checklist
Before starting any new implementation phase (e.g., L5B), the following must be true:
- [ ] The design document for the phase has been written.
- [ ] The threat model has been updated for the specific phase.
- [ ] Security / QA review of the design is approved.
- [ ] All previous phases have passed their respective Security / QA reviews.
- [ ] The scope of the implementation is strictly limited to the approved design.

## 16. Security / QA Review Checklist
Every review phase (e.g., L5C, L6C) must check:
- [ ] **CORS & Network:** Are CORS rules still strictly localhost only?
- [ ] **Data Leakage:** Does the endpoint response leak raw paths, filenames, or file contents?
- [ ] **Error Handling:** Are exceptions caught and sanitized? No stack traces?
- [ ] **State Changes:** Does the endpoint perform unauthorized state modifications?
- [ ] **Input Validation:** Are all request payloads strictly typed and validated?
- [ ] **UI Safety:** Does the frontend require explicit confirmation for actions? Is state volatile?
- [ ] **Isolation:** Is the new wrapper endpoint independent of the broad, internal pipeline endpoints?

## 17. Final Recommendation
- **Proceed with Implementation?** NO immediate implementation is required.
- **Recommendation:** Stay at the stable read-only checkpoint (Option A).
- **If Business Requires Action:** If moving forward is mandated, recommend **ONLY** the smallest safe next step: **Phase L5B (Minimal controlled scan-only wrapper)**.
- **Strict Block:** L5B implementation MUST NOT start until this L5A Full Roadmap Security Design is explicitly reviewed, approved, and accepted by stakeholders.
