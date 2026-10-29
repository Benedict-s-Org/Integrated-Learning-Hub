import { supabase } from '@/integrations/supabase/client';

type HomeworkResult = { data: unknown; error: { message: string } | null };

interface HomeworkRequest extends Promise<HomeworkResult> {
  select(columns: string): HomeworkRequest;
  eq(column: string, value: string): HomeworkRequest;
  not(column: string, operator: string, value: null): HomeworkRequest;
  in(column: string, values: string[]): HomeworkRequest;
  gte(column: string, value: string): HomeworkRequest;
}

interface HomeworkDb {
  from(table: string): HomeworkRequest;
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: { is_made_up?: boolean } | null; error: { message: string } | null }>;
}

/** Tables used by homework management are not in the generated Database type yet. */
export const homeworkDb = supabase as unknown as HomeworkDb;
