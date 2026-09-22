# Bridge v4 / L8A: API Contract Design

**Important Note:** The endpoints described in this document are NOT implemented in L8A. This is a forward-looking design document only.

## Safe Fields Schema Definition
Response schemas for the endpoints below will use a combination of these safe fields:
- `ok`: boolean
- `mode`: string (e.g., "controlled")
- `operation`: string ("clean")
- `approvalId`: string (unique identifier for the approval)
- `previewId`: string (links back to the generated preview)
- `jobId`: string (scoped identifier, not a path)
- `targetDisplayName`: string (safe name for UI display)
- `status`: string (e.g., "pending", "approved", "completed", "failed")
- `eligible`: boolean
- `blockedReasons`: array of strings
- `warnings`: array of strings
- `safetyFlags`: object containing safety checks
- `expiresAt`: string (ISO 8601 timestamp)
- `auditEventId`: string
- `nextAllowedStep`: string

*API contract explicitly avoids returning raw Markdown input, full local paths, or document snippets.*

---

## 1. POST /api/controlled/clean-approval/create
**Purpose:** Generate a short-lived approval token for a specific clean action based on a prior preview.

**Request Schema:**
```json
{
  "previewId": "string",
  "jobId": "string",
  "operation": "string",
  "confirmationAcknowledged": "boolean",
  "previewHash": "string (optional/recommended)"
}
```

**Response Schema:**
Returns the Safe Fields Schema, specifically providing an `approvalId`, `expiresAt`, and `status: "approved"`.

**Validation Rules:**
- `previewId` must be active and valid.
- `jobId` must match the `jobId` of the `previewId`.
- `confirmationAcknowledged` must be explicitly `true`.
- Cannot accept arbitrary paths.

**Sanitization Rules:**
- Strict regex validation on IDs.

**Rejection Cases:**
- `previewId` not found or expired.
- `jobId` mismatch.
- User did not check confirmation box.
- User attempts to approve multiple files accidentally (e.g., array of IDs passed).

**Security Notes:**
- Token (`approvalId`) must expire quickly (e.g., 5-10 minutes).
- Cannot be reused for batch approvals.

---

## 2. POST /api/controlled/clean-approval/status
**Purpose:** Check the validity and expiration of an existing approval.

**Request Schema:**
```json
{
  "approvalId": "string"
}
```

**Response Schema:**
Returns Safe Fields Schema, focusing on `status`, `expiresAt`, and `eligible`.

**Validation Rules:**
- `approvalId` must exist.

**Rejection Cases:**
- Approval not found or already consumed.

**Security Notes:**
- Read-only check, does not extend the expiration time.

---

## 3. POST /api/controlled/clean-approved/start
**Purpose:** Execute the approved clean action, transitioning from dry-run to actual write of derived outputs.

**Request Schema:**
```json
{
  "approvalId": "string",
  "jobId": "string"
}
```

**Response Schema:**
Returns Safe Fields Schema, focusing on `status: "processing"`, `auditEventId`.

**Validation Rules:**
- `approvalId` must be valid, unexpired, and unconsumed.
- `jobId` must match the `jobId` locked in the `approvalId`.

**Sanitization Rules:**
- Input validation on IDs to prevent injection.

**Rejection Cases:**
- `approvalId` is expired or has already been used.
- `jobId` mismatch or target has changed since preview.
- Preview payload hash mismatch (if file changed on disk).
- Any attempt to target `raw.md`.

**Security Notes:**
- Consumes the `approvalId` atomically before initiating write to prevent race conditions or double-submit.
- Action must execute atomically (e.g., write to temp, rename).

---

## 4. POST /api/controlled/clean-approved/status
**Purpose:** Poll the status of an executing clean action.

**Request Schema:**
```json
{
  "jobId": "string"
}
```

**Response Schema:**
Returns Safe Fields Schema. If complete, `status` will be "completed" and `nextAllowedStep` will indicate readiness for next phases.

**Validation Rules:**
- `jobId` must map to an active or recently completed approved clean job.

**Rejection Cases:**
- Job not found.

**Security Notes:**
- Does not leak raw output or file snippets, only status and metadata.
