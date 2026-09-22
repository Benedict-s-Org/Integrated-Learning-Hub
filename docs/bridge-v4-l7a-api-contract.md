# API Contract: L7A Preview-Only Endpoints

## 1. Overview
This contract defines the strict interfaces for the new preview-only endpoints in L7A. All endpoints adhere to a strict asynchronous job pattern.

## 2. Input and Output Sanitization Rules
### Input Sanitization
- **Path Validation:** All input filenames/paths must be validated against a strict regex (e.g., alphanumeric, hyphens, underscores, dots) to prevent directory traversal (`../`).
- **Path Normalization:** Inputs must be treated as relative to a pre-configured safe `DATA_DIR`. Absolute paths are rejected.
- **Parameter Dropping:** Unrecognized parameters are silently dropped.

### Output Sanitization
- **No Secrets:** Output must be scanned or structurally guaranteed not to contain environment variables, API keys, or Supabase tokens.
- **Path Masking:** Full server paths (e.g., `C:\AI\Antigravity\...`) must be masked or truncated to just the basename (e.g., `document.md`).
- **Content Truncation:** Raw document contents should be summarized or truncated. Do not dump the entire raw file content into the JSON response.

## 3. Endpoints

### 3.1 POST /api/controlled/clean-preview/start
**Purpose:** Initiates a dry-run clean preview job.

**Request Body:**
```json
{
  "target_file": "example.md",
  "options": {
    "dry_run": true
  }
}
```
*Note: If `dry_run` is missing, it defaults to true. If `dry_run` is false, return 400 Bad Request.*

**Response (202 Accepted):**
```json
{
  "job_id": "clean-prev-12345",
  "status": "PENDING",
  "message": "Clean preview job started safely."
}
```

### 3.2 POST /api/controlled/clean-preview/status
**Purpose:** Polls the status of a clean preview job.

**Request Body:**
```json
{
  "job_id": "clean-prev-12345"
}
```

**Response (200 OK):**
```json
{
  "job_id": "clean-prev-12345",
  "status": "COMPLETED",
  "result_summary": {
    "lines_to_remove": 15,
    "formatting_fixes": 3,
    "sanitized_preview_snippet": "... [truncated safely] ..."
  }
}
```

### 3.3 POST /api/controlled/retry-preview/start
**Purpose:** Initiates a dry-run retry preview job.

**Request Body:**
```json
{
  "target_file": "failed_doc.pdf",
  "stage_to_retry": "convert",
  "options": {
    "dry_run": true
  }
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "retry-prev-67890",
  "status": "PENDING",
  "message": "Retry preview job started safely."
}
```

### 3.4 POST /api/controlled/retry-preview/status
**Purpose:** Polls the status of a retry preview job.

**Request Body:**
```json
{
  "job_id": "retry-prev-67890"
}
```

**Response (200 OK):**
```json
{
  "job_id": "retry-prev-67890",
  "status": "COMPLETED",
  "result_summary": {
    "would_execute": ["convert_markdown", "extract_images"],
    "estimated_time_seconds": 45,
    "status": "Ready for future execution."
  }
}
```
