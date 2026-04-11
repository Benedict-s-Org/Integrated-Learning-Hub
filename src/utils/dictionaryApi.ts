/**
 * Free Dictionary API utility
 * https://dictionaryapi.dev/
 */

const BASE_URL = "https://api.dictionaryapi.dev/api/v2/entries/en";

export interface DictionaryResult {
  isValid: boolean;
  word?: string;
  phonetic?: string;
  partOfSpeech?: string;
  partsOfSpeech?: string[]; // Added: all parts of speech found
  definition?: string;
  example?: string;
}

/** Cache responses to avoid redundant API calls within the same session */
const cache = new Map<string, DictionaryResult>();

export async function checkWord(word: string): Promise<DictionaryResult> {
  const key = word.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(key)}`);

    if (res.status === 404) {
      const result: DictionaryResult = { isValid: false };
      cache.set(key, result);
      return result;
    }

    if (!res.ok) {
      throw new Error(`API responded with ${res.status}`);
    }

    const data = await res.json();
    
    // The API might return multiple entries or meanings
    // Collect all unique parts of speech across all meanings
    const allPOS = new Set<string>();
    data.forEach((entry: any) => {
      entry.meanings?.forEach((m: any) => {
        if (m.partOfSpeech) allPOS.add(m.partOfSpeech.toLowerCase());
      });
    });

    const entry = data[0];
    const meaning = entry?.meanings?.[0];
    const defObj = meaning?.definitions?.[0];

    const result: DictionaryResult = {
      isValid: true,
      word: entry?.word,
      phonetic: entry?.phonetic || entry?.phonetics?.find((p: any) => p.text)?.text,
      partOfSpeech: meaning?.partOfSpeech,
      partsOfSpeech: Array.from(allPOS),
      definition: defObj?.definition,
      example: defObj?.example,
    };

    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`Dictionary API error for "${key}":`, err);
    // Return invalid but don't cache errors so they can be retried
    return { isValid: false };
  }
}

/** Clears the in-memory cache (useful for testing) */
export function clearDictionaryCache() {
  cache.clear();
}
