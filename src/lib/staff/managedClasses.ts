import { supabase } from '@/integrations/supabase/client';

export function isClassManaged(
  className: string,
  managed: string[] | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (!managed) return false;
  return managed.includes(className);
}

export function filterToManagedClasses<T extends { name: string }>(
  items: T[],
  managed: string[] | null,
  isAdmin: boolean
): T[] {
  if (isAdmin) return items;
  if (!managed || managed.length === 0) return [];
  const set = new Set(managed);
  return items.filter((item) => set.has(item.name));
}

export function filterClassNameList(
  classNames: string[],
  managed: string[] | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return classNames;
  if (!managed || managed.length === 0) return [];
  const set = new Set(managed);
  return classNames.filter((name) => set.has(name));
}

/** Prefer assignment rows; if none, fall back to the staff user's own class field. */
export function resolveManagedClassIds(
  assigned: string[],
  fallbackClassName?: string | null,
): string[] {
  const unique = [...new Set(assigned.map((name) => name.trim()).filter(Boolean))];
  if (unique.length > 0) return unique;
  const fallback = (fallbackClassName || '').trim();
  return fallback ? [fallback] : [];
}

async function fetchAssignmentsFromTable(userId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('class_staff_assignments')
    .select('class_id')
    .eq('staff_user_id', userId)
    .eq('is_active', true);
  if (error) throw error;
  return ((data || []) as { class_id?: string | null }[])
    .map((row) => (row.class_id || '').trim())
    .filter(Boolean);
}

async function fetchAssignmentsFromEdge(userId: string, accessToken?: string): Promise<string[]> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data, error } = await supabase.functions.invoke('user-management/get-staff-assignments', {
    headers: {
      Authorization: `Bearer ${accessToken || anonKey}`,
      apikey: anonKey,
    },
    body: { userId },
  });
  if (error) throw error;
  return ((data?.assignments as string[]) || [])
    .map((name) => (name || '').trim())
    .filter(Boolean);
}

export async function fetchManagedClassIds(
  userId: string,
  accessToken?: string,
  fallbackClassName?: string | null,
): Promise<string[]> {
  let assigned: string[] = [];

  try {
    assigned = await fetchAssignmentsFromTable(userId);
  } catch (tableError) {
    console.warn('Failed to read class_staff_assignments directly; trying edge function.', tableError);
  }

  if (assigned.length === 0) {
    try {
      assigned = await fetchAssignmentsFromEdge(userId, accessToken);
    } catch (edgeError) {
      console.error('Failed to load managed classes from edge function:', edgeError);
    }
  }

  return resolveManagedClassIds(assigned, fallbackClassName);
}
