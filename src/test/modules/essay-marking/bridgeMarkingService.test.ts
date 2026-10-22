import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeMarkingService } from '@/modules/essay-marking/services/bridgeMarkingService';
import { supabase } from '@/integrations/supabase/client';

describe('BridgeMarkingService Tests', () => {
  let service: BridgeMarkingService;

  beforeEach(() => {
    service = new BridgeMarkingService();
    vi.restoreAllMocks();
  });

  it('fails closed when user session has no access token', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const result = await service.mark({
      transcript: 'Some student essay text',
      assignmentTitle: 'My Hero',
      scopePrompt: 'Write about a hero',
      rubric: [],
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('Authentication required');
      expect(result.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects empty transcript upfront without network request', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null,
    });

    const result = await service.mark({
      transcript: '   ',
      assignmentTitle: 'My Hero',
      scopePrompt: 'Write about a hero',
      rubric: [],
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('Transcript is required');
      expect(result.code).toBe('MISSING_TRANSCRIPT');
    }
  });

  it('successfully maps bridge findings into frontend MarkingFinding structure', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null,
    });

    const mockBridgeResponse = {
      status: 'success',
      findings: [
        {
          type: 'Spelling',
          quote: 'sily',
          suggestion: 'silly',
          reason: 'Misspelling of silly',
          paragraphIndex: 0,
          lineIndex: 2,
          occurrenceIndex: 0,
        },
        {
          type: 'Grammar',
          quote: 'He have',
          suggestion: 'He has',
          reason: 'Subject-verb agreement',
          paragraphIndex: 0,
          lineIndex: 3,
          occurrenceIndex: 0,
        },
      ],
      rawFindingsCount: 2,
      filteredFindingsCount: 2,
      discardedCount: 0,
      modelId: 'qwen3-vl-32b',
      wordCount: 45,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBridgeResponse,
    } as any);

    const result = await service.mark({
      transcript: 'He is kind.\nHe is messy.\nHe is a sily dog.\nHe have friends.',
      studentId: 'abby-1',
      assignmentTitle: 'Character Profile',
      scopePrompt: 'Write about a character',
      rubric: [],
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0]).toEqual({
        type: 'Spelling',
        feedbackType: 'correction',
        originalText: 'sily',
        replacementText: 'silly',
        explanation: 'Misspelling of silly',
        paragraphIndex: 0,
        lineIndex: 2,
        occurrenceIndex: 0,
        promptVersion: undefined,
        schemaVersion: '2.0',
      });
      expect(result.findings[1]).toMatchObject({
        type: 'Grammar',
        feedbackType: 'correction',
        originalText: 'have',
        replacementText: 'has',
        explanation: 'Subject-verb agreement',
        paragraphIndex: 0,
        lineIndex: 3,
        occurrenceIndex: 0,
      });
      // Invariant: Phase 2 does not generate AI rubric scores
      expect(result.suggestedScores).toEqual({});
    }
  });

  it('maps optional improvement and clarity suggestions with promptVersion', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null,
    });

    const mockBridgeResponse = {
      status: 'success',
      findings: [
        {
          type: 'Vocabulary',
          feedbackType: 'improvement',
          quote: 'big dog',
          suggestion: 'gigantic canine',
          reason: 'More descriptive vocabulary choice',
          paragraphIndex: 0,
          lineIndex: 0,
          occurrenceIndex: 0,
          promptVersion: 'v2.0-abc12345',
          schemaVersion: '2.0',
        },
        {
          type: 'Coherence',
          feedbackType: 'clarity',
          quote: 'he',
          suggestion: 'Clarification needed',
          reason: 'Unclear pronoun reference; it is not stated who he refers to.',
          paragraphIndex: 0,
          lineIndex: 1,
          occurrenceIndex: 0,
          promptVersion: 'v2.0-abc12345',
          schemaVersion: '2.0',
        },
      ],
      promptVersion: 'v2.0-abc12345',
      schemaVersion: '2.0',
      rawFindingsCount: 2,
      filteredFindingsCount: 2,
      discardedCount: 0,
      modelId: 'qwen3-vl-32b',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBridgeResponse,
    } as any);

    const result = await service.mark({
      transcript: 'A big dog arrived.\nhe barked.',
      studentId: 'abby-1',
      assignmentTitle: 'Story',
      scopePrompt: 'Write a story',
      rubric: [],
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].feedbackType).toBe('improvement');
      expect(result.findings[0].promptVersion).toBe('v2.0-abc12345');
      expect(result.findings[1].feedbackType).toBe('clarity');
      expect(result.findings[1].replacementText).toBe('Clarification needed');
      expect(result.promptVersion).toBe('v2.0-abc12345');
      expect(result.schemaVersion).toBe('2.0');
    }
  });

  it('fetches prompt snapshot for batch immutability', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null,
    });

    const mockSnapshot = {
      promptText: '# Marking Instructions\nRules...',
      promptHash: 'abcde1234567890',
      promptVersion: 'v2.0-abcde123',
      schemaVersion: '2.0',
      loadedAt: '2026-10-19T12:00:00.000Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', snapshot: mockSnapshot }),
    } as any);

    const snapshot = await service.getPromptSnapshot();
    expect(snapshot).toEqual(mockSnapshot);
  });

  it('handles bridge error response without silent failure', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        status: 'error',
        code: 'INVALID_MODEL_OUTPUT_FORMAT',
        message: 'Model output was not valid JSON findings format',
      }),
    } as any);

    const result = await service.mark({
      transcript: 'Some student essay text',
      assignmentTitle: 'My Hero',
      scopePrompt: 'Write about a hero',
      rubric: [],
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_MODEL_OUTPUT_FORMAT');
      expect(result.message).toContain('Model output was not valid JSON findings format');
    }
  });
});
