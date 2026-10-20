import {
  EssayOcrService,
  ServiceAvailabilityService,
  OcrRequest,
  OcrResponse,
  ServiceAvailabilityStatus,
  MarkingModelHealthStatus,
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

export class BridgeOcrService implements EssayOcrService {
  async recognize(request: OcrRequest): Promise<OcrResponse> {
    try {
      // 1. Retrieve current authenticated user session
      let token = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
      } catch {
        token = '';
      }

      if (!token) {
        return {
          status: 'error',
          message: 'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      // Resolve client-side blob: URLs into base64 data URIs
      const resolvedUrls = await Promise.all(
        request.imageUrls.map((u) => resolveImageToDataUrl(u))
      );

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const res = await fetch(`${BRIDGE_BASE_URL}/api/ocr`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...request,
          imageUrls: resolvedUrls,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        let msg = data?.message;
        if (res.status === 401) {
          msg = 'Authentication failed: Invalid or expired session. Please sign in again.';
        } else if (res.status === 403) {
          msg = 'Access denied: Essay marking OCR requires teacher or administrator privileges.';
        } else if (res.status === 409) {
          msg = data?.message || 'Duplicate OCR submission prevented.';
        } else if (res.status === 429) {
          msg = data?.message || 'Bridge is currently busy processing another OCR request. Please wait.';
        } else if (res.status === 503) {
          msg = data?.message || 'Bridge authentication configuration is unavailable (fails closed).';
        } else if (res.status === 504) {
          msg = data?.message || 'OCR request timed out. Billing state may be uncertain.';
        } else if (!msg) {
          msg = `Bridge returned HTTP ${res.status}. Check bridge console on port 18089.`;
        }

        return {
          status: 'error',
          message: msg,
        };
      }

      if (data.status === 'dry_run_ready') {
        return {
          status: 'dry_run_ready',
          message: data.message,
          code: data.code,
          ready: data.ready,
          provider: data.provider,
        };
      }

      return data as OcrResponse;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error && err.name === 'AbortError'
          ? 'OCR recognition request timed out after 45 seconds.'
          : 'Unable to connect to Essay Marking Bridge at http://127.0.0.1:18089. Ensure the bridge service is started.';
      return {
        status: 'error',
        message: errorMsg,
      };
    }
  }
}

export class BridgeAvailabilityService implements ServiceAvailabilityService {
  async checkStatus(): Promise<ServiceAvailabilityStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${BRIDGE_BASE_URL}/api/status`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as ServiceAvailabilityStatus;
        return data;
      }

      return this.offlineStatus(
        `Bridge replied with HTTP ${res.status}. Check service health on port 18089.`
      );
    } catch {
      return this.offlineStatus(
        'Bridge service unreachable at http://127.0.0.1:18089. Please ensure the bridge is running (npm start in bridges/essay-marking-bridge).'
      );
    }
  }

  private offlineStatus(reason: string): ServiceAvailabilityStatus {
    return {
      ocr: {
        status: 'error',
        providerName: 'Mathpix OCR (Local Bridge)',
        details: reason,
      },
      visualVerification: {
        status: 'not_configured',
        providerName: 'Vision Verification (Qwen3-VL)',
        details: 'Visual verification service host is not connected.',
      },
      marking: {
        status: 'not_configured',
        providerName: 'Essay Marking Model (32B)',
        details: 'Local/remote model endpoint is not configured.',
      },
      backgroundRunner: {
        status: 'error',
        providerName: 'Essay Marking Bridge (Port 18089)',
        details: reason,
      },
    };
  }

  async checkMarkingModelStatus(): Promise<MarkingModelHealthStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${BRIDGE_BASE_URL}/api/marking-model-status`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status === 'ready' ? 'ready' : 'unavailable',
          port: data.port || 18086,
          modelId: data.modelId,
          checkedAt: data.checkedAt || new Date().toISOString(),
          details: data.details,
        };
      }

      return {
        status: 'unavailable',
        port: 18086,
        checkedAt: new Date().toISOString(),
        details: `Bridge returned HTTP ${res.status}`,
      };
    } catch {
      return {
        status: 'bridge_unreachable',
        port: 18086,
        checkedAt: new Date().toISOString(),
        details: '18089 無法連線 (Bridge unreachable)',
      };
    }
  }
}
