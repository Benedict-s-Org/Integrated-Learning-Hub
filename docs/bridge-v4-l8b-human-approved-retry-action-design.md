# Bridge v4 / L8B: Human-approved Retry Action Design

## Scope
This document designs the mechanism for safely executing a controlled "retry" action via the Learning Hub × local-markdown-pipeline bridge. It defines the flow from preview to human approval to execution.

## Out of Scope
- Actual implementation of the retry execution logic.
- Adding frontend execution buttons.
- Exposing the endpoints in the live server.
- Supabase synchronization.
- GitHub API integration.
- Direct filesystem modification for original files.
- Automated retry execution.

## Safety Principles
- **Explicit Human Approval**: No retry action can occur without an explicit human approval record linked to a specific preview plan.
- **Immutability of Originals**: The original extracted Markdown (raw, cleaned, final) must never be overwritten by a retry action.
- **Variant Outputs Only**: The retry outputs must be written as separate variant files clearly marked as retries.
- **No Automatic Promotion**: Retried variants must never be automatically promoted to the final active state. Promotion remains a future, separate human-approved action.
- **Scoped and Single-Use Execution**: An approval applies to exactly one file and one engine, is valid for a single execution, and expires quickly.

## Human Approval Flow
1. **Preview Generation**: The user runs a retry preview (`/api/controlled/retry-preview/start`), generating a `previewId` and an execution plan.
2. **Review**: The user reviews the candidate retry plan in the UI.
3. **Approval**: The user clicks a confirmation button, generating a single-use approval record (via `/api/controlled/retry-approval/create`).
4. **Execution**: The UI submits the execution request with the `approvalId` (`/api/controlled/retry-approved/start`).
5. **Validation**: The backend verifies the `approvalId`, ensuring it hasn't expired or been used, and that the target and parameters match the preview.
6. **Execution & Audit**: The retry engine runs, outputs variants, and an audit record is created.

## Required Preconditions
- A successful retry preview must exist for the specific file and engine.
- The external conversion tools (e.g., Docling, Marker) must be available if the selected engine requires them.

## Approval Token / Approval Record Concept
An approval record acts as a cryptographic or securely stored backend token ensuring user intent. It includes:
- `approvalId`: Unique identifier for this approval.
- `previewId`: The preview this approval is based on.
- `preview_payload_hash` or `retry_plan_hash`: Integrity check for the preview data.
- `target_identifier`: The specific job/file scoped identifier (no arbitrary paths).
- `selected_retry_engine`: The engine approved for use.
- `allowed_operation`: The explicit operation (e.g., `retry_with_marker`).
- `timestamp`: Creation time.
- `expiry`: Time limit for execution (e.g., 5 minutes).
- `user_confirmation`: Record of the user's explicit consent phrase or checkbox state.

## Rules

### One-time Execution Rule
The `approvalId` must be invalidated immediately upon starting the retry execution, preventing replay attacks or double-clicks.

### Time-limited Approval Rule
Approvals must expire shortly after creation (e.g., 5-15 minutes) to prevent stale approvals from being executed against mutated states.

### Target Scoping Rule
Approvals are bound to a single file. Batch approvals or wildcards are strictly forbidden.

### Approved Retry Engine Scoping Rule
The execution must only use the `selected_retry_engine` specified in the approval.

### Immutable Original Output Preservation
Original outputs (`.md`, `.json`) from the initial pipeline run must remain untouched.

### Separate-Variant-Output-Only Rule
Retry results must be written as separate variant files, such as:
- `file.<ext>.retry.<engine>.raw.md`
- `file.<ext>.retry.<engine>.cleaned.md`
- `file.<ext>.retry.<engine>.final.md`
- `file.<ext>.retry.<engine>.metadata.json`

### No Automatic Promote Rule
The retry engine must stop after writing the variant files. Promotion is out of scope and requires a separate workflow.

### Dry-run to Execution Transition
Execution is only permitted if a corresponding "dry-run" (preview) was successfully completed and formally approved.

## Audit Log Design
Every retry execution must generate an audit log entry containing:
- `auditEventId`
- `timestamp`
- `target_identifier`
- `previewId`
- `approvalId`
- `selected_retry_engine`
- `outcome` (success/failure)
- Paths of generated variant files.

## Rollback / Recovery Design
Because original files are immutable and variants are strictly additive, rollback is trivial: the system can simply ignore or delete the variant files (`*.retry.*.*`). Recovery information (variant paths) is stored in the audit log.

## Failure Handling
- If the retry engine fails during execution, any partially written variant files should be cleaned up.
- Failure must not corrupt the original outputs.
- Detailed failure reasons are logged securely but sanitized in API responses.

## UX Copy Requirements
- **Require Explicit Confirmation**: The UI must require explicit human confirmation.
- **Recommended Button Wording**:
  - "Approve Retry for This File"
  - "Run Approved Retry"
  - "Cancel Approval"
- **Forbidden Wording**:
  - "Retry Now"
  - "Auto Retry"
  - "Fix Everything"
  - "Apply All"
  - "Run All"
  - "Promote"
  - "Upload"
- **Confirmation Copy Must Include**:
  - "This will create a separate retry variant only."
  - "Original raw/cleaned/final outputs will not be modified."
  - "This approval applies only to this file, this preview, and this retry engine."
  - "This approval expires automatically."
  - "No upload or external API call will occur."
  - "The retry result will not be promoted automatically."

## Explicit Non-Goals
- End-to-end automated retry pipelines.
- Multi-file bulk retries.
- Modifying the original pipeline results directly.
- Direct execution without preview.
