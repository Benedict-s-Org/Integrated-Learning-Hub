# PIPE-CURRENT_PROGRESS_BASELINE — Current Repo Progress Baseline

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P5-WS0-PRE — Current Repo Progress Baseline.
- Mode: Assessment / documentation only.
- Explicit out-of-scope items: Bridge (L1-L11) items, implementation, testing, config changes, Supabase/import/promote work.
- Stop condition: Documentation generated and summarized, halting for human confirmation.

## 2. Repo Structure Snapshot
The repository (`Integrated-Learning-Hub`) does not contain the original pipeline codebase.
- `local-markdown-pipeline/`: Explicitly ignored in `.gitignore` and confirmed missing from the workspace by previous reports (`l6b_blocker_report.md`).
- `src/pages/AdminLocalMarkdownPipelinePage.tsx`: Exists, but is part of the Admin UI Launcher / Bridge.
- `docs/`: Contains Bridge roadmap documents (`local_markdown_pipeline_bridge_checkpoint_l1_l5c.md`, `l5a_full_roadmap_security_design.md`, etc.), but no original Phase 1-8 progress reports.

## 3. Pipeline Module Inventory
- scanner: Missing (referenced in bridge docs only).
- manifest: Missing.
- converter: Missing.
- Docling: Missing.
- MarkItDown: Missing.
- OCR: Missing.
- cleaner: Missing.
- report generation: Missing.
- frontend: Launcher present (`AdminLocalMarkdownPipelinePage.tsx`), standalone pipeline UI missing.
- backend: Missing (`main.py`, `scanner.py`, etc., are missing).
- tests: Missing.
- scripts: Missing.
- docs / reports: Bridge-related docs exist. Original pipeline docs/reports missing.

## 4. Phase 1–8 Progress Baseline
- Phase 1-4 (Core pipeline): Unknown / requires human confirmation. (No codebase or reports exist in repo).
- Phase 5 (OCR/Models): Unknown / requires human confirmation. (No codebase).
- Phase 6-8: Unknown / requires human confirmation.

## 5. Test and Evidence Inventory
- existing test files: None found for the pipeline.
- existing reports: `l6b_blocker_report.md` exists.
- existing scripts: None found for the pipeline.
- existing docs: Bridge-related docs (`local_markdown_pipeline_bridge_checkpoint_l1_l5c.md`, `l5a_full_roadmap_security_design.md`).
- what they prove: They prove that the pipeline backend is expected to be in `local-markdown-pipeline/`, but that folder is missing/ignored. The Admin Launcher is partially implemented.
- what they do not prove: They do not prove the functionality, completion, or safety of the original Phase 1-8 pipeline modules.

## 6. Dell-only vs WS-relevant Evidence
- Dell-only evidence: Unknown environment evidence (Code is missing). The user prompt mentions Dell CUDA assumptions in previous Phase 5 tests.
- generic non-hardware evidence: Unknown.
- WS-specific evidence: Unknown.
- unknown environment evidence: The entire codebase's hardware readiness is currently unknown from the repo files alone.

## 7. Current Priority Validation
PIPE-P5-WS0 (WS Runtime Rebase / Capability Check) is the correct next checkpoint. Since the codebase is missing, the first step of this check or any subsequent work will require locating, restoring, and validating the pipeline codebase against the new WS runtime.

## 8. Risks and Scope Drift Warnings
- stale roadmap docs: Existing documentation focuses heavily on the L1-L11 Bridge roadmap. Do not confuse Bridge progress with Pipeline progress.
- old Dell CUDA assumptions: When the codebase is restored, it may still rely on CUDA which is incompatible with the WS target environment (AMD iGPU/Vulkan).
- possible Bridge / unrelated roadmap references: Do not treat Bridge features as Pipeline core completion.
- docs-only claims being mistaken as test PASS: The bridge docs claim `local-markdown-pipeline/backend/scanner.py` exists, but it cannot be verified locally. Do not mark as PASS.
- hardware-dependent evidence being reused incorrectly: Any previous OCR success might have been Dell-specific and cannot be assumed to work on WS.

## 9. Recommended Next Step
PIPE-P5-WS0 — WS Runtime Rebase / Capability Check

## 10. Final Stop
The baseline assessment is complete. The pipeline codebase is missing from the repository. Documentation files have been generated. Halting execution to wait for human confirmation before running PIPE-P5-WS0.
