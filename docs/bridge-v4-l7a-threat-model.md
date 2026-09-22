# Threat Model: L7A Controlled Clean and Retry

## 1. Scope
This threat model covers the introduction of the `/api/controlled/clean-preview/*` and `/api/controlled/retry-preview/*` endpoints in the local-markdown-pipeline bridge.

## 2. Hard Security Constraints
The following constraints must be strictly adhered to during the future implementation of these endpoints:
- No file deletion.
- No file overwrite.
- No file move operations.
- No direct retry execution (heavy lifting must be simulated/skipped).
- No OCR execution (GPU/CPU heavy, external calls).
- No direct convert execution.
- No promote operations.
- No Supabase write/import.
- No GitHub API calls.
- No arbitrary raw path input from frontend (directory traversal protection).
- No shell command exposure (e.g., `subprocess.run` with unsanitized inputs).
- `dry_run` must **always** be true.
- `dry_run: false` must be explicitly rejected.

## 3. Threat Vectors & Mitigations

### 3.1 Directory Traversal / Arbitrary File Read
- **Threat:** An attacker uses `../` in the `target_file` parameter to preview/read sensitive system files (e.g., `/etc/passwd` or `.env`).
- **Mitigation:** Strict input validation. Inputs must be basenames only, and the backend must ensure the resolved path strictly resides within the configured safe data directory. 

### 3.2 State Mutation / Data Destruction
- **Threat:** The clean or retry logic accidentally modifies, moves, or deletes a file despite being a "preview".
- **Mitigation:** The `dry_run` flag must be deeply enforced. File I/O operations must be wrapped or bypassed when this flag is true. The L7A milestone explicitly prohibits implementing the actual mutating logic.

### 3.3 Information Disclosure (Secrets and Paths)
- **Threat:** The preview output returns the full path of the file on the host machine, or accidentally includes environment variables if the pipeline logs them.
- **Mitigation:** Implement an output sanitization layer that strips common secrets, masks absolute paths to just the filename, and limits the preview snippet size.

### 3.4 Denial of Service (DoS) via Heavy Execution
- **Threat:** A retry preview triggers a full OCR or LLM conversion process, consuming massive CPU/GPU resources and blocking the server.
- **Mitigation:** The retry preview must *simulate* the retry. It must only calculate what *would* happen and return immediately, without invoking OCR or heavy conversion routines.

## 4. Explicit Allowlist / Denylist

### Allowlist
- GET /health
- GET /api/status
- POST /api/summary/preview
- POST /api/controlled/scan-preview
- POST /api/controlled/convert-preview/start
- POST /api/controlled/convert-preview/status
- POST /api/controlled/clean-preview/start
- POST /api/controlled/clean-preview/status
- POST /api/controlled/retry-preview/start
- POST /api/controlled/retry-preview/status

### Denylist (Still Forbidden)
- /api/manifest
- /api/compare
- /api/convert (direct, non-preview)
- /api/clean (direct, mutating)
- /api/ocr
- /api/review
- /api/retry (direct, mutating)
- /api/promote
- Any endpoint writing to Supabase or invoking the GitHub API.
