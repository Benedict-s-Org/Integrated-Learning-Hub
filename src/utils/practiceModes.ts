export type PracticeMode = 'memorization' | 'shuffledGame' | 'dictation';

export const PRACTICE_MODE_ORDER: PracticeMode[] = ['memorization', 'shuffledGame', 'dictation'];

export const isPracticeMode = (value: string): value is PracticeMode =>
  PRACTICE_MODE_ORDER.includes(value as PracticeMode);

/** Parse DB `practice_mode` (single value, comma-separated list, or a JSON array). */
export const parsePracticeModes = (value?: unknown): PracticeMode[] => {
  const raw = typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.filter((part): part is string => typeof part === 'string').join(',')
      : '';
  if (!raw.trim()) return ['memorization'];
  const parsed = raw
    .split(',')
    .map(part => part.trim())
    .filter(isPracticeMode);
  const unique = PRACTICE_MODE_ORDER.filter(mode => parsed.includes(mode));
  return unique.length > 0 ? unique : ['memorization'];
};

/** Serialize selected modes for storage in `practice_mode` text column. */
export const serializePracticeModes = (modes: PracticeMode[]): string => {
  const unique = PRACTICE_MODE_ORDER.filter(mode => modes.includes(mode));
  return (unique.length > 0 ? unique : ['memorization']).join(',');
};

export const practiceModeLabel = (mode: PracticeMode): string => {
  if (mode === 'memorization') return 'Classic';
  if (mode === 'shuffledGame') return 'Game';
  return 'Dictation';
};
