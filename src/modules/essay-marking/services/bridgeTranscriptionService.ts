import {
  EssayTranscriptionService,
  TranscribePageRequest,
  TranscribePageResponse,
  FixedTranscriptionRulesInfo,
  VerifyTranscriptionRequest,
  VerifyTranscriptionResponse,
  OcrPromptSnapshot,
} from './essayServiceTypes';
import { supabase } from '@/integrations/supabase/client';

const BRIDGE_BASE_URL = 'http://127.0.0.1:18089';

async function resolveImageToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:') && typeof window !== 'undefined') {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }
  return url;
}

export class BridgeTranscriptionService implements EssayTranscriptionService {
  async transcribePage(request: TranscribePageRequest): Promise<TranscribePageResponse> {
    try {
      // 1. Retrieve current authenticated user session
      let token = '';
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token || '';
      } catch {
        token = '';
      }

      if (!token) {
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code: 'UNAUTHENTICATED',
          message:
            'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
          error:
            'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
          isRetryable: false,
        };
      }

      // Support both imageUrls array and single imageUrl string
      const rawUrls =
        Array.isArray(request.imageUrls) && request.imageUrls.length > 0
          ? request.imageUrls
          : typeof request.imageUrl === 'string' && request.imageUrl
          ? [request.imageUrl]
          : [];

      if (rawUrls.length === 0) {
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code: 'INVALID_PAYLOAD',
          message: 'No image URL provided for page transcription.',
          error: 'No image URL provided for page transcription.',
          isRetryable: false,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 190000);

      // Resolve client-side blob: URLs into base64 data URIs
      const resolvedUrls = await Promise.all(
        rawUrls.map((u) => resolveImageToDataUrl(u))
      );

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const payload = {
        ...request,
        pageNumber: request.pageNumber ?? request.part ?? 1,
        totalParts: request.totalParts ?? 1,
        regions: request.regions ?? request.writingAreas ?? [],
        imageUrls: resolvedUrls,
      };

      let res: Response;
      try {
        res = await fetch(`${BRIDGE_BASE_URL}/api/transcribe-page`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr instanceof Error && fetchErr.name === 'AbortError';
        const errorMsg = isTimeout
          ? 'Transcription request timed out on client after 190 seconds.'
          : 'Unable to connect to Essay Marking Bridge at http://127.0.0.1:18089. Ensure the bridge service is running.';
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code: isTimeout ? 'CLIENT_TIMEOUT' : 'BRIDGE_UNREACHABLE',
          message: errorMsg,
          error: errorMsg,
          isRetryable: true,
          // Note: httpStatus is left undefined for client/network connection failures per invariant
        };
      }

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.status === 'error') {
        let msg = data?.message;
        let code = data?.code || `HTTP_${res.status}`;
        let isRetryable = true;

        if (res.status === 401) {
          code = data?.code || 'UNAUTHENTICATED';
          msg = 'Authentication failed: Invalid or expired session. Please sign in again.';
          isRetryable = false;
        } else if (res.status === 403) {
          code = data?.code || 'FORBIDDEN';
          msg = 'Access denied: Essay transcription requires teacher or administrator privileges.';
          isRetryable = false;
        } else if (res.status === 400) {
          code = data?.code || 'INVALID_REQUEST';
          msg = data?.message || 'Invalid page request sent to transcription service.';
          isRetryable = false;
        } else if (res.status === 429) {
          code = data?.code || 'LOCAL_VL_BUSY';
          msg = data?.message || 'Local Qwen VL is currently processing another page. Please wait.';
          isRetryable = true;
          return {
            status: 'busy',
            scanPageId: request.scanPageId,
            studentId: request.studentId,
            code,
            message: msg,
            error: msg,
            httpStatus: res.status,
            isRetryable,
          };
        } else if (res.status === 504) {
          code = data?.code || 'LOCAL_MODEL_TIMEOUT';
          msg = data?.message || 'The local model did not respond within the configured timeout.';
          isRetryable = true;
        } else if (!msg) {
          msg = `Bridge returned HTTP ${res.status}. Check bridge console on port 18089.`;
        }

        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code,
          message: msg,
          error: msg,
          httpStatus: res.status,
          isRetryable,
          requestId: data?.requestId,
        };
      }

      return {
        ...data,
        httpStatus: res.status,
      } as TranscribePageResponse;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Transcription failed with an unexpected client error.';
      return {
        status: 'error',
        scanPageId: request?.scanPageId || 'unknown',
        studentId: request?.studentId || 'unknown',
        code: 'CLIENT_ERROR',
        message: errorMsg,
        error: errorMsg,
        isRetryable: true,
      };
    }
  }

  async verifyTranscription(request: VerifyTranscriptionRequest): Promise<VerifyTranscriptionResponse> {
    try {
      let token = '';
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token || '';
      } catch {
        token = '';
      }

      if (!token) {
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
          error: 'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
        };
      }

      const resolvedImageDataUri = await resolveImageToDataUrl(request.imageDataUri);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 65000);

      const res = await fetch(`${BRIDGE_BASE_URL}/api/verify-transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          pageNumber: request.pageNumber || 1,
          imageDataUri: resolvedImageDataUri,
          mathpixTranscript: request.mathpixTranscript,
          settings: request.settings,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          studentId: request.studentId,
          code: data?.code || `HTTP_${res.status}`,
          message: data?.message || `Verification returned HTTP ${res.status}`,
          error: data?.message || `Verification returned HTTP ${res.status}`,
        };
      }

      return data as VerifyTranscriptionResponse;
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout
        ? 'Qwen VL verification timed out after 65 seconds.'
        : err?.message || 'Failed to connect to verification bridge on port 18089.';
      return {
        status: 'error',
        scanPageId: request.scanPageId,
        studentId: request.studentId,
        code: isTimeout ? 'VL_VERIFICATION_TIMEOUT' : 'NETWORK_ERROR',
        message: msg,
        error: msg,
      };
    }
  }

  async getActiveRules(): Promise<FixedTranscriptionRulesInfo | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${BRIDGE_BASE_URL}/api/transcription-rules`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.version === 'string') {
          return {
            version: data.version,
            rulesSummary: Array.isArray(data.rulesSummary) ? data.rulesSummary : [],
            rulesText: data.rulesText,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async getOcrPromptSnapshot(): Promise<OcrPromptSnapshot> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${BRIDGE_BASE_URL}/api/ocr-prompt`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.status === 'error') {
        const err = new Error(data?.message || `Failed to load OCR prompt (HTTP ${res.status}).`);
        (err as any).code = data?.code || 'PROMPT_ERROR';
        throw err;
      }

      return {
        promptHash: data.promptHash,
        promptVersion: data.promptVersion,
        promptText: data.promptText,
        filePath: data.filePath,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) throw err;
      throw new Error('Failed to load OCR prompt snapshot from bridge.');
    }
  }
}

