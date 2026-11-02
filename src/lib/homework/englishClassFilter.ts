/** Keep All classes, or a class that still exists. Drop stale defaults like "3A". */
export function resolveEnglishClassFilter(
  current: string,
  classNames: string[],
): string {
  if (current === 'all') return 'all';
  if (classNames.includes(current)) return current;
  return 'all';
}
