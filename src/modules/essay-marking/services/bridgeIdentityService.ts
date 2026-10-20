import { supabase } from '@/integrations/supabase/client';

const BRIDGE_BASE_URL = 'http://127.0.0.1:18089';

export interface IdentityRecognitionRequest {
  scanPageId: string;
  combinedImage?: string;
  classImage?: string;
  nameImage?: string;
  numberImage?: string;
  signal?: AbortSignal;
}

export interface IdentityRecognitionResponse {
  status: 'success' | 'error';
  scanPageId: string;
  rawClass: string | null;
  rawStudentName: string | null;
  rawClassNumber: string | null;
  classReadable: boolean;
  nameReadable: boolean;
  numberReadable: boolean;
  warnings: string[];
  errorMessage?: string;
}

export class BridgeIdentityService {
  async recognizeIdentity(
    request: IdentityRecognitionRequest
  ): Promise<IdentityRecognitionResponse> {
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
          rawClass: null,
          rawStudentName: null,
          rawClassNumber: null,
          classReadable: false,
          nameReadable: false,
          numberReadable: false,
          warnings: ['Authentication required. Please sign in to Learning Hub with an authorized teacher account.'],
          errorMessage: 'Authentication required. Please sign in to Learning Hub.',
        };
      }

      const res = await fetch(`${BRIDGE_BASE_URL}/api/recognize-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scanPageId: request.scanPageId,
          combinedImage: request.combinedImage,
          classImage: request.classImage,
          nameImage: request.nameImage,
          numberImage: request.numberImage,
        }),
        signal: request.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        let errorMsg = data?.message;
        if (res.status === 401) {
          errorMsg = 'Authentication failed: Invalid or expired session.';
        } else if (res.status === 403) {
          errorMsg = 'Access denied: Teacher/admin role required.';
        } else if (res.status === 429) {
          errorMsg = 'Local Qwen3-VL-32B is busy processing another request.';
        } else if (res.status === 502 || res.status === 503) {
          errorMsg = data?.message || 'Local Qwen3-VL (port 18088) is unavailable.';
        } else if (res.status === 504) {
          errorMsg = 'Recognition timed out after 45 seconds.';
        } else if (!errorMsg) {
          errorMsg = `Bridge returned HTTP ${res.status}.`;
        }

        return {
          status: 'error',
          scanPageId: request.scanPageId,
          rawClass: null,
          rawStudentName: null,
          rawClassNumber: null,
          classReadable: false,
          nameReadable: false,
          numberReadable: false,
          warnings: [errorMsg],
          errorMessage: errorMsg,
        };
      }

      return {
        status: 'success',
        scanPageId: data.scanPageId || request.scanPageId,
        rawClass: data.rawClass ?? null,
        rawStudentName: data.rawStudentName ?? null,
        rawClassNumber: data.rawClassNumber !== null && data.rawClassNumber !== undefined ? String(data.rawClassNumber) : null,
        classReadable: Boolean(data.classReadable),
        nameReadable: Boolean(data.nameReadable),
        numberReadable: Boolean(data.numberReadable),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          status: 'error',
          scanPageId: request.scanPageId,
          rawClass: null,
          rawStudentName: null,
          rawClassNumber: null,
          classReadable: false,
          nameReadable: false,
          numberReadable: false,
          warnings: ['Recognition operation cancelled by user.'],
          errorMessage: 'Cancelled',
        };
      }

      const msg = err instanceof Error ? err.message : 'Unknown bridge communication error';
      return {
        status: 'error',
        scanPageId: request.scanPageId,
        rawClass: null,
        rawStudentName: null,
        rawClassNumber: null,
        classReadable: false,
        nameReadable: false,
        numberReadable: false,
        warnings: [msg],
        errorMessage: msg,
      };
    }
  }
}
