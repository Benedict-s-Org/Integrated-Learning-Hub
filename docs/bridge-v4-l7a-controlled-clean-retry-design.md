# Bridge v4 / L7A Controlled Clean / Retry Security Design

## 1. Overview
This document outlines the architectural and security design for the L7A Controlled Clean and Retry preview mechanisms. This is a preview-only phase, emphasizing controlled visibility without side-effects. 

## 2. Controlled Clean-Preview Design
- **Objective:** Allow the Learning Hub to preview the results of a document cleaning operation safely.
- **Mechanism:** 
  - Initiates a job to run the pipeline's cleaning logic with strict `dry_run=true`.
  - The pipeline will process the source file in memory or in a secure temporary isolated buffer.
  - The result is summarized (e.g., lines removed, formatting changes) but no files are modified, deleted, or overwritten on disk.
  - Generates a preview artifact detailing the proposed clean state.

## 3. Controlled Retry-Preview Design
- **Objective:** Enable the frontend to preview the outcome of retrying a failed document processing step.
- **Mechanism:**
  - Starts an async job with `dry_run=true` to simulate the retry action.
  - Checks preconditions (e.g., file existence, configuration).
  - Simulates the pipeline stages that would execute on retry.
  - Produces a summary of what *would* happen (e.g., "OCR would run", "Conversion would run"), but does not execute these heavy/mutating operations.

## 4. Dry-Run Enforcement Model
- **Strict Enforcement:** The `dry_run` parameter must be hardcoded or forcefully defaulted to `true` at the endpoint boundary.
- **Rejection of False:** Any incoming request specifying `dry_run: false` must be immediately rejected with an HTTP 400 or 403 error.
- **Pipeline Segregation:** The backend must ensure that the `clean` and `retry` service layers abort any disk I/O when `dry_run=true` is detected.

## 5. Job Status Model
- **Async Pattern:** To prevent timeouts and hanging connections, clean and retry previews are handled asynchronously.
- **State Machine:** Jobs transition through states: `PENDING` -> `PROCESSING` -> `COMPLETED` | `FAILED`.
- **Status Endpoints:** The frontend polls the respective `/status` endpoints using a `job_id`.
- **Job Data Sanitization:** The data returned in `COMPLETED` or `FAILED` states must be sanitized (no full paths, no secrets).

## 6. Frontend Safety UX Notes
- **Clear Indicators:** The UI must clearly indicate that this is a "Preview Only" mode.
- **Action Buttons:** "Clean" and "Retry" buttons should be labeled "Preview Clean" and "Preview Retry" or include a visual icon indicating a safe dry-run.
- **Read-Only Results:** The preview output should be displayed in a read-only viewer. No "Apply" button should be available in the L7A milestone.
- **Error Handling:** Vague, user-friendly error messages should be displayed on failure, without exposing stack traces or backend paths.
