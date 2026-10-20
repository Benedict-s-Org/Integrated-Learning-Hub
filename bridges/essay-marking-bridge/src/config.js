import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env explicitly from the bridge directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseAllowedOrigins(val) {
  if (!val) {
    return ['http://localhost:5180', 'http://127.0.0.1:5180'];
  }
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || '18089', 10),
  host: process.env.HOST || '127.0.0.1',
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),

  // Supabase Authentication Configuration
  supabase: {
    url: process.env.SUPABASE_URL?.trim() || '',
    anonKey: process.env.SUPABASE_ANON_KEY?.trim() || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
    isConfigured() {
      return Boolean(this.url && (this.anonKey || this.serviceKey));
    },
    maskedUrl() {
      if (!this.url) return 'not_configured';
      try {
        const u = new URL(this.url);
        return `${u.protocol}//${u.hostname}`;
      } catch {
        return 'invalid_url';
      }
    },
  },

  // Mathpix OCR Configuration
  mathpix: {
    appId: process.env.MATHPIX_APP_ID?.trim() || '',
    appKey: process.env.MATHPIX_APP_KEY?.trim() || '',
    isConfigured() {
      return Boolean(this.appId && this.appKey);
    },
    maskedId() {
      if (!this.appId) return 'not_set';
      if (this.appId.length <= 4) return '***';
      return `${this.appId.slice(0, 2)}...${this.appId.slice(-2)}`;
    },
  },

  // Safety Gate: DRY_RUN mode
  dryRun: process.env.DRY_RUN !== 'false' && process.env.MATHPIX_DRY_RUN !== 'false', // Default true for safety

  // Resource & Request Limits
  // Base64 expands binary size by ~33%, so a 15MB total decoded limit requires a ~25MB JSON body limit
  maxPagesPerRequest: parseInt(process.env.MAX_PAGES_PER_REQUEST || '1', 10),
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '8', 10),
  maxTotalRequestSizeMb: parseInt(process.env.MAX_TOTAL_REQUEST_SIZE_MB || '15', 10),
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25', 10),
  minDimension: 50,
  maxDimension: 8192,
  maxPixels: 32000000, // 32 MP

  // Concurrency & Deduplication
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '1', 10),
  jobRetentionWindowMs: parseInt(process.env.JOB_RETENTION_WINDOW_MS || '300000', 10), // 5 min
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '45000', 10),
  markingTimeoutMs: parseInt(process.env.MARKING_TIMEOUT_MS || '180000', 10), // 3 min timeout for 32B model
  transcriptionTimeoutMs: parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS || process.env.MARKING_TIMEOUT_MS || '180000', 10), // 3 min timeout for 32B model
  markingMaxTokens: parseInt(process.env.MARKING_MAX_TOKENS || '6000', 10),

  qwenVlEndpoint: process.env.QWEN_VL_ENDPOINT || 'http://127.0.0.1:18088',
  markingEndpoint: process.env.MARKING_ENDPOINT || 'http://127.0.0.1:18086',
  bridgeApiKey: process.env.BRIDGE_API_KEY?.trim() || '',
};

/**
 * Validates configuration and produces a non-sensitive summary.
 */
export function validateConfig() {
  const issues = [];

  if (isNaN(config.port) || config.port < 1024 || config.port > 65535) {
    issues.push(`Invalid PORT configured: ${process.env.PORT}`);
  }

  if (isNaN(config.maxPagesPerRequest) || config.maxPagesPerRequest < 1) {
    issues.push(`Invalid MAX_PAGES_PER_REQUEST: ${process.env.MAX_PAGES_PER_REQUEST}`);
  }

  if (isNaN(config.markingMaxTokens) || config.markingMaxTokens < 1000 || config.markingMaxTokens > 32768) {
    issues.push(`Invalid MARKING_MAX_TOKENS: ${process.env.MARKING_MAX_TOKENS} (must be between 1000 and 32768)`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      port: config.port,
      host: config.host,
      mathpixConfigured: config.mathpix.isConfigured(),
      mathpixMaskedId: config.mathpix.maskedId(),
      dryRun: config.dryRun,
      authConfigured: config.supabase.isConfigured(),
      authTarget: config.supabase.maskedUrl(),
      maxPagesPerRequest: config.maxPagesPerRequest,
      maxImageSizeMb: config.maxImageSizeMb,
      maxTotalRequestSizeMb: config.maxTotalRequestSizeMb,
      maxConcurrentJobs: config.maxConcurrentJobs,
      requestTimeoutMs: config.requestTimeoutMs,
      markingTimeoutMs: config.markingTimeoutMs,
      markingMaxTokens: config.markingMaxTokens,
      allowedOrigins: config.allowedOrigins,
    },
  };
}
