# Bridge v4 / L8B: API Contract

**IMPORTANT NOTE**: The endpoints defined in this document are strictly for future DESIGN purposes. They are NOT implemented in L8B.

## General Principles
- **No arbitrary path input**: Targets are identified by scoped `jobId` or secure identifiers.
- **No raw content exchange**: Markdown input, raw content, and document snippets are never returned or accepted.
- **No full local paths**: Only safe, relative identifiers or sanitized display names are used.
- **Short-lived tokens**: Approval tokens expire quickly.
- **Safe Response Schema**: Only metadata and status flags are returned.

---

## 1. POST /api/controlled/retry-approval/create

**Purpose**: 
Creates a time-limited, single-use approval record based on a previously generated retry preview.

**Request Schema**:
```json
{
  "previewId": "string (uuid)",
  "jobId": "string (scoped identifier)",
  "selectedRetryEngine": "string",
  "confirmationConsent": "boolean"
}
```

**Response Schema**:
```json
{
  "ok": "boolean",
  "approvalId": "string (uuid) | null",
  "expiresAt": "string (ISO-8601) | null",
  "status": "string",
  "blockedReasons": ["string"],
  "warnings": ["string"],
  "safetyFlags": {
    "isVariantOnly": "boolean",
    "isNoPromote": "boolean"
  }
}
```

**Validation & Sanitization Rules**:
- `previewId` must exist and be valid.
- `jobId` must match the `jobId` stored in the preview plan.
- `selectedRetryEngine` must match the engine in the preview plan.
- `confirmationConsent` must be explicitly `true`.

**Rejection Cases**:
- Preview not found or expired.
- Mismatched target or engine.
- Confirmation not provided.
- Accidental multi-file request (only single `jobId` allowed).

---

## 2. POST /api/controlled/retry-approval/status

**Purpose**: 
Checks the validity and expiration status of an existing approval token.

**Request Schema**:
```json
{
  "approvalId": "string (uuid)"
}
```

**Response Schema**:
```json
{
  "ok": "boolean",
  "approvalId": "string (uuid)",
  "status": "string (e.g., 'valid', 'expired', 'used', 'revoked')",
  "expiresAt": "string (ISO-8601)",
  "jobId": "string",
  "selectedRetryEngine": "string",
  "eligible": "boolean"
}
```

**Validation & Sanitization Rules**:
- Must verify if `approvalId` exists in backend memory/store.
- Must accurately report if token is past `expiresAt` or already marked as `used`.

---

## 3. POST /api/controlled/retry-approved/start

**Purpose**: 
Initiates the actual retry engine execution using a valid approval token.

**Request Schema**:
```json
{
  "approvalId": "string (uuid)"
}
```

**Response Schema**:
```json
{
  "ok": "boolean",
  "mode": "string (e.g., 'retry_execution')",
  "operation": "string",
  "jobId": "string",
  "targetDisplayName": "string",
  "selectedRetryEngine": "string",
  "status": "string (e.g., 'started')",
  "auditEventId": "string (uuid)",
  "blockedReasons": ["string"],
  "nextAllowedStep": "string (e.g., 'poll_status')"
}
```

**Validation & Sanitization Rules**:
- `approvalId` must be valid, unused, and unexpired.
- Instantly marks `approvalId` as `used` to prevent double-submit.
- Verifies underlying target constraints again before launching the engine.

**Rejection Cases**:
- Approval token is invalid, expired, or already used.
- Target file no longer exists or is locked.
- Requested engine is unavailable on the local system.
- Target changes detected since preview.

---

## 4. POST /api/controlled/retry-approved/status

**Purpose**: 
Polls the execution status of an ongoing approved retry action.

**Request Schema**:
```json
{
  "jobId": "string",
  "auditEventId": "string (uuid)"
}
```

**Response Schema**:
```json
{
  "ok": "boolean",
  "status": "string (e.g., 'running', 'completed', 'failed')",
  "jobId": "string",
  "targetDisplayName": "string",
  "warnings": ["string"],
  "blockedReasons": ["string"],
  "nextAllowedStep": "string (e.g., 'review_variant')"
}
```

**Validation & Sanitization Rules**:
- No raw file paths in the response.
- Detailed error stack traces are sanitized; only safe generic statuses or controlled warning strings are returned.
- Does not expose content of the output variants.

---
**Security Notes for all endpoints**:
- Protect against CSRF by restricting CORS to the local Learning Hub client.
- Ensure all states (previews, approvals, executions) reside on the backend and cannot be spoofed by client-side tampering.
