# Bridge v4 / L9: Promote / Supabase Import Design

## Scope
This document outlines the architectural design for a future "Promote" and "Supabase Import" workflow within the Learning Hub × local-markdown-pipeline bridge. It defines the safe, auditable, and explicit mechanisms required to move a human-reviewed, approved local output candidate (from clean or retry actions) into a "promoted" local status, and subsequently, how it can be imported into Supabase.

## Out of Scope
- **Implementation:** This is a DESIGN ONLY document. No endpoints or frontend features are implemented yet.
- **Direct Supabase Integration:** Connecting to Supabase, adding credentials, or calling Supabase APIs.
- **GitHub API:** Any interaction with GitHub APIs.
- **Runtime Modification:** Altering existing workflows or local pipelines.

## Explicit Non-Goals
- Automatic promotion or automatic Supabase import.
- Batch promotion or batch import.
- Destructive overwriting of any existing raw, cleaned, or final extraction outputs.
- Uploading unreviewed raw document/markdown/OCR content.

## Safety Principles
1. **Immutable Originals:** Promotion must never overwrite original or intermediate local files.
2. **Explicit Human Approval:** Every promote and import action requires an explicit, one-time, time-limited approval.
3. **Separation of Concerns:** Promote (local finalization) and Import (Supabase upload) are strictly separate actions requiring separate approvals.
4. **Scoped Execution:** Approvals are strictly scoped to a single file, a specific selected version, and a specific operation.
5. **Sanitized Payload:** Import only sends the approved final candidate and its approved metadata. No raw or extraneous data is uploaded.

## Promote Workflow
1. **Candidate Review:** A user reviews the output of a clean or retry action (the candidate) in a local-only review surface.
2. **Preview Request:** The frontend requests a promote preview for the specific candidate.
3. **Explicit Approval:** The user explicitly approves the promotion of this specific candidate version.
4. **Approval Record Creation:** The backend creates a single-use, time-limited approval token/record locked to the candidate, target, and version.
5. **Execution:** The frontend calls the promote execution endpoint with the approval token.
6. **Local Finalization:** The backend records the selected candidate as the approved final local version, logs the audit event, and consumes the token. The original files remain untouched.

## Supabase Import Workflow
1. **Promote Prerequisite:** A file must have a promoted final candidate before it can be imported.
2. **Preview Request:** The frontend requests an import preview, generating the exact sanitized payload that will be sent.
3. **Payload Review:** The user reviews the import payload.
4. **Explicit Approval:** The user explicitly approves the import of this specific payload for this specific file.
5. **Approval Record Creation:** The backend creates a single-use, time-limited approval token/record for the import operation.
6. **Execution:** The frontend calls the import execution endpoint with the token.
7. **Upload:** The backend securely uploads the sanitized payload to Supabase, logs the audit event, and consumes the token.

## Required Preconditions
- A clean or retry output must exist and be accessible.
- The candidate must have been reviewed by a human.
- Supabase import requires a previously completed promote action.

## Approval Token / Approval Record Concept
An approval is a cryptographic or securely generated server-side record that authorizes a specific action.
It must include:
- `previewId` or `candidateId`
- `candidateHash` or `payloadHash`
- `jobId`
- Target identifier (e.g., file path or ID)
- Selected version identifier
- Allowed operation (`promote` or `supabase_import`)
- Timestamp of creation
- Expiry timestamp
- User confirmation state (boolean flag)

## Separate Approvals for Promote and Import
To prevent accidental data exfiltration, the act of selecting a final local version (Promote) and uploading it to an external database (Supabase Import) must require distinct human interactions and distinct approval tokens.

## Rules and Constraints
- **One-time execution rule:** An approval token can only be consumed once. Subsequent attempts must be rejected.
- **Time-limited approval rule:** Approvals expire after a short window (e.g., 5-15 minutes).
- **Target scoping rule:** Approvals are locked to a specific target identifier. Swapping targets invalidates the approval.
- **Version scoping rule:** Approvals are locked to a specific candidate version.
- **Import payload scoping rule:** The exact payload hash is locked in the approval. Modifying the payload invalidates the approval.
- **Immutable original output preservation:** No original file (raw, cleaned, retry) is ever modified or deleted during promote/import.
- **No automatic import after promote rule:** Completing a promote action must *never* trigger an import.
- **No batch promote/import rule:** Operations are strictly limited to one file per approval.

## Audit Log Design
Every state change must be recorded locally, detailing:
- Timestamp
- Action (`PROMOTE_APPROVED`, `PROMOTE_EXECUTED`, `IMPORT_APPROVED`, `IMPORT_EXECUTED`, `REJECTED`)
- User/Session identifier
- Target file, version, and payload hash
- Outcome (Success/Failure)
- Approval Token ID (if applicable)

## Rollback / Recovery Design
Since originals are immutable, a rollback of a "Promote" simply involves changing the record of which candidate is the "active final" version, or reverting to a previous candidate. For "Import", a local log of imported records and their Supabase IDs must be maintained to allow for potential soft-deletes or overwrites in the future, although the actual Supabase deletion API is out of scope for L9.

## Failure Handling
- **Local Failure:** If a promote fails, no existing files are corrupted. The approval is either invalidated or expires.
- **Supabase Failure:** If an import fails, the local files are unaffected. The error is logged. Retrying requires generating a new import preview and a *new explicit approval*.

## UX Copy Requirements
The UI wording must strictly avoid ambiguous or "batch" language.

**Recommended Wording:**
- "Prepare Promote Preview"
- "Approve Promote for This File"
- "Record Approved Promote"
- "Prepare Import Preview"
- "Approve Supabase Import for This File"
- "Start Approved Import"
- "Cancel Approval"

**Forbidden Wording:**
- "Promote Now", "Import Now", "Upload All", "Sync All", "Publish", "Apply All", "Run All", "Auto Import"

**Promote Confirmation Copy:**
- "This records one approved local candidate version."
- "Original raw/cleaned/final outputs will not be destructively overwritten."
- "This approval applies only to this file and this selected version."
- "This does not upload anything."
- "This approval expires automatically."

**Import Confirmation Copy:**
- "This imports only the approved final candidate and approved metadata."
- "This approval applies only to this file and this import preview."
- "No batch import will run."
- "No service role key is exposed to the browser."
- "This approval expires automatically."
- "Promotion and import are separate actions."
