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