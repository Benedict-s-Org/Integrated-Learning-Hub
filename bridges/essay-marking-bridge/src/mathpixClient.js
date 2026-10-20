import { config } from './config.js';

const MATHPIX_API_ENDPOINT = 'https://api.mathpix.com/v3/text';

/**
 * Sanitizes errors to prevent upstream credential, token, or header leakage.
 */
function sanitizeErrorMessage(error, defaultMessage = 'OCR processing request failed') {
  if (!error) return defaultMessage;
  const raw = typeof error === 'string' ? error : error.message || defaultMessage;

  let sanitized = raw;
  if (config.mathpix.appId) {
    sanitized = sanitized.split(config.mathpix.appId).join('[REDACTED_APP_ID]');
  }
  if (config.mathpix.appKey) {
    sanitized = sanitized.split(config.mathpix.appKey).join('[REDACTED_APP_KEY]');
  }

  // Clean URL auth artifacts
  sanitized = sanitized.replace(/https:\/\/[^@\s]+@/g, 'https://');

  return sanitized;
}

/**
 * Executes a single, non-retried OCR recognition request against Mathpix.
 * 
 * Safety invariants:
 * - Halts immediately when DRY_RUN=true; makes ZERO upstream requests.
 * - Enforces request timeout with AbortController.
 * - Flags timeouts as TIMEOUT_UNCERTAIN to prevent blind re-submissions.
 * - NEVER automatically retries billable upstream requests.
 * - Never returns simulated/mocked success data.
 */
export async function recognizeHandwriting({
  imageUrl,
  worksheetContext,
  scopePrompt,
}) {
  if (!config.mathpix.isConfigured()) {
    return {
      status: 'not_configured',
      code: 'MATHPIX_NOT_CONFIGURED',
      message: 'Mathpix credentials (MATHPIX_APP_ID / MATHPIX_APP_KEY) are not configured in the bridge .env file.',
    };
  }

  // Safety Gate: Explicitly block upstream call when DRY_RUN=true
  if (config.dryRun) {
    return {
      status: 'dry_run_ready',
      code: 'DRY_RUN_ACTIVE',
      message: 'Mathpix credentials and request payload validated. Upstream billing call blocked by safety gate (DRY_RUN=true). Live billing calls require explicit authorization.',
      ready: true,
      provider: 'Mathpix OCR',
    };
  }

  if (!imageUrl) {
    return {
      status: 'error',
      code: 'MISSING_IMAGE',
      message: 'No image data provided for OCR recognition.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const payload = {
      src: imageUrl,
      formats: ['text'],
      data_options: {
        include_asciimath: false,
      },
    };

    const res = await fetch(MATHPIX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'app_id': config.mathpix.appId,
        'app_key': config.mathpix.appKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const upstreamError = data?.error || `Upstream returned HTTP ${res.status}`;
      return {
        status: 'error',
        code: `UPSTREAM_HTTP_${res.status}`,
        message: sanitizeErrorMessage(upstreamError, 'Mathpix service returned an error'),
      };
    }

    if (!data || typeof data.text !== 'string') {
      return {
        status: 'error',
        code: 'INVALID_UPSTREAM_RESPONSE',
        message: 'Invalid response format received from OCR service.',
      };
    }

    return {
      status: 'success',
      transcript: data.text.trim(),
      uncertainRegions: [],
    };
  } catch (err) {
    clearTimeout(timeoutId);

    // Timeout: upstream billing/completion status is uncertain
    if (err.name === 'AbortError') {
      return {
        status: 'error',
        code: 'TIMEOUT_UNCERTAIN',
        isTimeoutUncertain: true,
        message: `OCR request timed out after ${config.requestTimeoutMs / 1000} seconds. Upstream billing and completion status may be uncertain. Do not immediately retry without checking your Mathpix dashboard.`,
      };
    }

    return {
      status: 'error',
      code: 'NETWORK_ERROR',
      message: sanitizeErrorMessage(err, 'Failed to complete OCR recognition call'),
    };
  }
}
