# Bridge v4 / L9: API Contract

**IMPORTANT:** The endpoints described in this document are NOT implemented in L9. This is a design document specifying future endpoints.

## Avoidance Constraints
This API contract strictly avoids:
- Arbitrary path input
- Raw Markdown input from frontend
- Raw content return (unless explicitly inside a local-only human review surface and heavily sanitized)
- Document snippets in status responses
- Full local paths in requests or responses
- Long-lived approval tokens
- Multi-file or batch execution endpoints
- Endpoints that perform automatic promote or automatic import
- Receiving Supabase credentials in the request body
- Exposing the Supabase service role key

## Response Schema Baseline
All successful responses should align with this safe schema:
```typescript
{
  ok: boolean;
  mode: string;
  operation: string;
  approvalId?: string;
  previewId?: string;
  candidateId?: string;
  jobId?: string;
  targetDisplayName: string; // Sanitized, no full path
  selectedVersion?: string;
  status: string;
  eligible: boolean;
  blockedReasons?: string[];
  warnings?: string[];
  safetyFlags?: string[];
  expiresAt?: string; // ISO 8601
  auditEventId?: string;
  nextAllowedStep?: string;
}
```

## Controlled Endpoints (Design Only)

### POST /api/controlled/promote-preview/start
- **Purpose:** Initiates the generation of a promote preview for a specific candidate version.
- **Request Schema:** `{ candidateId: string, jobId: string }`
- **Response Schema:** Baseline + `previewId`
- **Validation/Sanitization:** Verify candidate exists and belongs to the specified job. Strip local paths.
- **Rejection Cases:** Invalid candidateId, invalid jobId, candidate not found.

### POST /api/controlled/promote-preview/status
- **Purpose:** Polls the status of the promote preview generation.
- **Request Schema:** `{ previewId: string }`
- **Response Schema:** Baseline + status updates. **No snippets or raw content.**
- **Rejection Cases:** Invalid previewId.

### POST /api/controlled/promote-approval/create
- **Purpose:** Creates a time-limited, single-use approval token for the promote action based on a reviewed preview.
- **Request Schema:** `{ previewId: string, candidateId: string, selectedVersion: string, userConfirmed: boolean }`
- **Response Schema:** Baseline + `approvalId`, `expiresAt`.
- **Validation/Sanitization:** Verify userConfirmed is true. Lock the token to the specific candidateId and selectedVersion.
- **Rejection Cases:** `userConfirmed` is false, preview expired, preview doesn't match candidate.

### POST /api/controlled/promote-approved/start
- **Purpose:** Executes the promote action using a valid approval token.
- **Request Schema:** `{ approvalId: string }`
- **Response Schema:** Baseline + `auditEventId`.
- **Validation/Sanitization:** Verify approvalId is valid, unused, not expired, and for operation `promote`.
- **Rejection Cases:** Token expired, token used, invalid token, operation mismatch.

### POST /api/controlled/promote-approved/status
- **Purpose:** Polls the execution status of the approved promote action.
- **Request Schema:** `{ jobId: string, approvalId: string }`
- **Response Schema:** Baseline + execution status.

### POST /api/controlled/import-preview/start
- **Purpose:** Initiates the generation of a sanitized payload preview for Supabase import from a promoted candidate.
- **Request Schema:** `{ candidateId: string }` (must be a *promoted* candidate)
- **Response Schema:** Baseline + `previewId`
- **Validation/Sanitization:** Verify candidate is legally promoted.
- **Rejection Cases:** Candidate not promoted, candidate not found.

### POST /api/controlled/import-preview/status
- **Purpose:** Polls the status and retrieves the sanitized payload for review.
- **Request Schema:** `{ previewId: string }`
- **Response Schema:** Baseline + payload summary (hashes, sanitized metadata).
- **Rejection Cases:** Invalid previewId.

### POST /api/controlled/import-approval/create
- **Purpose:** Creates a time-limited, single-use approval token for the Supabase import.
- **Request Schema:** `{ previewId: string, candidateId: string, payloadHash: string, userConfirmed: boolean }`
- **Response Schema:** Baseline + `approvalId`, `expiresAt`.
- **Validation/Sanitization:** Verify userConfirmed is true. Lock token to the candidate and payloadHash.
- **Rejection Cases:** `userConfirmed` false, payload hash mismatch.

### POST /api/controlled/import-approved/start
- **Purpose:** Executes the Supabase import using the valid approval token.
- **Request Schema:** `{ approvalId: string }`
- **Response Schema:** Baseline + `auditEventId`.
- **Validation/Sanitization:** Verify token is valid, unused, not expired, for operation `supabase_import`.
- **Rejection Cases:** Token used/expired, operation mismatch.

### POST /api/controlled/import-approved/status
- **Purpose:** Polls the execution status of the approved import action.
- **Request Schema:** `{ jobId: string, approvalId: string }`
- **Response Schema:** Baseline + status.
