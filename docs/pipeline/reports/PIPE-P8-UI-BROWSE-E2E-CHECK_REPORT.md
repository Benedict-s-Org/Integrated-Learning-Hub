# PIPE-P8-UI-BROWSE-E2E-CHECK — Learning Hub Browse Folder End-to-End Check

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P8-UI-BROWSE-E2E-CHECK — Learning Hub Browse Folder End-to-End Check.
- Mode: UI / integration assessment only.
- Explicit out-of-scope items: Source code changes, implementation, folder picker addition, API wrapper creation.
- Stop condition: Report generated, progress log updated, wait for human confirmation.

## 2. Existing UI Inventory
- Relevant page/component files: `src/pages/AdminLocalMarkdownPipelinePage.tsx`
- Routes: Lazy-loaded in `App.tsx` (likely accessible via Admin portal).
- Buttons/inputs related to folder selection: Standard `<input type="text" />` components. There is **no** native folder browser or picker button.
- Current user flow: The user must manually copy absolute Windows paths (e.g., `C:\Users\...`) from Windows Explorer and paste them into the UI text boxes.

## 3. Existing Pipeline Integration
- How Learning Hub connects to local-markdown-pipeline: Direct HTTP calls via `fetch` to `127.0.0.1:8000` (FastAPI backend).
- API base URL or bridge mechanism, if present: `http://127.0.0.1:8000/api/` via CORS.
- Supported endpoints:
  - `POST /api/controlled/scan-preview`
  - `POST /api/controlled/convert-preview/start`
  - `POST /api/controlled/clean-preview/start` (Single file dry-run only)
  - `POST /api/summary/preview`
- Job status handling: Handled via polling (e.g., `POST /api/controlled/convert-preview/status` every 2 seconds).
- Output/report handling: The UI only fetches a "Sanitized Output Summary" which displays aggregate numeric statistics. It does not provide links to view the actual `.md` files or detailed reports.

## 4. Browse Folder Feasibility
- browser-based folder picker feasibility: Standard browsers cannot securely pass absolute local file paths (like `C:\...`) to a backend via a standard file picker (`webkitdirectory` provides file streams/relative paths, not raw local OS paths).
- manual path input feasibility: This works technically because the FastAPI backend is running locally and has native OS permissions, but it is extremely poor UX.
- local backend bridge feasibility: The current manual input approach relies on the user typing the path. A true "browse" experience would require the backend to expose a native OS folder dialog endpoint (e.g., using `tkinter` or similar in Python) and return the selected path to the UI.
- security/permission constraints: The backend has full file permissions as it runs outside the browser sandbox. The browser itself is restricted.
- whether copied test folder can be selected or entered: Yes, the path `C:\Users\bened\Downloads\BK 8 Celebrations Around the World` can be pasted manually.

## 5. E2E Flow Assessment
1. **select/browse folder:** Missing (Requires manual copy-paste of path).
2. **submit input/output path:** Works now (Via text inputs).
3. **scan:** Works now (Via `/api/controlled/scan-preview`).
4. **convert:** Works now (Via `/api/controlled/convert-preview/start`).
5. **poll convert status:** Works now.
6. **clean:** **Missing** (The UI only exposes a dry-run preview for a *single file*. There is no button to call `POST /api/clean` for the entire output folder).
7. **poll clean status:** Missing.
8. **show output/report:** Partially works (Shows numeric summary, but no readable markdown or detailed report).

## 6. Copied Test Folder Validation
- test folder path: `C:\Users\bened\Downloads\BK 8 Celebrations Around the World`
- whether UI accepted it: N/A (Cannot complete flow).
- whether pipeline ran: The scan and convert phases can theoretically run, but the final pipeline state cannot be reached.
- exact blocker: The full-folder `clean` phase is fundamentally unlinked in the React UI, meaning the final `.cleaned.md` and `.final.md` files (with frontmatter) will never be generated if driven solely by the UI. 
- evidence: `grep` search for `/api/clean` in the React source code returned zero results.

## 7. Gap List
1. **Missing Full Clean UI Integration**
   - Location: `AdminLocalMarkdownPipelinePage.tsx`
   - Evidence: No call to `POST /api/clean` exists.
   - Impact: Critical. The pipeline cannot finish formatting the markdown.
   - Likely fix category: UI/bridge fix list (Add a "Run Full Clean" panel).
   - Blocks user workflow: Yes.

2. **Missing Folder Picker**
   - Location: `AdminLocalMarkdownPipelinePage.tsx`
   - Evidence: Paths are captured via `<input type="text" />`.
   - Impact: High friction UX.
   - Likely fix category: Backend-assisted UI dialog (e.g., adding an endpoint in FastAPI that opens a local Windows folder picker, or accepting the manual copy-paste as a known limitation for now).
   - Blocks user workflow: No, but heavily degrades it.

## 8. Decision
**UI partially ready**

## 9. Recommendation
**C. Recommend PIPE-P8-UI-E2E-GAP-CLOSURE-PLAN — small scoped plan only**
Since the UI is missing the final clean step entirely, it cannot complete the end-to-end non-OCR workflow. I recommend creating a small scoped plan to add the missing full-folder Clean execution panel to the UI.

## 10. Final Stop
Stopping execution. Wait for human confirmation before beginning the gap closure plan or making any UI modifications.
