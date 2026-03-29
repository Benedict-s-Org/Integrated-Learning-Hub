// ============================================================
// Handwriting Assessment System — Centralized Error Handler
// ============================================================
// Pure TypeScript. No React. No external dependencies.
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type AssessmentErrorCode =
  | "CAMERA_PERMISSION_DENIED"
  | "MEDIAPIPE_LOAD_FAILED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_PARSE_FAILED"
  | "SUPABASE_SAVE_FAILED"
  | "SUPABASE_UPLOAD_FAILED"
  | "SESSION_NOT_FOUND"
  | "PRESSURE_DATA_MISSING"
  | "UNKNOWN_ERROR";

export type AssessmentError = {
  code: AssessmentErrorCode;
  englishMessage: string;
  chineseMessage: string;
  /** true = show retry button; false = show restart button */
  recoverable: boolean;
  technicalDetail?: string;
};

// ─── Error Message Registry ───────────────────────────────────

type ErrorDefinition = Omit<AssessmentError, "code" | "technicalDetail">;

const ERROR_DEFINITIONS: Record<AssessmentErrorCode, ErrorDefinition> = {
  CAMERA_PERMISSION_DENIED: {
    englishMessage:
      "Camera access denied. Please allow camera permission in Settings.",
    chineseMessage: "相機存取被拒絕，請在設定中允許相機權限。",
    recoverable: false,
  },
  MEDIAPIPE_LOAD_FAILED: {
    englishMessage:
      "Failed to load hand tracking. Check your internet connection.",
    chineseMessage: "手部追蹤載入失敗，請檢查網絡連線。",
    recoverable: true,
  },
  GEMINI_TIMEOUT: {
    englishMessage: "AI analysis timed out. Please try again.",
    chineseMessage: "AI 分析逾時，請再試一次。",
    recoverable: true,
  },
  GEMINI_PARSE_FAILED: {
    englishMessage: "AI returned unexpected data. Please retry.",
    chineseMessage: "AI 返回異常數據，請重試。",
    recoverable: true,
  },
  SUPABASE_SAVE_FAILED: {
    englishMessage: "Failed to save assessment. Please retry.",
    chineseMessage: "評估儲存失敗，請重試。",
    recoverable: true,
  },
  SUPABASE_UPLOAD_FAILED: {
    englishMessage: "Failed to upload snapshot. Please retry.",
    chineseMessage: "快照上傳失敗，請重試。",
    recoverable: true,
  },
  SESSION_NOT_FOUND: {
    englishMessage:
      "Session not found. Please check the session code.",
    chineseMessage: "找不到此評估Session，請確認代碼。",
    recoverable: false,
  },
  PRESSURE_DATA_MISSING: {
    englishMessage:
      "No pressure data recorded. Please write on the canvas first.",
    chineseMessage: "未有壓力數據，請先在畫布上書寫。",
    recoverable: true,
  },
  UNKNOWN_ERROR: {
    englishMessage: "An unexpected error occurred. Please restart.",
    chineseMessage: "發生未預期錯誤，請重新開始。",
    recoverable: false,
  },
};

// ─── Factory Function ─────────────────────────────────────────

/**
 * Creates a structured AssessmentError from a known error code.
 *
 * @param code - The standardized error code for this failure mode.
 * @param technicalDetail - Optional raw error message for logging/debugging.
 * @returns A fully populated AssessmentError object.
 */
export function createError(
  code: AssessmentErrorCode,
  technicalDetail?: string
): AssessmentError {
  const definition = ERROR_DEFINITIONS[code];
  return {
    code,
    englishMessage: definition.englishMessage,
    chineseMessage: definition.chineseMessage,
    recoverable: definition.recoverable,
    ...(technicalDetail !== undefined ? { technicalDetail } : {}),
  };
}
