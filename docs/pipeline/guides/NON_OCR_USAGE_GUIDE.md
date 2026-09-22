# Non-OCR Usage Guide

## 1. Purpose
This guide is strictly for processing **English DOCX and text-layer PDF documents only**. It outlines how to safely use the Local-first Folder-to-Markdown Pipeline on the WS AMD environment without relying on the currently blocked OCR/CUDA components.

## 2. Folder Layout
- **Main app workspace path:** `c:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub`
- **Sibling pipeline codebase path:** `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline`
- **Suggested input folder:** `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\input`
- **Suggested output folder:** `c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline\output`

## 3. Before You Run
- **Activate the correct virtual environment:** Ensure you are using the `.venv` inside the `local-markdown-pipeline` directory.
- **Confirm Python environment:** Verify that Python 3.10+ is running (e.g., Python 3.12).
- **Use non-sensitive test files first:** Validate that your layout and configuration are correct before processing real data.
- **Avoid scanned PDFs and image-only PDFs:** These will fail or output empty text without OCR. 

## 4. Basic Workflow

The current non-OCR pipeline is **FastAPI-driven**. There are no direct module CLI commands (e.g., `python -m backend.scanner` is an invalid command). The validated workflow runs entirely through `backend.main`.

**Step A: Start the FastAPI Server**
1. Activate the virtual environment (`.venv\Scripts\activate`).
2. Set the `PYTHONPATH` if needed: `$env:PYTHONPATH="c:\AI\Antigravity\Learning_Hub\local-markdown-pipeline"`
3. Start the server: `uvicorn backend.main:app` *(needs confirmation for exact production flag usage)*

**Step B: Validated API Flow**
Once the server is running, use standard HTTP requests (e.g., cURL, Postman, or the Bridge UI) to trigger the pipeline phases sequentially:

1. **Scan input folder:**
   `POST /api/scan`
   Body: `{"input_path": "c:\\...\\input", "output_path": "c:\\...\\output"}`
2. **Convert scanned files:**
   `POST /api/convert`
   Body: `{"output_path": "c:\\...\\output"}`
3. **Poll convert job status:**
   `GET /api/convert/status/{job_id}`
4. **Clean converted files:**
   `POST /api/clean`
   Body: `{"output_path": "c:\\...\\output"}`
5. **Poll clean job status:**
   `GET /api/clean/status/{job_id}`
6. **Review final markdown and index output:**
   Check your designated `output_path` directory.

## 5. Validated Smoke-Test Method
If you prefer not to manage a running `uvicorn` server for simple local smoke testing, you can use the `FastAPI TestClient`. This method was used during the successful `PIPE-P8-PARTIAL-SMOKE-RUN`.

*(Note: The following is a documentation example only)*
```python
import os, time
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# 1. Scan
res = client.post('/api/scan', json={'input_path': '...', 'output_path': '...'})

# 2. Convert
convert_res = client.post('/api/convert', json={'output_path': '...'})
job_id = convert_res.json()['job_id']
while True:
    time.sleep(1)
    status = client.get(f'/api/convert/status/{job_id}').json()
    if status['status'] in ['completed', 'error', 'failed']: break

# 3. Clean
clean_res = client.post('/api/clean', json={'output_path': '...'})
job_id = clean_res.json()['job_id']
while True:
    time.sleep(1)
    status = client.get(f'/api/clean/status/{job_id}').json()
    if status['status'] in ['completed', 'error', 'failed']: break
```

## 6. Supported File Types
- English DOCX
- text-layer PDF

## 7. Unsupported File Types
- scanned PDFs
- image-only PDFs
- OCR-dependent files (PNGs, JPGs, etc.)
- files requiring VLM/model interpretation (complex charts without text fallback)

## 8. Output Review Checklist
When reviewing the generated `.md` files in the output directory, verify the following:
- **title/frontmatter present:** The standard metadata block should be at the top of the file.
- **markdown readable:** The content should be cleanly formatted and free of strange Unicode corruption.
- **no major extraction loss:** Paragraphs should not be inexplicably missing.
- **tables/images handled as expected or flagged:** Standard text tables should appear as Markdown tables.
- **original file traceable:** The frontmatter should accurately point to the source file path.
- **output path correct:** Ensure the generated file landed in the correct output directory hierarchy.

## 9. Troubleshooting
- **Windows path separator differences:** You may notice `\` instead of `/` in generated JSON manifests. This is expected locally, but may require fixes if exported to cross-platform tools.
- **Missing virtual environment:** If imports fail, ensure you activated `.venv\Scripts\activate` inside the sibling codebase.
- **Missing package:** If `docling` or `markitdown` fails to load, ensure you ran `pip install -r requirements.txt`. (Do NOT install `requirements-ocr.txt`).
- **Scanned PDF accidentally used:** The output will likely be blank. Remove it and process it manually elsewhere.
- **Empty or low-quality extraction:** The PDF might be an image PDF wrapped as a text PDF, or the DOCX may have heavily nested proprietary formatting.
- **Permission/path issues:** Ensure the pipeline has read access to the input folder and write access to the output folder.

## 10. Stop Conditions
**Stop and escalate immediately if:**
- document strictly needs OCR to be readable
- output is empty or badly corrupted across multiple standard files
- private/sensitive data handling policies are unclear for your local machine
- repeated Python conversion failures or exceptions happen
- unknown model/GPU/CUDA dependency suddenly appears during runtime
