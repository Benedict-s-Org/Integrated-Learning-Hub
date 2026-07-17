# Local Markdown Pipeline × Learning Hub Bridge Checkpoint (L1 - L5C)

## Current Status
**STABLE CONTROLLED SCAN-ONLY CHECKPOINT**

## Completed Phases
- **L1**: Learning Hub Admin Launcher Page (Initial UI)
- **L2**: Strict localhost health check (Server Connectivity)
- **L3A/B**: Read-only global activity status endpoint and activity panel (Job Status)
- **L4A/B**: Sanitized output summary preview endpoint and panel (Results Preview)
- **L5A**: Full roadmap security design / threat model
- **L5B**: Minimal controlled scan-only wrapper implementation
- **L5C**: Security / QA Review for Minimal Controlled Scan-Only Wrapper (PASS)

## Current Architecture
The system consists of two loosely coupled components:
1. **Local Markdown Pipeline**: A standalone Python FastAPI backend that processes local documents to Markdown. It runs locally and exposes a strict, localhost-only HTTP API.
2. **Learning Hub Admin Launcher**: A React frontend page within the Supabase Learning Hub application that acts as a bridge to monitor and trigger safe, read-only or strictly controlled local operations.

The bridge enforces a rigid security boundary, ensuring that the Learning Hub can only request sanitized aggregate metrics and initiate a safe local folder scan, without ever receiving raw document contents, full paths, or enabling unauthorized external access.

## Allowed Learning Hub Bridge Calls
The frontend is currently only permitted to call the following endpoints on the local pipeline:
- `GET /health` (Server status)
- `GET /api/status` (Active job counts)
- `POST /api/summary/preview` (Sanitized metrics for a given output path)
- `POST /api/controlled/scan-preview` (Initiates a local scan and returns sanitized metrics)

## Prohibited Calls
The frontend must **NOT** call the following endpoints:
- `GET /api/manifest`
- `GET /api/compare`
- `POST /api/convert`
- `POST /api/clean`
- `POST /api/ocr`
- `POST /api/review`
- `POST /api/retry`
- `POST /api/promote`
- Any Supabase write/import endpoints related to the pipeline.
- GitHub API integration.

## Endpoint Inventory
- `GET /health`: Returns basic connectivity and engine availability.
- `GET /api/status`: Returns current pipeline activity (idle/busy) and active job counts.
- `POST /api/summary/preview`: Validates an output path, reads `_job_manifest.json`, and returns sanitized numeric aggregates.
- `POST /api/controlled/scan-preview`: Initiates a directory scan, writes the manifest locally, and returns sanitized numeric aggregates. Does not return file paths.

## Files Changed
Key files modified or introduced during phases L1-L5C:
- `src/pages/AdminLocalMarkdownPipelinePage.tsx`: Admin Launcher UI bridge.
- `local-markdown-pipeline/backend/main.py`: FastAPI server definitions, CORS configuration, and secure wrapper endpoints.
- `local-markdown-pipeline/backend/scanner.py`: Local directory scanning, path validation, and manifest generation logic.

## Security Boundaries
- **CORS Restriction**: The backend strictly limits CORS origins to `http://localhost:5180` and `http://127.0.0.1:5180`.
- **Sanitized Outputs**: Bridge endpoints explicitly strip file names, absolute paths, job IDs, document content, OCR text, AI review comments, and sensitive metadata.
- **Controlled Execution**: Only the scan-preview job type is permitted via the controlled endpoint. Conversion, OCR, AI review, and promotions remain strictly separated.
- **No Path Logging**: The wrapper endpoint does not log full directory paths.
- **No Supabase Interaction**: The frontend handles path variables entirely in volatile React state; no paths are saved to Supabase, localStorage, sessionStorage, or URL parameters.

## Known Limitations
- The bridge is currently read/scan-only. It cannot trigger file conversions or AI reviews.
- `scan_directory` unconditionally overwrites an existing `_job_manifest.json` if run against an existing output path.

## Accepted Risks
- **CORS Exposure**: The backend CORS policy technically permits the Learning Hub origin to `GET /api/manifest`. While the frontend UI avoids making this call, a theoretical XSS vulnerability in Learning Hub could exploit this to retrieve local file paths. This is an accepted risk given the localhost-only boundary and the trusted nature of the admin user session.

## Future Guardrails
- **Manifest Overwrite Confirmation**: Future implementations should prompt or warn the user before overwriting an existing `_job_manifest.json` during a scan.
- **Conversion Wrappers**: Any future bridge to execute conversions must be similarly wrapped, strictly validating input and returning sanitized results.

## Recommended Next Phases
The pipeline bridge should not proceed directly to modifying state or processing files without extensive security planning.

**Explicit Instruction:** Do NOT proceed to L6 (Controlled Conversion & Cleaning) implementation without an **L6A security design** first.
