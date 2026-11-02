/** Preferred class when a page first loads a class filter or dashboard. */
export const PREFERRED_DEFAULT_CLASS = '4A';

/** Prefer 4A when it exists; otherwise the first listed class. */
export function pickDefaultClass(
  classes: string[],
  preferred: string = PREFERRED_DEFAULT_CLASS,
): string {
  if (classes.includes(preferred)) return preferred;
  return classes[0] || preferred;
}

/**
 * Keep an explicit All-classes choice, or a class that still exists.
 * Otherwise fall back to the preferred default class.
 */
export function resolveClassFilter(
  current: string,
  classNames: string[],
  preferred: string = PREFERRED_DEFAULT_CLASS,
): string {
  if (current === 'all') return 'all';
  if (classNames.includes(current)) return current;
  return pickDefaultClass(classNames, preferred);
}
