import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

import {
  manageClassDashLink,
  validateClassDashLink,
} from '@/services/classDashLinkService';

describe('classDashLinkService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('validateClassDashLink returns target_class on success', async () => {
    invokeMock.mockResolvedValue({
      data: { target_class: '3A', valid_until: '2026-10-28T07:30:00.000Z' },
      error: null,
    });
    const result = await validateClassDashLink('abc');
    expect(invokeMock).toHaveBeenCalledWith('class-dash', {
      body: { op: 'validate', token: 'abc' },
    });
    expect(result.target_class).toBe('3A');
  });

  it('validateClassDashLink maps error codes', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'outside_hours' },
      error: null,
    });
    await expect(validateClassDashLink('abc')).rejects.toMatchObject({
      code: 'outside_hours',
    });
  });

  it('manageClassDashLink passes admin manage body', async () => {
    invokeMock.mockResolvedValue({
      data: { link: { token: 'tok', target_class: '3A', is_active: true } },
      error: null,
    });
    const result = await manageClassDashLink('generate', '3A');
    expect(invokeMock).toHaveBeenCalledWith('class-dash', {
      body: { op: 'manage', action: 'generate', target_class: '3A' },
    });
    expect(result.link?.token).toBe('tok');
  });
});
