# Dedicated Essay Marking Bridge

A lightweight, isolated local bridge for the Learning Hub Essay Marking Workbench.
It securely orchestrates Mathpix OCR (for handwritten student essay transcription) and future local vision/rubric models (Qwen3-VL on port 18088), ensuring Third-Party API credentials never touch the frontend browser bundle.

---

## Architecture

```text
Learning Hub (Vite Frontend :5180)
        │
        ▼ (Local CORS Whitelisted HTTP)
Essay Marking Bridge (Port 18089)
        │
        ├──► Mathpix OCR API (https://api.mathpix.com/v3/text)
        └──► [Future] Local Qwen3-VL Server (http://127.0.0.1:18088)
```

---

## Port Allocation
- **Port 18089** (`http://127.0.0.1:18089`)
- Chosen to sit alongside workstation AI runners (`18087` background runner, `18088` Qwen3-VL).

---

## Quick Setup Instructions

### 1. Install Dependencies
In PowerShell or terminal:
```powershell
cd c:\AI\Antigravity\Learning_Hub\Integrated-Learning-Hub\bridges\essay-marking-bridge
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` in this directory:
```powershell
cp .env.example .env
```
Open `.env` and fill in your Mathpix credentials:
```env
PORT=18089
HOST=127.0.0.1
ALLOWED_ORIGINS=http://localhost:5180,http://127.0.0.1:5180

# Your Mathpix credentials
MATHPIX_APP_ID=your_mathpix_app_id_here
MATHPIX_APP_KEY=your_mathpix_app_key_here

# Safety guard: keep 'true' until ready to test paid API requests
DRY_RUN=true
```

### 3. Start the Bridge Service
```powershell
npm start
```
Or for auto-reloading during development:
```powershell
npm run dev
```

### 4. Verify Bridge Status
- Health check: `curl http://127.0.0.1:18089/health`
- Service availability: `curl http://127.0.0.1:18089/api/status`

---

## Security Features
1. **Zero Frontend Credential Exposure**: `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` exist only on this local bridge process. They are never exported or prefixed with `VITE_`.
2. **CORS Isolation**: Only requests from `http://localhost:5180` and `http://127.0.0.1:5180` are accepted.
3. **DRY_RUN Safety Gate**: Default `DRY_RUN=true` ensures no paid billing calls hit Mathpix during setup or UI validation.
4. **Sanitized Error Output**: Upstream errors are scrubbed so API keys and internal stack traces are never sent back to the browser.
5. **Git Ignored**: `.env` is protected by both bridge-level `.gitignore` and Learning Hub repository-level `.gitignore`.
