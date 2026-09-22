# Bridge v4 / L7B Status

The Bridge v4 / L7B feature (Controlled Clean / Retry Preview) has been implemented and deployed.

## Preview-Only Status

**IMPORTANT:** L7B is strictly a **preview-only** milestone. 

- The `/api/controlled/clean-preview/start` and `/api/controlled/retry-preview/start` endpoints are enabled for dry-runs only.
- No actual document mutation, deletion, OCR execution, or database writing occurs.
- Raw text and file paths are sanitized and are never returned to the Learning Hub frontend.
- Direct execution endpoints (`/api/clean`, `/api/retry`) remain strictly blocked and unavailable from the Learning Hub bridge.

Any subsequent phase (e.g., L7C) that aims to implement actual file mutation must undergo a separate security review and explicit approval.
