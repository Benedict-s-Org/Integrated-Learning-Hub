# PIPE-P8-UI-E2E-GAP-CLOSURE-PLAN — Minimal UI Gap Closure Plan

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P8-UI-E2E-GAP-CLOSURE-PLAN — Minimal UI Gap Closure Plan for Learning Hub Browse Workflow.
- Mode: Gap closure planning only.
- Explicit out-of-scope items: Source code changes, implementation, adding a native folder picker, adding OS-native dialog support, adding Python wrapper scripts, OCR redesign, VLM route, model replacement, CUDA workaround, Bridge work, Supabase work, import/promote work, new roadmap creation.
- Stop condition: Gap closure plan created, progress log updated, wait for human confirmation.

## 2. Current E2E Status
- backend pipeline status: Fully functional on WS for non-OCR parsing (scan, convert, clean run via API).
- UI scan status: Working. Exposes `POST /api/controlled/scan-preview`.
- UI convert status: Working. Exposes `POST /api/controlled/convert-preview/start` and polls status.
- UI clean status: **Missing**. The UI only exposes a dry-run single-file clean preview. It cannot run a full folder clean.
- folder path input status: Functional via manual absolute path text input. No native picker.
- output/report visibility status: Displays high-level numeric aggregates via `/api/summary/preview`.

## 3. Blocking Gap
The exact blocker preventing the end-to-end user workflow in the UI is that the **UI lacks the full-folder clean phase**. 
- Evidence from `AdminLocalMarkdownPipelinePage.tsx` shows no call is made to `POST /api/clean`. 
- There is no polling implementation for `GET /api/clean/status/{job_id}`.
- Without this step, the converted markdown files never receive frontmatter formatting, are never cleaned of parser artifacts, and never reach the final pipeline state (`.cleaned.md` / `.final.md`).

## 4. Minimal Fix Scope
To fix this blocker, we will implement the smallest safe UI change required to complete the validated flow (scan → convert → clean/report).

**Required:**
- Add a new "Controlled Clean Execution" section/button in `AdminLocalMarkdownPipelinePage.tsx`.
- Bind the button to call the existing `POST /api/clean` backend endpoint.
- Implement polling against `GET /api/clean/status/{job_id}`.
- Display clean progress/status (queued, running, completed, error).
- Display the completion/error result.
- Reuse the existing output path state to pass to the clean endpoint.
- Keep the current manual path input mechanism for now.

**Not required:**
- Native folder picker (Browser security blocks raw path access natively; out of scope for minimal fix).
- OCR support.
- New backend endpoints (the existing `/api/clean` is sufficient).
- New pipeline logic, model changes, or import/promote flows.

## 5. Files Likely Involved
- `src/pages/AdminLocalMarkdownPipelinePage.tsx`
  - Current role: Launcher UI managing React state for scan and convert.
  - Expected minimal change later: Add state variables for `cleanJobId` and `cleanState`, add a UI panel to trigger `POST /api/clean`, and implement a `useEffect` hook to poll `/api/clean/status/{job_id}`.
  - Risk: Low. Simply replicating the pattern already established for the Convert phase.

## 6. Endpoint Contract
The expected sequential API flow to be fully covered by the UI is:
1. `POST /api/scan` (Currently mapped to `/api/controlled/scan-preview`)
2. `POST /api/convert` (Currently mapped to `/api/controlled/convert-preview/start`)
3. `GET /api/convert/status/{job_id}`
4. `POST /api/clean`
5. `GET /api/clean/status/{job_id}`

**For the Clean Endpoint:**
- **Request payload shape:** `{"output_path": "c:\\path\\to\\folder"}` (Based on `ConvertRequest` schema in `main.py`).
- **Response shape:** `{"job_id": "job_...", "status": "started", "total": 5, "message": "..."}`
- **Status polling shape:** `GET /api/clean/status/{job_id}` returns a JSON dict containing `{ "status": "completed|running|error", "total": int, "done": int, "failures": int, ...}`.
- **Unknowns requiring verification:** Whether we should map to a `/api/controlled/clean-execution/start` endpoint if the backend introduces one for safety, or just use the raw `/api/clean`. Based on existing code, `POST /api/clean` is safely locked to `127.0.0.1` so direct invocation is acceptable.

## 7. UX Flow After Fix
1. User pastes or enters the input folder path into the UI.
2. User chooses or confirms the output folder path.
3. User clicks **Scan** and reviews discovered files.
4. User clicks **Convert** and waits for the conversion progress bar/status to finish.
5. User clicks **Clean** (new button) to finalize the documents.
6. User waits for the clean completion status to finish.
7. User reviews the numeric summary and checks the final markdown files directly in their OS file explorer.

## 8. Acceptance Criteria for Later Implementation
- `scan` can be triggered from UI.
- `convert` can be triggered from UI.
- `clean` (full folder) can be triggered from UI.
- `clean` job status and progress are visibly updated.
- `clean` errors or completion states are handled gracefully.
- The pipeline generates the final output files (`.final.md`, `_index.md`) successfully.
- A copied test folder can complete the full E2E flow exclusively via the Learning Hub UI clicks.
- No OCR is invoked.
- No source files are modified (only the output folder is written to).

## 9. Optional Later Improvement: Folder Picker
- Manual path input remains acceptable for the current minimal release.
- Browser sandbox security prevents standard `<input type="file" />` elements from returning raw absolute OS paths (they return file streams or relative paths).
- Implementing a native folder picker requires a local backend or desktop bridge design (e.g., Python triggering an OS dialog and returning the string). This is an optional usability upgrade and is **not** part of the minimal fix.

## 10. Risks
- Endpoint mismatch: Ensure the payload shape for `/api/clean` strictly matches what `AdminLocalMarkdownPipelinePage` sends.
- Job polling mismatch: Ensure the clean status polling hook properly aborts on unmount to prevent React memory leaks.
- Output path confusion: If the user alters the output path text box between the convert and clean phases, it will fail.
- User expectations: Users might mistakenly expect scanned PDFs to work if warnings aren't clear enough.
- Windows path escaping: Pasting paths like `C:\Folder` must be properly escaped into JSON by React (which `JSON.stringify` handles natively, but is worth monitoring).

## 11. Recommendation
Recommend exactly one next step:

**PIPE-P8-UI-CLEAN-PHASE-IMPLEMENTATION** — implement minimal UI clean phase support.

*(Do not start implementation yet).*

## 12. Final Stop
The gap closure plan has been documented. Execution is halted pending human confirmation.
