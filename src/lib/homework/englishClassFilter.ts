import { resolveClassFilter } from '@/constants/classDefaults';

/** Keep All classes, or a class that still exists. Otherwise prefer 4A. */
export function resolveEnglishClassFilter(
  current: string,
  classNames: string[],
): string {
  return resolveClassFilter(current, classNames);
}
