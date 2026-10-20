import {
  EssayMarkingService,
  EssayMarkingRequest,
  EssayMarkingResponse,
} from './essayServiceTypes';
import { supabase } from '@/integrations/supabase/client';

const BRIDGE_BASE_URL = 'http://127.0.0.1:18089';

export class BridgeMarkingService implements EssayMarkingService {
  async mark(request: EssayMarkingRequest): Promise<EssayMarkingResponse> {
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
          message:
            'Authentication required. Please sign in to Learning Hub with an authorized teacher account.',
          code: 'UNAUTHENTICATED',
        };
      }

      if (!request.transcript || !request.transcript.trim()) {
        return {
          status: 'error',
          message: 'Transcript is required for essay marking.',
          code: 'MISSING_TRANSCRIPT',
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 190000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const payload = {
        transcript: request.transcript,
        studentId: request.studentId || null,
        assignmentId: request.assignmentId || null,
        assignmentTitle: request.assignmentTitle || '',
        scopePrompt: request.scopePrompt || '',
        rubric: request.rubric || [],
        promptSnapshot: request.promptSnapshot || null,
      };

      let res: Response;
      try {
        res = await fetch(`${BRIDGE_BASE_URL}/api/mark-essay`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.message || `Bridge returned status HTTP ${res.status}`;
        return {
          status: 'error',
          message: errMsg,
          code: errJson?.code || 'BRIDGE_REQUEST_FAILED',
        };
      }

      const data = await res.json();
      const rawFindings = Array.isArray(data.findings) ? data.findings : [];

      const mappedFindings = rawFindings.map((f: any) => ({
        type: f.type || 'Language',
        feedbackType: f.feedbackType || 'correction',
        originalText: f.quote || '',
        replacementText: f.suggestion || '',
        explanation: f.reason || '',
        paragraphIndex: f.paragraphIndex,
        lineIndex: f.lineIndex,
        occurrenceIndex: f.occurrenceIndex,
        promptVersion: data.promptVersion || f.promptVersion || undefined,
        schemaVersion: data.schemaVersion || f.schemaVersion || '2.0',
      }));

      return {
        status: 'success',
        findings: mappedFindings,
        suggestedScores: {},
        suggestedFeedback: '',
        promptVersion: data.promptVersion,
        schemaVersion: data.schemaVersion,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
      return {
        status: 'error',
        message: isTimeout
          ? 'Essay marking request timed out after 180 seconds.'
          : (err?.message || 'Bridge request failed'),
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }
  }

  async getPromptSnapshot(): Promise<import('./essayServiceTypes').MarkingPromptSnapshot | null> {
    try {
      const res = await fetch(`${BRIDGE_BASE_URL}/api/marking-prompt-snapshot`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.snapshot || null;
    } catch {
      return null;
    }
  }
}
