import { describe, expect, it, vi } from 'vitest';
import { fetchAllPagedRows, POSTGREST_PAGE_SIZE } from '@/lib/homework/fetchAllRows';

describe('fetchAllPagedRows', () => {
  it('pages until a short batch so handed-in ticks past the PostgREST cap still load', async () => {
    const page1 = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => ({ id: index + 1 }));
    const page2 = [{ id: POSTGREST_PAGE_SIZE + 1 }, { id: POSTGREST_PAGE_SIZE + 2 }];
    const buildPage = vi.fn(async (from: number, to: number) => {
      if (from === 0) {
        expect(to).toBe(POSTGREST_PAGE_SIZE - 1);
        return { data: page1, error: null };
      }
      if (from === POSTGREST_PAGE_SIZE) {
        return { data: page2, error: null };
      }
      throw new Error(`unexpected range ${from}-${to}`);
    });

    const rows = await fetchAllPagedRows<{ id: number }>(buildPage);
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE + 2);
    expect(rows.at(-1)?.id).toBe(POSTGREST_PAGE_SIZE + 2);
    expect(buildPage).toHaveBeenCalledTimes(2);
  });

  it('surfaces page errors instead of silently truncating', async () => {
    await expect(fetchAllPagedRows(async () => ({
      data: null,
      error: { message: 'boom' },
    }))).rejects.toThrow('boom');
  });
});
