import { supabase } from '../lib/supabase';
import { isGoogleCloudVoiceId } from './voiceManager';
import type { SpellingWordAudio } from './spellingWordAudio';

/** Matches google-tts Edge Function default when speakingRate is omitted. */
export const DEFAULT_TTS_SPEAKING_RATE = 0.9;

const LOOKUP_CHUNK = 30;

export function normalizeTtsCacheText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

type CacheRow = {
  text: string;
  drive_file_id: string | null;
  accent: string;
  voice_name: string;
};

/**
 * Map practice words to SpellingWordAudio entries using tts_cache rows.
 * Cache keys are lowercased; the stored `word` keeps the practice spelling.
 */
export function confirmedAudioFromCacheRows(
  words: string[],
  rows: CacheRow[],
  accent: string,
  voiceName: string
): Record<number, SpellingWordAudio> {
  const byText = new Map<string, string>();
  for (const row of rows) {
    const id = row.drive_file_id?.trim();
    if (!id || !row.text) continue;
    byText.set(row.text, id);
  }

  const matched: Record<number, SpellingWordAudio> = {};
  words.forEach((word, index) => {
    const driveFileId = byText.get(normalizeTtsCacheText(word));
    if (!driveFileId) return;
    matched[index] = {
      word,
      drive_file_id: driveFileId,
      accent,
      voice_name: voiceName,
    };
  });
  return matched;
}

/**
 * Look up shared Drive TTS bindings for a word list under one accent/voice.
 * Does not download audio — Preview can confirm from these ids directly.
 */
export async function lookupCachedWordAudio(
  words: string[],
  accent: string,
  voiceName: string,
  speakingRate: number = DEFAULT_TTS_SPEAKING_RATE
): Promise<Record<number, SpellingWordAudio>> {
  if (!isGoogleCloudVoiceId(voiceName) || words.length === 0) return {};

  const uniqueTexts = [
    ...new Set(words.map(normalizeTtsCacheText).filter((text) => text.length > 0)),
  ];
  if (uniqueTexts.length === 0) return {};

  const rows: CacheRow[] = [];
  for (let i = 0; i < uniqueTexts.length; i += LOOKUP_CHUNK) {
    const chunk = uniqueTexts.slice(i, i + LOOKUP_CHUNK);
    const { data, error } = await (supabase as any)
      .from('tts_cache')
      .select('text, drive_file_id, accent, voice_name')
      .eq('accent', accent)
      .eq('voice_name', voiceName)
      .eq('speaking_rate', speakingRate)
      .in('text', chunk);

    if (error) {
      console.warn('[ttsCacheLookup] Failed to read tts_cache:', error);
      return confirmedAudioFromCacheRows(words, rows, accent, voiceName);
    }
    if (Array.isArray(data)) {
      rows.push(...(data as CacheRow[]));
    }
  }

  return confirmedAudioFromCacheRows(words, rows, accent, voiceName);
}

/** Fill empty confirmation slots without overwriting Play / draft bindings. */
export function mergeConfirmedAudio(
  existing: Record<number, SpellingWordAudio>,
  incoming: Record<number, SpellingWordAudio>
): Record<number, SpellingWordAudio> {
  const next = { ...existing };
  for (const [key, entry] of Object.entries(incoming)) {
    const index = Number(key);
    if (!Number.isInteger(index) || next[index]) continue;
    next[index] = entry;
  }
  return next;
}
