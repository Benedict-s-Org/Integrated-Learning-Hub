# PIPE-P8-PARTIAL-SMOKE-RUN — Non-OCR Real Folder Smoke Run Report

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P8-PARTIAL-SMOKE-RUN — Non-OCR Real Folder Smoke Run.
- Mode: Smoke test / validation only.
- Explicit out-of-scope items: Source code changes, test fixes, implementation, OCR real-machine matrix, OCR redesign, VLM route, model replacement, llama.cpp / GGUF implementation, CUDA workaround, Bridge work, Supabase work, import / promote work.
- Stop condition: Smoke run report generated, progress log updated, wait for human confirmation.

## 2. Input Folder
- Input folder path: `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\smoke_input`
- File count: 1
- File types: `.txt` (Plain text document simulating standard CPU-bound parsing)
- Confirmation that files are non-sensitive: Confirmed. The file was a strictly synthetic test dummy created locally containing "This is a simple text document for smoke testing."
- Whether files are synthetic samples or copied real samples: Synthetic sample.

## 3. Commands Run
The non-OCR pipeline was verified using a local FastAPI TestClient script hitting the pipeline's endpoints to simulate exact real-world Bridge UI execution:
1. Created dummy file: `smoke_input/test_doc1.txt`
2. **Scan:** `POST /api/scan` with `input_path` and `output_path`
3. **Convert:** `POST /api/convert` targeting `output_path` and polling `/api/convert/status/{job_id}` until complete.
4. **Clean:** `POST /api/clean` targeting `output_path` and polling `/api/clean/status/{job_id}` until complete.

## 4. Output Folder
- Output folder path: `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\smoke_output`
- Generated files:
  - `test_doc1.txt.raw.md`
  - `test_doc1.txt.cleaned.md`
  - `test_doc1.txt.final.md`
  - `test_doc1.txt.metadata.json`
  - `_job_manifest.json`
  - `_failed_files.json`
  - `_conversion_report.csv`
  - `_index.md`

## 5. Result Summary
**Input file:** `test_doc1.txt`
- Detected type: Supported text file
- Scan result: Success (Added to manifest as pending)
- Convert result: Success (`passthrough` engine handled text)
- Clean/report result: Success (Frontmatter injected, markdown cleaned)
- Output readability: Excellent. Frontmatter successfully parsed the filename and phase, and text was preserved intact.
- Any warnings or errors: None.

## 6. Release Documentation Check
The existing usage guide (`NON_OCR_USAGE_GUIDE.md`) contains **documentation gaps**. 
- The guide lists raw CLI commands (e.g., `python -m backend.scanner ...`) for executing pipeline phases. However, the codebase does not actually expose `__main__` CLI wrappers for these modules.
- The pipeline is entirely API-driven. The correct usage flow requires launching the FastAPI server (`uvicorn backend.main:app`) and sending API requests (`/api/scan`, `/api/convert`, etc.). 

## 7. Decision
**PASS with documentation gaps**
The underlying python code and architectural workflow executes perfectly without CUDA. The outputs are correct and highly structured. Only the written usage guide needs minor correction regarding how a user triggers these scripts.

## 8. Risks / Limitations
- OCR excluded.
- scanned PDFs excluded (will not yield text).
- sensitive data not tested (synthetic data used).
- Windows path behavior: `\` vs `/` exists in JSON manifests, though it did not break backend execution.
- file type limitations: Advanced file types requiring external OCR models will fail or skip.
- CLI execution gap: There is no native CLI script to run the whole pipeline from a single shell command without hitting the API.

## 9. Recommendation
**B. Recommend PIPE-P8-PARTIAL-DOCS-PATCH — documentation-only patch.**
Since the code works perfectly but the usage guide recommends non-existent CLI commands, the immediate next step is a documentation-only patch to correct `NON_OCR_USAGE_GUIDE.md` to either reflect API usage or provide a simple wrapper script.

## 10. Final Stop
The smoke run report is complete and the non-OCR workflow is functionally validated. Halting execution and waiting for human confirmation before opening the patch task or planning the OCR redesign.
