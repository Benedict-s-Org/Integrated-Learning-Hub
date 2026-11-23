/** PostgREST returns at most 1000 rows unless range-paginated. */
export const POSTGREST_PAGE_SIZE = 1000;

/**
 * Drain a Supabase/PostgREST select with .range() until a short page.
 * Pass a fresh page builder each time so filters stay intact.
 */
export async function fetchAllPagedRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
