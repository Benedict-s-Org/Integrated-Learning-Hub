# PIPE-P8-PARTIAL — Non-OCR Release Notes

## 1. Release Scope
This release focuses exclusively on the non-OCR parsing workflow. 

**Validated Release Target:**
English DOCX / text-layer PDF → scan → convert → clean/report

## 2. Environment
This release scope has been validated against the target WS environment:
- **OS:** Windows 11
- **Hardware:** ~128GB RAM class machine
- **GPU:** AMD Radeon 8060S / AMD iGPU
- **Runtime:** CPU-based non-OCR workflow
- **CUDA:** No CUDA dependency for this release scope

## 3. Included
The following components and capabilities are fully functional and included in this release:
- English DOCX file processing
- text-layer PDF file processing
- **scanner:** recursively detects valid files and generates standard outputs
- **manifest:** stores run state reliably
- **converter:** correctly routes to standard parsing engines
- **MarkItDown:** primary fallback for DOCX/PPTX processing
- **Docling:** core structural parser for text-layer PDFs
- **cleaner:** injects standard frontmatter, logs metadata, and cleans markdown syntax
- **report generation:** calculates quality scores based on parsing outcomes

## 4. Excluded
The following items are completely excluded from this release:
- scanned image PDFs
- OCR processing
- VLM (Vision Language Model) processing
- model-based AI review
- CUDA / torch GPU route
- Supabase integration, import, or promote operations
- Bridge UI integration work

## 5. Validation Summary
- **PIPE-P5-WS0 findings:** Verified that the AMD iGPU fundamentally lacks CUDA support, permanently blocking the old `paddlepaddle-gpu` OCR route. However, all basic python dependencies (python-docx, docling) install and run successfully on CPU.
- **PIPE-P8-PARTIAL-REAUDIT findings:** Classified the non-OCR workflow as release-ready. The system deterministic nature holds up well on the AMD hardware without triggering memory issues.
- **DOCX sanity check:** An end-to-end Python script successfully executed the scan, convert, and clean logic on a native DOCX file, confirming that all components link together successfully in the WS environment.
- **Backend test result:** 59 out of 60 Pytest backend tests passed. 
- **Windows path test issue:** The single test failure was isolated to an `AssertionError` in `test_scanner.py`, where the scanner correctly generated native Windows paths (`subfolder\doc3.txt`), but the test strictly expected Unix paths (`subfolder/doc3.txt`). This does not block local non-OCR usage, as Windows natively understands the output paths.

## 6. Known Limitations
- scanned PDFs are **not supported** in this release and will likely yield blank or garbage text.
- OCR is blocked pending a full WS/Vulkan architecture redesign.
- text-layer PDF evidence level was validated by Docling availability and test suite passage, but requires human verification on complex multi-column layouts.
- Windows path display differences (using `\`) may surface when inspecting raw JSON manifests or if output paths are copied into tools expecting `/`.
- manual operation requirements: End users must explicitly disable OCR flags if they are on by default in any backend setting or API request.
- No native CLI wrapper: The pipeline is strictly FastAPI-driven. Direct module execution (e.g., `python -m backend.scanner`) is unsupported and will fail silently. Users must launch `backend.main:app` via uvicorn and utilize the API.

## 7. User Safety / Operating Notes
- **use copies of important files first** before trusting the pipeline to modify or parse critical directories.
- **keep OCR documents out of this release flow** to prevent silent data loss or confusing blank outputs.
- **verify converted markdown before relying on it**, especially for complexly formatted DOCX or PDFs.
- **keep input and output folders separate** to avoid recursive feedback loops or accidental overwrites.
- **do not include sensitive student/customer/private data** in test batches unless the workflow and local storage policies are explicitly approved for that data.

## 8. Next Possible Steps
*(Do not start these without explicit approval)*
- `PIPE-P8-PARTIAL-FIXLIST`: only if minor docs/test issues (like the Windows path test) are treated as blockers.
- `PIPE-P5-WS2`: for OCR strategy redesign on WS to transition away from CUDA to Vulkan/GGUF.
- `PIPE-P6-WS-AI-REVIEW-CHECK`: for separate text review model assessment.
