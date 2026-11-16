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

export async function fetchManagedClassIds(
  userId: string,
  accessToken?: string
): Promise<string[]> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data, error } = await supabase.functions.invoke('user-management/get-staff-assignments', {
    headers: {
      Authorization: `Bearer ${accessToken || anonKey}`,
      apikey: anonKey,
    },
    body: { userId },
  });
  if (error) throw error;
  return (data?.assignments as string[]) || [];
}
