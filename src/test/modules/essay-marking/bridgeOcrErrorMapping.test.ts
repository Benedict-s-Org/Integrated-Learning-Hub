import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

import { BridgeOcrService } from '../../../modules/essay-marking/services/bridgeOcrService';

describe('BridgeOcrService preserves bridge error codes for diagnosis', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through bridge error code + requestId on HTTP 500 (no more generic OCR_ERROR)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          status: 'error',
          code: 'BRIDGE_INTERNAL_ERROR',
          message: 'Internal error processing OCR request on bridge.',
          requestId: 'req_abc123',
        }),
      })
    );

    const service = new BridgeOcrService();
    const res = await service.recognize({ imageUrls: ['data:image/png;base64,AAAA'] });

    expect(res.status).toBe('error');
    expect(res.code).toBe('BRIDGE_INTERNAL_ERROR');
    expect((res as any).requestId).toBe('req_abc123');
  });

  it('still reports a plain message when the 500 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      })
    );

    const service = new BridgeOcrService();
    const res = await service.recognize({ imageUrls: ['data:image/png;base64,AAAA'] });

    expect(res.status).toBe('error');
    expect(res.message).toContain('HTTP 500');
    expect(res.code).toBeUndefined();
  });
});
