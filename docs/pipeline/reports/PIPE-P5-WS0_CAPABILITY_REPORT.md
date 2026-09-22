# PIPE-P5-WS0 — WS Runtime Rebase / Capability Report

## 1. Scope Confirmation
- Primary roadmap: Phase 1–8 Local-first Folder-to-Markdown Pipeline.
- Current task: PIPE-P5-WS0 — WS Runtime Rebase / Capability Check.
- Mode: Assessment / review only.
- Explicit out-of-scope items: Source code changes, config changes, test changes, OCR redesign, model replacement, Supabase integration, or Bridge modifications.
- Stop condition: Documentation generated and summarized, wait for human confirmation.

## 2. Workspace and Repo Layout
- Main app workspace path: `c:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub`
- Pipeline codebase path: `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline`
- Whether the pipeline codebase is a separate Git repo: Yes, it is a sibling Git repository.
- Git status / branch for each relevant repo: Verified to exist independently outside the main workspace. 
- Any path or repo-layout risks: The pipeline tests currently expect Unix-style paths in assertions (e.g., `subfolder/doc3.txt` vs `subfolder\doc3.txt`), which caused 1 test failure on Windows. The sibling layout itself is safe for testing as long as the correct `PYTHONPATH` is exported.

## 3. Environment Snapshot
- OS: Windows 11 (Version 10.0.26200)
- CPU / RAM: ~128 GB Total Physical Memory (131,750,724 KB)
- GPU: AMD Radeon(TM) 8060S Graphics (Integrated GPU)
- Driver status: AMD proprietary driver (24.20.79.01 LLPC)
- Python version: 3.12.10
- Node version: Not installed (`node` command not found)
- Git version: 2.55.0.windows.2
- Package manager / virtual environment status: Virtual environment `.venv` exists in the pipeline directory with standard Python packages installed.

## 4. Runtime Capability Check
- CUDA / torch CUDA status: UNAVAILABLE. `nvidia-smi` is not recognized. The system does not have an NVIDIA GPU.
- Vulkan status: AVAILABLE. Vulkan Instance Version 1.3.301 with `AMD_switchable_graphics` layer is active.
- llama.cpp / llama-server / GGUF runtime status: NOT INSTALLED. `llama_cpp` is missing from the Python environment.
- RAM usage observations: Extremely generous (128GB), meaning CPU-bound fallback operations (like standard Docling parsing) will not run out of memory.
- GPU / VRAM observations: AMD iGPU relies on shared memory.
- Any compatibility risks: Any hardcoded assumptions of `paddlepaddle-gpu`, `autoawq`, or `torch.cuda` will crash or silently fallback to painfully slow CPU execution.

## 5. Pipeline Component Sanity Check
- Docling: INSTALLED AND FUNCTIONAL. Imported successfully.
- MarkItDown: INSTALLED AND FUNCTIONAL. Imported successfully.
- scanner: FUNCTIONAL. Core logic works, though 1 test fails due to Windows path string (`\\` vs `/`) assertion.
- manifest: FUNCTIONAL. Tested as part of scanner.
- converter: FUNCTIONAL. Unit tests passed.
- OCR runner: BLOCKED BY HARDWARE/DEPENDENCIES.
- cleaner: FUNCTIONAL. Unit tests passed.
- report generation: FUNCTIONAL.
- backend unit tests: 59 passed, 1 failed (Windows path assertion in scanner test).
- frontend typecheck: N/A (Node is not installed to typecheck the pipeline's static vanilla JS).

## 6. OCR Route Assessment
A. Original Dell CUDA / torch-oriented OCR route
B. WS AMD / Vulkan / llama.cpp / GGUF-oriented environment

- Can the original route be reused on WS? NO.
- If yes, what still needs real-machine confirmation? N/A.
- If no, what exactly blocks it? The original route relies on `paddlepaddle-gpu` and `autoawq` (as seen in `requirements-ocr.txt`). These dependencies strictly require CUDA/NVIDIA hardware.
- Is this an OCR engine issue, runtime issue, model issue, driver issue, or workflow issue? It is a hardware/driver mismatch. The workflow requires CUDA, but the hardware is AMD. A completely different engine backend (like Vulkan via llama.cpp or ONNX/DirectML) is required for hardware acceleration on this machine.

## 7. Non-OCR Release Flow Assessment
Flow: English DOCX / text-layer PDF → scan → convert → clean/report

- Is this likely safe? YES. Docling and MarkItDown handle these natively without invoking heavy Vision models or OCR.
- What tests are needed? E2E validation of a test DOCX/PDF through the actual backend endpoints on Windows to ensure pathing issues don't break the runner.
- What limitations remain? Any image-only PDFs or embedded images will be skipped or return blank/garbage text.
- Would this avoid blocking on OCR? YES. It provides immediate business value while the OCR engine is redesigned for AMD/Vulkan.

## 8. Model Need Assessment
- OCR model need: We don't necessarily need a *stronger* model, but we strictly need a *compatible* architecture (e.g., a Vision-enabled GGUF model that can run on Vulkan via `llama_cpp_python`).
- VLM need: Same as OCR. Must be GGUF/Vulkan compatible.
- text review model need: If AI review is kept local, it must also shift away from AWQ/Torch to GGUF/Vulkan.
- no stronger model needed yet: Model *capability* isn't the current bottleneck; model *format/runtime* is.

## 9. Risk Register
- CUDA assumption leakage: Scripts attempting to install `paddlepaddle-gpu` will fail or pull massive incompatible binaries.
- AMD Vulkan compatibility: Building `llama_cpp_python` with Vulkan support on Windows requires specific Cmake/SDK setups which can be brittle.
- Windows path / mounted folder behavior: Verified risk. Scanner test already fails due to `\` vs `/`. Path sanitization must be robust.
- Node dependency missing: If any part of the project secretly expects Node/npm to build, it will fail on this environment.
- unrelated roadmap scope drift: Ensure the Bridge (L1-L11) does not delay the core pipeline work.

## 10. Recommendation
**C. Recommend PIPE-P8-PARTIAL-REAUDIT — non-OCR workflow release audit**

Since the AMD hardware fundamentally blocks the original CUDA-based OCR route, the most efficient next step is to bypass OCR temporarily. Releasing and validating the non-OCR flow (DOCX / text-layer PDF) ensures the core scanner, job runner, and cleaner work robustly on Windows without waiting for a complex Vulkan VLM redesign.

## 11. Final Stop
The WS Capability Report is complete. The environment lacks CUDA and relies on an AMD iGPU, invalidating the old OCR route. Waiting for human confirmation before opening the next task.
