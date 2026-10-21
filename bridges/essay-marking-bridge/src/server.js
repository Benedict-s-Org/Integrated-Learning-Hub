import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config, validateConfig } from './config.js';
import { requireTeacherAuth } from './auth.js';
import { validateOcrRequestPayload } from './imageValidator.js';
import { jobManager } from './jobManager.js';
import { recognizeHandwriting } from './mathpixClient.js';
import {
  checkLocalModelHealth,
  checkMarkingModelHealth,
  recognizeIdentityWithLocalVL,
  transcribePageWithLocalVL,
  verifyTranscriptionWithLocalVL,
  markEssayWithLocalVL,
  loadEditableMarkingInstructions,
  FIXED_TRANSCRIPTION_RULES_VERSION,
  FIXED_TRANSCRIPTION_RULES_TEXT,
  FIXED_TRANSCRIPTION_RULES_SUMMARY,
} from './localModelClient.js';

const app = express();

let isVlModelBusy = false;
let isMarkingModelBusy = false;

// 0. Concise structured request logging.
// Invariant: logs ONLY timestamp, request ID, route, mode, and stage.
// NEVER logs image content, credentials, tokens, or student text.
function newRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function logRoute(req, requestId, stage, detail = '') {
  const parts = [
    `ts=${new Date().toISOString()}`,
    `req=${requestId}`,
    `route=${req.method} ${req.path}`,
    `stage=${stage}`,
  ];
  if (detail) parts.push(detail);
  console.log(`[Bridge] ${parts.join(' ')}`);
}

// Assign a request ID to every request; announce the OCR/model-touching routes
// with their functional mode so Mathpix-only attempts can never be confused
// with local VL (18088) attempts.
app.use((req, res, next) => {
  req.requestId = newRequestId();
  const modeByRoute = {
    '/api/ocr': 'mathpix_only (Mathpix, port 18089 -> api.mathpix.com)',
    '/api/transcribe-page': 'local_qwen_vl (port 18088)',
    '/api/verify-transcription': 'mathpix_qwen_verify / verify stage (port 18088)',
    '/api/recognize-identity': 'identity_recognition (port 18088)',
    '/api/mark-essay': 'text_marking (port 18086)',
  };
  if (modeByRoute[req.path]) {
    logRoute(req, req.requestId, 'received', `mode=${modeByRoute[req.path]}`);
  }
  next();
});


// 1. Explicit Allowed-Origin CORS Configuration with Local Loopback & PNA Support
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Loopback non-browser requests, explicitly whitelisted origins, or any local loopback dev origin
      if (
        !origin ||
        config.allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin '${origin}' not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

// 2. Body Parser (with room for base64 expansion)
app.use(express.json({ limit: `${config.maxUploadSizeMb}mb` }));
app.use(express.urlencoded({ limit: `${config.maxUploadSizeMb}mb`, extended: true }));

// 3. Minimal, Non-Sensitive Health Check
// Invariant: Makes ZERO upstream requests. Never discloses secrets or internal tokens.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'essay-marking-bridge',
    port: config.port,
    mathpixConfigured: config.mathpix.isConfigured(),
    dryRun: config.dryRun,
    authConfigured: config.supabase.isConfigured(),
    maxPagesPerRequest: config.maxPagesPerRequest,
    timestamp: new Date().toISOString(),
  });
});

// 4. Honest Service Availability Endpoint (Contract for Learning Hub)
// Checks local bridge status and pings local Qwen3-VL-32B (port 18088) health.
app.get('/api/status', async (_req, res) => {
  const isMathpixConfigured = config.mathpix.isConfigured();
  const isAuthConfigured = config.supabase.isConfigured();

  let ocrStatus = 'not_configured';
  let ocrDetails = 'Bridge running on port 18089. Mathpix credentials are not configured in bridge .env.';

  if (isMathpixConfigured) {
    if (!isAuthConfigured) {
      ocrStatus = 'not_configured';
      ocrDetails = 'Mathpix credentials configured, but Supabase auth verification is not configured in bridge .env (fails closed).';
    } else if (config.dryRun) {
      ocrStatus = 'dry_run_ready';
      ocrDetails = 'Mathpix credentials and Supabase auth verified. DRY_RUN mode active: live billing calls are blocked by safety gate.';
    } else {
      ocrStatus = 'available';
      ocrDetails = 'Bridge connected. Mathpix credentials configured and live OCR enabled.';
    }
  }

  // Check local Qwen3-VL-32B model health on port 18088 (transcription & OCR identity)
  const localModel = await checkLocalModelHealth(config.qwenVlEndpoint);

  // Check local marking model health on port 18086 (AI essay marking)
  const markingModel = await checkMarkingModelHealth(config.markingEndpoint, 2000);

  res.json({
    ocr: {
      status: ocrStatus,
      providerName: 'Mathpix OCR (Local Bridge)',
      details: ocrDetails,
    },
    visualVerification: {
      status: localModel.isOnline ? 'available' : 'error',
      providerName: 'Vision Verification (Qwen3-VL-32B)',
      details: localModel.isOnline
        ? 'Local multimodal vision model active on port 18088. Ready for scan alignment and verification.'
        : localModel.details,
    },
    marking: {
      status: markingModel.isOnline ? 'available' : 'error',
      providerName: `Essay Marking Model (${markingModel.modelId || 'Port ' + markingModel.port})`,
      port: markingModel.port,
      modelId: markingModel.modelId || null,
      checkedAt: markingModel.checkedAt,
      details: markingModel.isOnline
        ? `Local marking model active on port ${markingModel.port} (${markingModel.modelId}). Ready for text marking.`
        : markingModel.details,
    },
    backgroundRunner: {
      status: 'available',
      providerName: `Essay Marking Bridge (Port ${config.port})`,
      details: `Dedicated bridge active on http://${config.host}:${config.port}.`,
    },
    transcription: {
      status: localModel.isOnline ? 'available' : 'error',
      providerName: 'Vision Transcription (Qwen3-VL-32B)',
      fixedRulesVersion: FIXED_TRANSCRIPTION_RULES_VERSION,
      details: localModel.isOnline
        ? `Fixed transcription rules active (${FIXED_TRANSCRIPTION_RULES_VERSION}). Ready for faithful transcription.`
        : localModel.details,
    },
  });
});

// 4b. Dedicated Lightweight Marking Model Status Endpoint (Port 18086)
// Invariant: Does not call generation, does not start/stop model, separate short 3s timeout.
app.get('/api/marking-model-status', async (_req, res) => {
  const result = await checkMarkingModelHealth(config.markingEndpoint, 3000);
  res.json(result);
});

// 4c. Active Fixed Transcription Rules Metadata Endpoint
// Public endpoint for Learning Hub to inspect active fixed transcription rules and version.
app.get('/api/transcription-rules', (_req, res) => {
  res.json({
    status: 'ok',
    version: FIXED_TRANSCRIPTION_RULES_VERSION,
    rulesText: FIXED_TRANSCRIPTION_RULES_TEXT,
    rulesSummary: FIXED_TRANSCRIPTION_RULES_SUMMARY,
  });
});

// 5. Protected OCR Endpoint
// Requires authenticated teacher/admin session, validates all image payloads upfront,
// checks concurrency/deduplication, and executes single-attempt recognition.
app.post('/api/ocr', requireTeacherAuth, async (req, res) => {
  const { studentId, assignmentId, worksheetContext, scopePrompt } = req.body;
  const userId = req.user.id;

  // A. Validate the ENTIRE request payload before any upstream processing
  const validation = validateOcrRequestPayload(req.body, {
    maxPagesPerRequest: config.maxPagesPerRequest,
    maxImageSizeMb: config.maxImageSizeMb,
    maxTotalRequestSizeMb: config.maxTotalRequestSizeMb,
    minDimension: config.minDimension,
    maxDimension: config.maxDimension,
    maxPixels: config.maxPixels,
  });

  if (!validation.isValid) {
    logRoute(req, req.requestId, 'validation_failed', `code=${validation.code}`);
    return res.status(validation.status).json({
      status: 'error',
      code: validation.code,
      message: validation.error,
      requestId: req.requestId,
    });
  }

  // B. Concurrency & Deduplication Fingerprint Guard
  const rawUrls = validation.pages.map((p) => p.dataUri);
  const fingerprint = jobManager.createFingerprint({
    userId,
    studentId,
    assignmentId,
    imageUrls: rawUrls,
  });

  const slot = jobManager.acquire({
    fingerprint,
    userId,
    studentId,
  });

  if (!slot.allowed) {
    // If reused from recent completion, return the cached result cleanly
    if (slot.isCached) {
      logRoute(req, req.requestId, 'dedup_cached_reuse');
      return res.status(200).json(slot.result);
    }
    logRoute(req, req.requestId, 'dedup_rejected', `code=${slot.code} http=${slot.status}`);
    return res.status(slot.status).json({
      status: 'error',
      code: slot.code,
      message: slot.message,
      requestId: req.requestId,
    });
  }

  // C. Execute recognition (single attempt, no auto-retries)
  try {
    logRoute(req, req.requestId, 'mathpix_dispatch', `upstream=api.mathpix.com dryRun=false fp=${fingerprint.slice(0, 8)}`);
    // For initial live test, process the single validated page
    const primaryImage = validation.pages[0].dataUri;

    const result = await recognizeHandwriting({
      imageUrl: primaryImage,
      worksheetContext,
      scopePrompt,
    });

    logRoute(req, req.requestId, 'mathpix_result', `outcome=${result.status} code=${result.code || 'none'}`);

    if (result.status === 'success') {
      jobManager.complete(fingerprint, { outcome: 'success', result });
      return res.json({ ...result, requestId: req.requestId });
    }

    if (result.status === 'dry_run_ready') {
      jobManager.complete(fingerprint, { outcome: 'dry_run', result });
      return res.json({ ...result, requestId: req.requestId });
    }

    // Upstream error or timeout
    const outcome = result.isTimeoutUncertain ? 'timeout_uncertain' : 'error';
    jobManager.complete(fingerprint, { outcome, error: result.message });

    const httpStatus = result.isTimeoutUncertain ? 504 : 502;
    return res.status(httpStatus).json({ ...result, requestId: req.requestId });
  } catch (err) {
    // Surface the actual exception: this catch previously swallowed the error
    // silently, making HTTP 500s undiagnosable from logs.
    console.error(
      `[Bridge OCR Error] ts=${new Date().toISOString()} req=${req.requestId} route=POST /api/ocr stage=exception`,
      err?.stack || err?.message || err
    );
    jobManager.complete(fingerprint, { outcome: 'error', error: err?.message });
    return res.status(500).json({
      status: 'error',
      code: 'BRIDGE_INTERNAL_ERROR',
      message: 'Internal error processing OCR request on bridge.',
      requestId: req.requestId,
    });
  }
});

// 5b. Protected Student Identity Recognition via Local Qwen3-VL (Port 18088)
// Invariants:
// - ONLY calls local Qwen3-VL on port 18088. Zero calls to Mathpix.
// - Mathpix DRY_RUN is not triggered and remains intact.
// - Does NOT require known studentId (identity is what is being recognized).
// - Enforces authenticated teacher/admin session via requireTeacherAuth.
// - Uses serial lock to prevent concurrent GPU overload.
app.post('/api/recognize-identity', requireTeacherAuth, async (req, res) => {
  const { scanPageId, combinedImage, classImage, nameImage, numberImage } = req.body;

  if (!scanPageId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_SCAN_PAGE_ID',
      message: 'scanPageId is required for student identity recognition.',
    });
  }

  const hasImage = Boolean(combinedImage || classImage || nameImage || numberImage);
  if (!hasImage) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_IDENTITY_IMAGES',
      message: 'At least one identity crop image (combinedImage or class/name/number images) is required.',
    });
  }

  const allImages = [combinedImage, classImage, nameImage, numberImage].filter(Boolean);
  for (const img of allImages) {
    if (!img.startsWith('data:image/')) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_IMAGE_DATA_URI',
        message: 'Identity images must be valid data:image/... base64 URIs.',
      });
    }
    // Limit to 10MB per crop
    if (img.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        status: 'error',
        code: 'IMAGE_TOO_LARGE',
        message: 'Identity crop image exceeds 10MB limit.',
      });
    }
  }

  if (isVlModelBusy) {
    return res.status(429).json({
      status: 'error',
      code: 'LOCAL_VL_BUSY',
      message: 'Local Qwen3-VL-32B model is currently processing another page. Please retry shortly.',
    });
  }

  isVlModelBusy = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const result = await recognizeIdentityWithLocalVL({
      combinedImage,
      classImage,
      nameImage,
      numberImage,
      endpoint: config.qwenVlEndpoint,
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.json({
      status: 'success',
      scanPageId,
      ...result,
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    console.error(`[Local VL Error] Page ${scanPageId}:`, err.message);
    return res.status(isTimeout ? 504 : 502).json({
      status: 'error',
      code: isTimeout ? 'VL_RECOGNITION_TIMEOUT' : 'VL_RECOGNITION_FAILED',
      message: isTimeout
        ? 'Local Qwen3-VL recognition timed out after 45 seconds.'
        : `Local Qwen3-VL recognition failed: ${err.message}`,
      scanPageId,
    });
  } finally {
    isVlModelBusy = false;
  }
});

// 5c. Protected Full-Essay Transcription via Local Qwen3-VL (Port 18088)
// Invariants:
// - ONLY calls local Qwen3-VL on port 18088. Zero calls to Mathpix.
// - Enforces authenticated teacher/admin session via requireTeacherAuth.
// - Constrained to exactly ONE page per request (preserves maxPagesPerRequest safety limit).
// - Reuses serial isVlModelBusy guard to prevent concurrent GPU overload.
// - Enforces fixed faithful transcription rules v1.0.
app.post('/api/transcribe-page', requireTeacherAuth, async (req, res) => {
  const { scanPageId, studentId, assignmentId, pageNumber, totalParts, regions, readingOrder, settings } = req.body;

  if (!scanPageId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_SCAN_PAGE_ID',
      message: 'scanPageId is required for page transcription.',
    });
  }

  if (!studentId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_STUDENT_ID',
      message: 'studentId is required for page transcription.',
    });
  }

  // Support both imageUrls array and single imageDataUri
  const rawImageUrls = Array.isArray(req.body.imageUrls)
    ? req.body.imageUrls
    : typeof req.body.imageDataUri === 'string'
    ? [req.body.imageDataUri]
    : [];

  if (rawImageUrls.length === 0) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_IMAGE',
      message: 'Image data URL is required for transcription.',
    });
  }

  // Validate entire single-page image payload using strict image validator
  const validation = validateOcrRequestPayload(
    { imageUrls: rawImageUrls },
    {
      maxPagesPerRequest: 1, // Strictly 1 page per request
      maxImageSizeMb: config.maxImageSizeMb,
      maxTotalRequestSizeMb: config.maxTotalRequestSizeMb,
      minDimension: config.minDimension,
      maxDimension: config.maxDimension,
      maxPixels: config.maxPixels,
    }
  );

  if (!validation.isValid) {
    return res.status(validation.status).json({
      status: 'error',
      code: validation.code,
      message: validation.error,
    });
  }

  // Concurrency Guard: Ensure only one active inference on GPU
  if (isVlModelBusy) {
    return res.status(429).json({
      status: 'error',
      code: 'LOCAL_VL_BUSY',
      message: 'Local Qwen VL model is currently processing another request. Please retry shortly.',
    });
  }

  isVlModelBusy = true;
  const controller = new AbortController();
  const transcriptionTimeout = config.transcriptionTimeoutMs || 180000;
  const timer = setTimeout(() => controller.abort(), transcriptionTimeout);

  try {
    const primaryImageDataUri = validation.pages[0].dataUri;

    const result = await transcribePageWithLocalVL({
      imageDataUri: primaryImageDataUri,
      imageInfo: {
        width: validation.pages[0]?.width,
        height: validation.pages[0]?.height,
      },
      regions: Array.isArray(regions) ? regions : [],
      readingOrder: Array.isArray(readingOrder) ? readingOrder : [],
      settings: settings && typeof settings === 'object' ? settings : {},
      endpoint: config.qwenVlEndpoint,
      signal: controller.signal,
    });

    clearTimeout(timer);

    return res.json({
      status: 'success',
      scanPageId,
      studentId,
      assignmentId: assignmentId || null,
      pageNumber: pageNumber || 1,
      totalParts: totalParts || 1,
      transcript: result.transcript,
      linesWithBboxes: result.linesWithBboxes || [],
      coordinateSystem: {
        type: 'normalized_1000',
        relativeTo: 'page', // 0-1000 integers relative to the full displayed scan page
      },
      provider: 'local_qwen_vl',
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      settingsVersion: settings?.version || 'v1.0',
      hasUnreadable: result.hasUnreadable,
      wordCount: result.wordCount,
      provenance: {
        provider: result.provider,
        modelId: result.modelId,
        timestamp: Date.now(),
        promptVersion: result.promptVersion,
        scanPageId,
        studentId,
      },
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    console.error(`[Local VL Transcription Error] ts=${new Date().toISOString()} req=${req.requestId} route=POST /api/transcribe-page stage=exception Page ${scanPageId}:`, err.message);
    const code = err.code || (isTimeout ? 'VL_TRANSCRIPTION_TIMEOUT' : 'VL_TRANSCRIPTION_FAILED');
    const httpStatus = isTimeout ? 504 : (err.code === 'INVALID_MODEL_OUTPUT_FORMAT' ? 422 : 502);
    return res.status(httpStatus).json({
      status: 'error',
      code,
      message: isTimeout
        ? `Local Qwen VL transcription timed out after ${Math.round(transcriptionTimeout / 1000)} seconds.`
        : `Local Qwen VL transcription failed: ${err.message}`,
      scanPageId,
      studentId,
      requestId: req.requestId,
    });
  } finally {
    isVlModelBusy = false;
  }
});

// 5d. Protected Transcript Verification via Local Qwen3-VL (Port 18088)
// Cross-checks an existing Mathpix transcript against the handwriting image.
// Invariants:
// - ONLY calls local Qwen3-VL on port 18088. Zero calls to Mathpix.
// - Enforces authenticated teacher/admin session via requireTeacherAuth.
// - Constrained to exactly ONE page per request.
// - Reuses serial isVlModelBusy guard to prevent concurrent GPU overload.
// - Strictly verifies transcription accuracy and preserves student writing mistakes.
app.post('/api/verify-transcription', requireTeacherAuth, async (req, res) => {
  const { scanPageId, studentId, pageNumber, imageDataUri, mathpixTranscript, settings } = req.body;

  if (!scanPageId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_SCAN_PAGE_ID',
      message: 'scanPageId is required for transcript verification.',
    });
  }

  if (!imageDataUri || typeof imageDataUri !== 'string' || !imageDataUri.startsWith('data:image/')) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_IMAGE_DATA_URI',
      message: 'A valid data:image/... base64 URI is required for image verification.',
    });
  }

  if (typeof mathpixTranscript !== 'string') {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_MATHPIX_TRANSCRIPT',
      message: 'mathpixTranscript is required for verification.',
    });
  }

  if (isVlModelBusy) {
    return res.status(429).json({
      status: 'error',
      code: 'LOCAL_VL_BUSY',
      message: 'Local Qwen3-VL model is currently processing another request. Please retry shortly.',
    });
  }

  isVlModelBusy = true;
  const timeoutMs = 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await verifyTranscriptionWithLocalVL({
      imageDataUri,
      mathpixTranscript,
      settings,
      endpoint: config.qwenVlEndpoint,
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.json({
      status: 'success',
      scanPageId,
      studentId,
      pageNumber: pageNumber || 1,
      ...result,
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    console.error(`[Local VL Verification Error] Page ${scanPageId}:`, err.message);
    const code = isTimeout ? 'VL_VERIFICATION_TIMEOUT' : 'VL_VERIFICATION_FAILED';
    const httpStatus = isTimeout ? 504 : 502;
    return res.status(httpStatus).json({
      status: 'error',
      code,
      message: isTimeout
        ? `Local Qwen VL verification timed out after ${Math.round(timeoutMs / 1000)} seconds.`
        : `Local Qwen VL verification failed: ${err.message}`,
      scanPageId,
      studentId,
    });
  } finally {
    isVlModelBusy = false;
  }
});

// 5.3.1 Get Editable Marking Prompt Snapshot
// Allows batch queue to capture an immutable prompt snapshot at the start of a batch.
app.get('/api/marking-prompt-snapshot', (_req, res) => {
  try {
    const snapshot = loadEditableMarkingInstructions();
    return res.json({
      status: 'success',
      snapshot,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      code: err.code || 'PROMPT_CONFIGURATION_ERROR',
      message: err.message,
    });
  }
});

// 5d. Protected Essay Marking via Local LLM (Port 18086)
// Invariants:
// - ONLY calls local marking model on port 18086. Zero cloud/external API calls.
// - Enforces authenticated teacher/admin session via requireTeacherAuth.
// - Validates non-empty transcript payload.
// - Independent serial isMarkingModelBusy guard (18088 VL offline does not block 18086 marking).
// - Strict JSON findings validation with exact-location and unreadable filters.
// - Supports 3 distinct feedback types: correction, improvement, clarity.
app.post('/api/mark-essay', requireTeacherAuth, async (req, res) => {
  const {
    transcript,
    studentId,
    assignmentId,
    assignmentTitle,
    scopePrompt,
    rubric,
    promptSnapshot,
  } = req.body || {};

  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_TRANSCRIPT',
      message: 'Non-empty transcript string is required for essay marking.',
    });
  }

  // Concurrency Guard: Ensure only one active inference on marking model
  if (isMarkingModelBusy) {
    return res.status(429).json({
      status: 'error',
      code: 'LOCAL_MODEL_BUSY',
      message: 'Local marking model on port 18086 is currently processing another request. Please retry shortly.',
    });
  }

  isMarkingModelBusy = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.markingTimeoutMs);

  try {
    const result = await markEssayWithLocalVL({
      transcript,
      studentId,
      assignmentTitle,
      scopePrompt,
      rubric,
      promptSnapshot,
      endpoint: config.markingEndpoint,
      signal: controller.signal,
    });

    clearTimeout(timer);

    return res.json({
      status: 'success',
      studentId: studentId || null,
      assignmentId: assignmentId || null,
      findings: result.findings,
      rawFindingsCount: result.rawCount,
      filteredFindingsCount: result.findings.length,
      discardedCount: result.discardedCount,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      schemaVersion: result.schemaVersion,
      wordCount: result.wordCount,
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    console.error(`[Local Model Marking Error] Student ${studentId || 'unknown'}:`, err.message);
    const code = err.code || (isTimeout ? 'MARKING_INFERENCE_TIMEOUT' : 'MARKING_INFERENCE_FAILED');
    const isPromptErr = err.code === 'PROMPT_FILE_MISSING' || err.code === 'PROMPT_FILE_EMPTY';
    const httpStatus = isTimeout ? 504 : isPromptErr ? 500 : (err.code === 'INVALID_MODEL_OUTPUT_FORMAT' ? 422 : 502);
    return res.status(httpStatus).json({
      status: 'error',
      code,
      message: isTimeout
        ? `Local marking inference timed out after ${Math.round(config.markingTimeoutMs / 1000)} seconds.`
        : isPromptErr
        ? err.message
        : `Local marking model failed: ${err.message}`,
      studentId: studentId || null,
    });
  } finally {
    isMarkingModelBusy = false;
  }
});

// 5.5 Local-Only Client Error Logging Endpoints
app.post('/api/client-errors', (req, res) => {
  try {
    const { timestamp, message, stack, currentStep, pageUrl } = req.body || {};
    const errorRecord = {
      timestamp: timestamp || new Date().toISOString(),
      message: String(message || 'Unknown error'),
      stack: String(stack || ''),
      currentStep: currentStep || null,
      pageUrl: pageUrl || null,
    };
    const dataDir = path.resolve('bridges/essay-marking-bridge/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'client-errors.jsonl');
    fs.appendFileSync(filePath, JSON.stringify(errorRecord) + '\n', 'utf8');
    return res.json({ status: 'success', recorded: true });
  } catch (err) {
    console.error('[Client Error Logging Failed]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/client-errors', (_req, res) => {
  try {
    const filePath = path.resolve('bridges/essay-marking-bridge/data/client-errors.jsonl');
    if (!fs.existsSync(filePath)) {
      return res.json({ status: 'success', errors: [] });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const errors = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-50);
    return res.json({ status: 'success', errors });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 6. Sanitized Global Error Handler
app.use((err, req, res, _next) => {
  console.error(
    `[Bridge Error] ts=${new Date().toISOString()} req=${req?.requestId || 'n/a'} route=${req?.method || '?'} ${req?.path || '?'} stage=unhandled http=${err?.status || 500}:`,
    err?.message || err
  );
  res.status(err?.status || 500).json({
    status: 'error',
    code: 'UNHANDLED_EXCEPTION',
    message: err.message || 'Internal bridge server error.',
    requestId: req?.requestId,
  });
});

// 7. Server Bootstrapping
const { isValid, issues, summary } = validateConfig();

if (!isValid) {
  console.error('Configuration validation failed:');
  issues.forEach((issue) => console.error(`  - ${issue}`));
  process.exit(1);
}

let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, config.host, () => {
    console.log('======================================================');
    console.log(` Essay Marking Bridge running at http://${config.host}:${config.port}`);
    console.log('======================================================');
    console.log(` - Mathpix Configured : ${summary.mathpixConfigured ? `YES (ID: ${summary.mathpixMaskedId})` : 'NO'}`);
    console.log(` - Auth Configured    : ${summary.authConfigured ? `YES (${summary.authTarget})` : 'NO (Fails Closed)'}`);
    console.log(` - DRY_RUN Mode       : ${summary.dryRun ? 'ACTIVE (Zero paid API calls)' : 'DISABLED (Live calls enabled)'}`);
    console.log(` - Max Pages / Req    : ${summary.maxPagesPerRequest} (Initial live test limit)`);
    console.log(` - Max Image Size     : ${summary.maxImageSizeMb} MB`);
    console.log(` - Max Total Payload  : ${summary.maxTotalRequestSizeMb} MB`);
    console.log(` - Max Concurrent     : ${summary.maxConcurrentJobs}`);
    console.log(` - Allowed Origins    : ${summary.allowedOrigins.join(', ')}`);
    console.log('======================================================');
  });

  server.on('error', (err) => {
    console.error('[Server Error]', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception]', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]', reason);
  });

  process.on('SIGTERM', () => {
    console.log('[Bridge] Received SIGTERM');
    server?.close();
  });

  process.on('SIGINT', () => {
    console.log('[Bridge] Received SIGINT');
    server?.close();
  });
}

export default app;
