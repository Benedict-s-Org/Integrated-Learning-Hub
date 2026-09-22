# Bridge v4 / L8A: Threat Model Design

**Important Note:** This threat model covers the design constraints for the future human-approved clean action. No implementation exists in L8A.

## Threats & Mitigations

### 1. Accidental Execution
**Threat:** User clicks a button blindly and modifies files without realizing it.
**Mitigation:** Requires explicit human approval flow (generating `approvalId`). UI requires specific confirmation copy. "Clean Now" button is forbidden.

### 2. Stale Preview Approval
**Threat:** User approves a preview, but the file on disk is modified out of band before execution.
**Mitigation:** The approval validates a hash/signature of the preview payload or file timestamp during the transition to execution. Approvals also have strict, short time limits.

### 3. Replay Attack & Approval Token Reuse
**Threat:** A valid `approvalId` is intercepted and sent multiple times to overwrite or execute multiple times.
**Mitigation:** Approvals are strictly single-use. The `approvalId` is atomically marked as consumed at the exact moment execution starts.

### 4. Target Swapping / Operation Swapping
**Threat:** Attacker uses a valid `approvalId` but changes the `jobId` or operation type in the execution request.
**Mitigation:** The `approvalId` on the server securely stores the locked `jobId` and `operation`. Any mismatch in the request is strictly rejected.

### 5. Path Traversal & Arbitrary Path Injection
**Threat:** Request specifies `../../some_other_file.md` to clean arbitrary files.
**Mitigation:** The system uses a scoped `jobId`. Arbitrary local paths are strictly blocked from the API interface.

### 6. Full Content / Local Path Leakage
**Threat:** API responses return the full path (e.g., `C:\Users\...`) or raw markdown snippets, exposing local structure.
**Mitigation:** API responses only contain a `targetDisplayName` and strict metadata fields. Raw content is never returned.

### 7. Batch Accidental Approval
**Threat:** A user accidentally selects all files and approves a clean operation for the entire repository.
**Mitigation:** Multi-file accidental execution is blocked by design; endpoints only process a single `jobId` and `previewId` at a time. No bulk array endpoints exist.

### 8. UI Wording Confusion
**Threat:** Vague buttons like "Fix Everything" cause users to misunderstand the impact.
**Mitigation:** UI text is strictly mandated ("Approve Clean for This File"). Confirmation copy explicitly outlines the exact constraints (e.g., raw is safe).

### 9. CSRF-like Local Request Risk / Malicious Browser Tab
**Threat:** A malicious website open in the user's browser sends a POST request to `localhost:port/api/controlled/clean-approved/start`.
**Mitigation:** Requires a valid, unexpired `approvalId` which is impossible for the malicious tab to guess or retrieve. CORS policies and standard CSRF defenses apply.

### 10. Stale In-Memory Session
**Threat:** The server keeps preview/approval state in memory indefinitely, leading to memory leaks or later accidental triggering.
**Mitigation:** State is aggressively expired and pruned.

### 11. Race Condition between Preview and Approval
**Threat:** Two concurrent requests attempt to generate an approval or consume the approval.
**Mitigation:** Atomic consumption of the `approvalId` lock before any filesystem operations occur.

### 12. Partial Write / Crash during Clean
**Threat:** The server crashes midway through writing `cleaned.md`, corrupting the output.
**Mitigation:** Atomic writes (write to temporary file, then atomic rename/move) and maintaining rollback info.

### 13. Corrupted Derived Output
**Threat:** The pipeline produces invalid Markdown, breaking the file.
**Mitigation:** The original `raw.md` remains intact. The system only updates derived outputs, allowing the user to simply regenerate.

### 14. Unauthorized Supabase Import / External API Drift
**Threat:** The clean action secretly uploads data to Supabase or hits GitHub APIs.
**Mitigation:** The clean action logic is completely decoupled from promotion/upload logic. These boundaries are hardcoded to remain disabled during this phase.

### 15. Prompt Injection in File Content or Metadata
**Threat:** Malicious text inside the markdown file alters the execution of the clean process.
**Mitigation:** The clean process uses deterministic local formatting/parsing and does not pass the text back through an unconstrained LLM prompt during the execution phase.

### 16. Sensitive Student / Exam Material Auto-Clean Risk
**Threat:** Automated scripts clean sensitive materials without teacher oversight.
**Mitigation:** Blocked by the fundamental design principle: no execution without manual, explicit human confirmation for each individual file.
