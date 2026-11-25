export type PracticeMode = 'memorization' | 'shuffledGame' | 'dictation';

export const PRACTICE_MODE_ORDER: PracticeMode[] = ['memorization', 'shuffledGame', 'dictation'];

export const isPracticeMode = (value: string): value is PracticeMode =>
  PRACTICE_MODE_ORDER.includes(value as PracticeMode);

/** Parse DB `practice_mode` (single value or comma-separated list). */
export const parsePracticeModes = (value?: string | null): PracticeMode[] => {
  if (!value || !value.trim()) return ['memorization'];
  const parsed = value
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
