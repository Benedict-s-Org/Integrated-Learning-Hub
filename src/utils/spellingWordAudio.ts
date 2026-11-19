export type SpellingWordAudio = {
  word: string;
  drive_file_id: string;
  accent: string;
  voice_name: string;
};

export function assertWordAudioAligned(
  words: string[],
  wordAudio: SpellingWordAudio[]
): { ok: true } | { ok: false; reason: string } {
  if (wordAudio.length !== words.length) {
    return { ok: false, reason: `Expected ${words.length} audio bindings, got ${wordAudio.length}` };
  }
  for (let i = 0; i < words.length; i++) {
    const entry = wordAudio[i];
    if (!entry || entry.word !== words[i]) {
      return { ok: false, reason: `Word mismatch at index ${i}` };
    }
    if (!entry.drive_file_id?.trim()) {
      return { ok: false, reason: `Missing drive_file_id at index ${i}` };
    }
    if (!entry.accent?.trim() || !entry.voice_name?.trim()) {
      return { ok: false, reason: `Missing accent/voice at index ${i}` };
    }
  }
  const accents = new Set(wordAudio.map((e) => e.accent));
  const voices = new Set(wordAudio.map((e) => e.voice_name));
  if (accents.size !== 1 || voices.size !== 1) {
    return { ok: false, reason: 'All bindings must share the same accent and voice_name' };
  }
  return { ok: true };
}

export function isCompleteWordAudio(
  words: string[],
  wordAudio: SpellingWordAudio[] | null | undefined
): boolean {
  if (!wordAudio) return false;
  return assertWordAudioAligned(words, wordAudio).ok;
}

/**
 * Reattach previously confirmed Drive bindings to a new word list by exact word
 * text (FIFO for duplicates). Optional accent/voice filters drop stale voices.
 */
export function rematchWordAudioByWord(
  words: string[],
  previous: SpellingWordAudio[] | null | undefined,
  opts?: { accent?: string; voiceName?: string }
): Record<number, SpellingWordAudio> {
  const pool = (previous ?? []).filter((entry) => {
    if (!entry?.word || !entry.drive_file_id?.trim()) return false;
    if (opts?.accent && entry.accent !== opts.accent) return false;
    if (opts?.voiceName && entry.voice_name !== opts.voiceName) return false;
    return true;
  });

  const matched: Record<number, SpellingWordAudio> = {};
  words.forEach((word, index) => {
    const poolIndex = pool.findIndex((entry) => entry.word === word);
    if (poolIndex < 0) return;
    matched[index] = { ...pool[poolIndex], word };
    pool.splice(poolIndex, 1);
  });
  return matched;
}

export function confirmedAudioList(
  confirmed: Record<number, SpellingWordAudio>
): SpellingWordAudio[] {
  return Object.keys(confirmed)
    .map((key) => Number(key))
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)
    .map((index) => confirmed[index])
    .filter((entry): entry is SpellingWordAudio => !!entry);
}