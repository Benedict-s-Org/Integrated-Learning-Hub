# Local-first Folder-to-Markdown Pipeline Progress Log

## Current Scope
- Primary roadmap: Original Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current priority: Finalize Phase 8 non-OCR UI integration.
- Current mode: Documentation and closure.
- Current checkpoint: PIPE-P8-UI-COPIED-FOLDER-E2E-TEST — UI E2E Test Report.
- Out of scope: OCR redesign, native OS folder picker, wrapper scripts, Bridge work, `.doc` support.
- Stop condition: UI E2E test report finalized, progress log updated, wait for human confirmation.

## Current Runtime Assumption
- Previous reference environment: Dell laptop environment (Windows, RTX 3050 Laptop GPU, 4GB VRAM, CUDA / torch route).
- Target environment: WS / Minisforum MS S1 Max type environment (128GB RAM, AMD Radeon 8060S / AMD iGPU, Vulkan / llama.cpp / GGUF-oriented, no CUDA assumption).
- Key rebase reason: Hardware shift invalidates the original CUDA-based OCR dependencies (`paddlepaddle-gpu`, `autoawq`).

## Current Progress Summary
- What appears completed: The non-OCR workflow release audit (PIPE-P8-PARTIAL-REAUDIT), release prep (PIPE-P8-PARTIAL-RELEASE-PREP), smoke run (PIPE-P8-PARTIAL-SMOKE-RUN), docs patch (PIPE-P8-PARTIAL-DOCS-PATCH), UI gap closure (PIPE-P8-UI-CLEAN-PHASE-IMPLEMENTATION), and Supabase env trace (PIPE-P8-UI-SUPABASE-ENV-TRACE) are completed. The manual E2E test (PIPE-P8-UI-COPIED-FOLDER-E2E-TEST) has officially PASSED, confirming the Learning Hub UI successfully drives the pipeline for `.docx` files.
- What appears partially completed: The Learning Hub UI (`AdminLocalMarkdownPipelinePage.tsx`) fully supports the end-to-end API pipeline (scan -> convert -> clean). A native folder picker is still absent (accepted UX limitation). `.doc` files must be manually converted to `.docx`. Scanned PDFs require OCR (out of scope).
- What is unknown: The exact Vulkan/GGUF model to be used for the future OCR/VLM route.
- What is blocked pending WS capability check: The original OCR route is permanently blocked on this hardware due to CUDA assumptions.

## Checkpoint Index
- PIPE-P5-WS0-PRE — Current Repo Progress Baseline (Completed)
- PIPE-P5-WS0-BLOCKER-1 — Locate / Restore local-markdown-pipeline Codebase (Completed)
- PIPE-P5-WS0 — WS Runtime Rebase / Capability Check (Completed)
- PIPE-P8-PARTIAL-REAUDIT — Non-OCR Workflow Release Audit (Completed)
- PIPE-P8-PARTIAL-RELEASE-PREP — Non-OCR Release Notes and Usage Guide (Completed)
- PIPE-P8-PARTIAL-SMOKE-RUN — Non-OCR Real Folder Smoke Run (Completed)
- PIPE-P8-PARTIAL-DOCS-PATCH — Patch Non-OCR Usage Documentation (Completed)
- PIPE-P8-UI-BROWSE-E2E-CHECK — Learning Hub Browse Folder End-to-End Check (Completed)
- PIPE-P8-UI-E2E-GAP-CLOSURE-PLAN — Minimal UI Gap Closure Plan (Completed)
- PIPE-P8-UI-CLEAN-PHASE-IMPLEMENTATION — Minimal UI Clean Phase Support (Completed)
- PIPE-P8-UI-SUPABASE-ENV-TRACE — Supabase Env Trace Report (Completed)
- PIPE-P8-UI-COPIED-FOLDER-E2E-TEST — UI E2E Test Report (Completed)

## Latest Decision Summary
- Decision: `PIPE-P8-UI-COPIED-FOLDER-E2E-TEST` is classified as PASS with expected limitations.
- Reason: Human review confirmed that the `.docx` workflow is usable through the UI and the generated Markdown quality is acceptable.
- Evidence: Manual E2E test results, where `.doc` files were correctly skipped (to be manually converted to `.docx`), and scanned PDFs were correctly deferred to future OCR implementation.
- Next allowed step: Wait for human confirmation on the next major milestone or roadmap phase (e.g., OCR redesign or Bridge work).
- Not allowed yet: Moving files, editing `.gitignore`, OCR redesign, model replacement, Bridge integration, `.doc` support implementation.

## Open Questions
- What is the next primary roadmap phase? (e.g., initiating the Vulkan/GGUF OCR redesign or starting the Bridge integration).

## Risk Register
- Browser Security: A true native folder picker requires backend assistance (e.g., Python `tkinter` dialog), since browsers cannot read absolute local paths without strict user file selection.
- CUDA assumption leakage: Must avoid running any old OCR scripts.
- AMD Vulkan compatibility: The future OCR redesign will require careful compilation of `llama_cpp_python`.

## Next Step Queue
Wait for human confirmation to define the next major milestone.
