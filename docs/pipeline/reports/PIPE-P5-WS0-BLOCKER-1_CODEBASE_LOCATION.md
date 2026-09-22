# PIPE-P5-WS0-BLOCKER-1 — local-markdown-pipeline Codebase Location Report

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P5-WS0-BLOCKER-1 — Locate / Restore local-markdown-pipeline Codebase.
- Mode: Assessment / recovery planning only.
- Explicit out-of-scope items: Restoring/copying files, editing `.gitignore`, running tests/models/OCR, any Supabase or Bridge work, implementing or regenerating the codebase.
- Stop condition: Documentation files created/updated, safe restore options summarized.

## 2. Current Blocker
The `local-markdown-pipeline/` directory is missing from the current `Integrated-Learning-Hub` workspace. Previous baseline checks and blocker reports confirmed its absence inside the workspace, which halts any pipeline-specific capability checks or testing for the WS0 phase.

## 3. Evidence Summary
- **`.gitignore`**: Explicitly ignores `local-markdown-pipeline/` within the `Integrated-Learning-Hub` workspace.
- **existing docs**: Bridge frontend UI (`src/pages/AdminLocalMarkdownPipelinePage.tsx`) instructs users to `cd local-markdown-pipeline` inside the workspace.
- **previous reports**: `l6b_blocker_report.md` states the codebase is completely missing from the workspace.
- **local file searches**: A directory named `local-markdown-pipeline` was successfully found **outside** the workspace, located as a sibling directory at `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline`.
- **repo structure**: The discovered sibling directory contains a `.git` folder, `backend/`, `frontend/`, and `README.md`, indicating it is a fully standalone Git repository.
- **references found in source files**: The pipeline's `README.md` mentions a macOS path (`/Users/mba/Documents/Antigravity/Supabase_Learning_Hub/local-markdown-pipeline`), suggesting it was originally developed on a Mac before being moved/cloned here.

## 4. Expected Codebase Role
Based on the contents found in the sibling repository (`c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline`), the codebase provides:
- **scanner**: Implemented via `backend/scanner.py`.
- **manifest**: Managed by the scanner and `backend/job_runner.py`.
- **converter**: Implemented via `backend/converter.py`.
- **Docling / MarkItDown integration**: Present in `backend/engines/docling_engine.py` and `backend/engines/markitdown_engine.py`.
- **OCR logic**: Implemented in `backend/ocr_runner.py` and required by `requirements-ocr.txt`.
- **cleaner**: Implemented via `backend/cleaner.py` and `backend/clean_runner.py`.
- **report generation**: Handled by `backend/quality_checker.py`.
- **tests**: Test suites exist in `backend/tests/` and end-to-end tests in `e2e_test.py`.
- **runtime scripts**: Provided via `build_check.sh`.

## 5. Possible Location / Restore Hypotheses

**B. Separate Git repository (CONFIRMED)**
- **Evidence**: Found at `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline` with a `.git` folder.
- **Confidence**: 100%. The folder exists locally right next to the current workspace.
- **Risk**: Low. It is already available locally.
- **How to verify safely**: `cd c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline` and run `git status`.

**A. Ignored local folder inside Integrated-Learning-Hub**
- **Evidence**: `.gitignore` has `local-markdown-pipeline/`, but the folder is physically absent.
- **Confidence**: 100% that it is absent *inside* the workspace, but 100% that it is intended to be ignored if placed there.
- **Risk**: Low.
- **How to verify safely**: Already verified via filesystem search; it does not exist inside the workspace.

**C. Copied from Dell laptop**
- **Evidence**: The original prompt mentions previous testing on a Dell laptop.
- **Confidence**: Moderate. The codebase exists, but its current commit state might reflect Dell environment testing (e.g., CUDA assumptions).
- **Risk**: Moderate (potential CUDA hardcodes).
- **How to verify safely**: Review `setup_models.py` or `ocr_runner.py` for CUDA assumptions once the codebase is active.

## 6. Safe Restore Options
*Note: These are proposals. None have been executed.*

**Option 1: Attach as a sibling workspace**
- **Description**: Treat `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline` as the active codebase without moving it. Future Antigravity tasks can be directed to run in that workspace.
- **Required human input**: Human must confirm if we should operate in the sibling directory.
- **Risk**: Lowest.
- **Preserves existing repo state**: Yes.
- **Risks overwriting files**: No.
- **Recommended verification command**: `cd c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline && git status`

**Option 2: Symlink the sibling directory into the workspace**
- **Description**: Create a symlink `local-markdown-pipeline` inside `Integrated-Learning-Hub` pointing to the sibling directory.
- **Required human input**: Human must execute or approve the symlink command (may require Admin rights on Windows).
- **Risk**: Low.
- **Preserves existing repo state**: Yes (symlink will be ignored by `.gitignore`).
- **Risks overwriting files**: No.
- **Recommended verification command**: `New-Item -ItemType SymbolicLink -Path "c:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub\local-markdown-pipeline" -Target "c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline"`

**Option 3: Move the folder into the workspace**
- **Description**: Move the sibling directory directly into `Integrated-Learning-Hub/local-markdown-pipeline`.
- **Required human input**: Human must confirm and execute the move.
- **Risk**: Low, but alters the filesystem structure.
- **Preserves existing repo state**: Yes (ignored by git).
- **Risks overwriting files**: No, the destination does not exist.
- **Recommended verification command**: `Move-Item -Path "c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline" -Destination "c:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub\"`

## 7. What Not To Do
- Do not regenerate the pipeline from docs.
- Do not edit `.gitignore` yet.
- Do not copy unknown folders over existing workspace.
- Do not treat Bridge docs as Pipeline source code.
- Do not continue PIPE-P5-WS0 until the codebase location strategy is explicitly confirmed by the human.

## 8. Impact on PIPE-P5-WS0
**Blocked until codebase is restored/attached:**
- pipeline component sanity check
- scanner / cleaner / report tests
- OCR route assessment
- repo-specific runtime check

**Can be done separately (Not blocked):**
- general WS environment check
- OS / Python / Node / Git check
- GPU / Vulkan / llama.cpp check

## 9. Recommendation
**A. Locate existing local folder and attach it without modifying code.**
The codebase is confirmed to exist as a sibling repository at `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline`. The safest action is to ask the human whether we should operate directly on this sibling directory (Option 1) or move/symlink it into the `Integrated-Learning-Hub` workspace (Options 2 or 3).

## 10. Final Stop
The missing codebase has been located on the local filesystem. This report is complete. Halting execution to wait for human confirmation before restoring, copying, regenerating, editing `.gitignore`, running PIPE-P5-WS0, or modifying any source/config/test files.
