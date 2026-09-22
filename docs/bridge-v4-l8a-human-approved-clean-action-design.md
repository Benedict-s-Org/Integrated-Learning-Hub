# Bridge v4 / L8A: Human-approved Clean Action Design

**Important Note:** This document represents the *design only* for L8A. No runtime code, backend endpoints, frontend execution buttons, or clean execution capabilities are implemented in this phase.

## Scope
The scope of this design is to specify a strictly controlled, human-approved mechanism for transitioning from a read-only "clean preview" to an actual execution that writes derived clean outputs (`cleaned.md` / `final.md`). This involves designing the approval flow, state management, audit logging, and safety guardrails.

## Out of Scope
- Actual implementation of the execution logic or endpoints.
- Any direct /api/clean execution without prior approval.
- Any modification to `raw.md` files.
- Supabase write/import operations.
- GitHub API or any external API integrations.
- Batch or multi-file clean execution.

## Safety Principles
1. **Explicit Human Confirmation:** No clean action can occur without an explicit, well-understood human approval step.
2. **Immutable Raw Data:** The original raw output (`raw.md`) is considered immutable during the clean process.
3. **Single-Use, Scoped Approvals:** Approvals are strictly tied to a specific target, preview payload, and operation. They cannot be reused or reassigned.
4. **Time-Bound Execution:** Approvals expire automatically to prevent stale state execution.

## Human Approval Flow
1. User requests a clean preview.
2. System generates and displays the preview payload (read-only).
3. User reviews the preview.
4. User explicitly confirms they want to apply this specific clean operation to the specific file.
5. System generates a short-lived, single-use approval record containing hashes/checksums of the preview.
6. User initiates the actual clean action, passing the approval token.
7. System validates the approval token, executes the clean action atomically against derived files only, and invalidates the token.

## Required Preconditions
- A successful `clean-preview` must have been completed.
- The `preview_id` and associated metadata must be actively tracked in the system.
- The target file/job must be strictly identified by a scoped identifier, not an arbitrary path.

## Approval Token / Approval Record Concept
An approval record represents a cryptographically secure or strictly tracked intent to execute a specific clean operation. It must include:
- `preview_id`: Link to the exact preview that was reviewed.
- `target identifier`: Scoped identifier for the file (not a raw path).
- `allowed operation`: Strictly `clean` or `retry`.
- `timestamp`: When the approval was granted.
- `expiry`: When the approval becomes invalid (e.g., 5 minutes after creation).
- `user confirmation phrase or checkbox state`: Proof of explicit UX interaction.
- `hash/signature/checksum`: Verification of the preview payload to ensure the file hasn't changed between preview and execution.

## One-Time Execution Rule
An approval token must be strictly single-use. Once an execution is started using a token, that token is immediately marked as consumed or invalidated, preventing replay attacks or double-submits.

## Time-Limited Approval Rule
Approvals must have a strict expiration time to prevent stale executions where the underlying file might have changed out of band.

## Target Scoping Rule
The target of the clean operation must be referenced by an internal `jobId` or constrained `target identifier`, preventing any path traversal or arbitrary file modification.

## Immutable Raw Output Preservation
The clean action is explicitly forbidden from modifying `raw.md` or the original source material.

## Derived-Output-Only Rule
The clean action must only create or update derived outputs (e.g., `cleaned.md`, `final.md`) within the pipeline's configured output directories.

## Dry-Run to Execution Transition
The transition from a dry-run (preview) to execution must validate that the current state of the file exactly matches the state at the time of the preview. If the file changed, the transition must be rejected.

## Audit Log Design
Every approval creation, execution start, success, and failure must be logged with an `auditEventId`. The log must capture the `preview_id`, target identifier, timestamp, and the result of the operation.

## Rollback / Recovery Design
Before writing the new derived output, the system should either write atomically (e.g., write to a temp file and rename) or create a backup of the existing derived output. Rollback information must be available in case of a crash during write.

## Failure Handling
- If a write fails or is partially completed, the system must revert to the previous state using rollback info.
- Existing outputs must not be corrupted by a failed clean action.
- The user must be notified of the failure, and the approval token is consumed regardless.

## UX Copy Requirements
The UI wording is strictly constrained to prevent accidental execution and ensure the user understands the limited scope of the action.

**Recommended future button wording:**
- "Approve Clean for This File"
- "Run Approved Clean"
- "Cancel Approval"

**Forbidden wording:**
- "Clean Now", "Auto Clean", "Fix Everything", "Apply All", "Run All", "Promote", "Upload"

**Confirmation copy MUST say:**
- "This will create or update derived cleaned/final outputs only."
- "The original raw output will not be modified."
- "This approval applies only to this file and this preview."
- "This approval expires automatically."
- "No upload or external API call will occur."

## Explicit Non-Goals
- Fully automated, zero-touch clean execution.
- Bulk processing of multiple files with a single approval.
- External system integration (Supabase, GitHub).
