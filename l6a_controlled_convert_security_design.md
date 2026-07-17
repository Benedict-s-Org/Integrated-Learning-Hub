# L6A: Controlled Convert Workflow Security Design & Threat Model

## 1. Executive Summary
- **Current Checkpoint:** L1-L5C completed successfully. The bridge currently supports read-only statuses and a controlled, path-blind directory scan (`/api/controlled/scan-preview`).
- **L6A Goal:** Define the security architecture, data flow, and threat model for the "Controlled Convert" workflow (Phase L6B). 
- **Core Principle:** The conversion process takes raw local documents and converts them into markdown. It modifies local disk state (creates new files in an output directory) and consumes significant compute resources. The Learning Hub bridge must trigger this safely without exposing raw paths, allowing arbitrary command execution, or leaking file contents.

## 2. Proposed Architecture & Data Flow

### 2.1. The Wrapper Endpoint
The `local-markdown-pipeline` will expose a dedicated, strictly controlled wrapper endpoint for conversion:
- **Endpoint:** `POST /api/controlled/convert-preview`
- **Request Body:** `{ "job_type": "convert_preview", "confirm": true }`
- **Job Type Validation:** The endpoint must implement a strict allowlist. The **only** allowed job type for L6 is `convert_preview`. Any other value must be explicitly rejected with a sanitized error code (e.g., `ERR_INVALID_JOB_TYPE`).
- **Path Blindness:** No paths are provided by the Learning Hub frontend. The backend relies entirely on its local configuration (`.env` or internal state) to know which source directory to convert and where to place the output.

### 2.2. Out of Scope for L6
To maintain strict boundaries, the following features are **explicitly excluded** from the L6 scope:
- Supabase writes / imports
- Learning Hub imports
- OCR execution or text handling
- AI review generation
- Retry or promote actions
- GitHub API usage
- Any token/secret handling or transmission

### 2.3. Data Flow Diagram
```text
[Learning Hub Frontend]
       |
       | (User clicks "Convert Files", explicitly confirms strong warning modal)
       | (POST /api/controlled/convert-preview { "job_type": "convert_preview", "confirm": true })
       V
[FastAPI Bridge Wrapper] -> Validates job_type and intent, checks idempotency
       |
       | (Triggers internal convert logic asynchronously to timestamped folder)
       V
[local-markdown-pipeline Core] -> Reads local source files, writes to /output/{timestamp}
       |
       V
[Updates Local Manifest.json] (Learning Hub polls /api/status for progress)
```

## 3. Threat Model & Mitigations

| Threat | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **Arbitrary Command Execution / Path Traversal** | Critical | The wrapper endpoint accepts NO path arguments from the frontend. The backend uses hardcoded/configured paths only. |
| **Denial of Service (Resource Exhaustion)** | High | Conversion is CPU/memory intensive. The backend MUST implement strict concurrency control to prevent double-submissions. |
| **CORS Exposure / Unauthorized Trigger** | High | Endpoint must be bound strictly to `127.0.0.1`. CORS restricted to `http://localhost:5180` and `http://127.0.0.1:5180`. No wildcard or public LAN origins are allowed. CORS credentials remain explicitly disabled. |
| **File / Content Leakage in Response** | High | The conversion endpoint must explicitly forbid returning: job IDs, OCR text, AI review comments, raw manifest data, filenames, local paths, document content, and raw markdown output by default. It returns only predefined status codes and sanitized aggregates. |
| **Accidental Overwrite of Previous Outputs** | Medium | The backend must **not** overwrite an existing output directory or existing manifest without explicit future design approval. It should strictly use timestamped run folders for convert outputs (e.g., `/output/run_20260717_1150/`) or fail cleanly if a directory is not empty. |
| **Unsafe Error Messages (Stack Traces)** | Medium | Wrap the conversion trigger in a broad try/catch that returns standard error codes like `ERR_CONVERSION_FAILED`. No raw exception messages or stack traces. |
| **Frontend State Manipulation** | Low | The frontend tracking is strictly volatile React state. |

## 4. Frontend (Learning Hub) Guardrails
1. **Strong Confirmation Gate:** The "Start Conversion" button must open a modal with stronger copy than the scan-only confirmation. It must warn: *"This conversion will read local file contents and write converted outputs locally on your machine. No files will be uploaded or imported into Learning Hub during this step."*
2. **Volatile State Only:** All sensitive path inputs or status states must remain in volatile React state.
3. **Storage Prohibition:** Paths or job details must **not** be stored in: URL params, browser history, analytics, logs, durable frontend state, `localStorage`, `sessionStorage`, or Supabase.
4. **No Content Displayed:** Even after conversion, the frontend will only see the sanitized numeric summaries, never the actual converted text.

## 5. Backend (FastAPI) Guardrails
1. **Strict Allowlist:** The `job_type` must be strictly allowlisted.
2. **No Direct Passthrough:** The new endpoint must not proxy to internal endpoints.
3. **Idempotency & Isolation:** The backend tracks running jobs and rejects overlap. 
4. **Safe Output Strategy:** Mandate timestamped folders to avoid any risk of overwriting existing manifests or older outputs.

## 6. L6C Security / QA Review Gating Checklist
Before Phase L6B (Implementation) can be considered complete, it must pass the following checks:
- [ ] **Path Blindness:** Does the endpoint ignore path parameters?
- [ ] **Job Type Validation:** Is `convert_preview` the only allowed job type, and are others rejected?
- [ ] **CORS Verification:** Are wildcard/LAN origins blocked and credentials disabled?
- [ ] **Response Sanitization:** Is it confirmed that no job IDs, OCR text, AI comments, raw manifest data, filenames, local paths, or document content are returned?
- [ ] **Overwrite Prevention:** Does the backend successfully use timestamped folders rather than overwriting?
- [ ] **Data Storage Constraints:** Are we certain no paths leaked into URL params, analytics, or Supabase logs?
- [ ] **UX Safety:** Does the frontend require the stronger explicit "Confirm" click?

## 7. Next Steps
Once this revised L6A design is reviewed and approved, development may proceed to **Phase L6B (Controlled Convert Implementation)**.
