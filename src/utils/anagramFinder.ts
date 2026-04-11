/**
 * Anagram Finder Utility
 * Scans a word list to find missing anagram candidates.
 */

// Switching to a more curated "Common English" list (Top 20,000 words)
// This avoids suggesting obscure strings found in the larger 370k list.
const COMMON_WORDS_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt";

let wordCache: string[] | null = null;

async function getWordList(): Promise<string[]> {
  if (wordCache) return wordCache;
  
  try {
    const response = await fetch(COMMON_WORDS_URL);
    if (!response.ok) throw new Error("Failed to fetch word list");
    const text = await response.text();
    // The 20k list uses simple newlines (\n)
    wordCache = text.split("\n")
                    .map(w => w.toLowerCase().trim())
                    .filter(w => w.length >= 3 && w.length <= 10 && w !== "");
    return wordCache;
  } catch (error) {
    console.error("Error fetching word list:", error);
    return [];
  }
}

/**
 * Normalizes a string by sorting its letters alphabetically
 */
function getSignature(word: string): string {
  return word.toLowerCase().split("").sort().join("");
}

/**
 * Finds all words in the dictionary that use the EXACT same letters
 */
export async function findAnagrams(letters: string, alreadyKnown: string[]): Promise<string[]> {
  const dictionary = await getWordList();
  const targetSignature = getSignature(letters);
  const knownSet = new Set(alreadyKnown.map(w => w.toLowerCase().trim()));

  return dictionary.filter(word => {
    if (word.length !== letters.length) return false;
    if (knownSet.has(word)) return false;
    return getSignature(word) === targetSignature;
  });
}

/**
 * Optimizes signature calculations for a bulk set of questions.
 * Instead of scanning the whole dictionary per question, 
 * we scan it once and group by signature, then match to questions.
 */
export async function findAnagramsBulk(
  questions: { id: string, letters: string, known: string[] }[]
): Promise<Record<string, string[]>> {
  const dictionary = await getWordList();
  const results: Record<string, string[]> = {};

  // 1. Pre-calculate signatures for the questions
  const targets = questions.map(q => ({
    id: q.id,
    signature: getSignature(q.letters),
    known: new Set(q.known.map(k => k.toLowerCase().trim()))
  }));

  // 2. Scan dictionary once and find matches for all targets
  // We filter dictionary words first by length range seen in questions
  const lengths = new Set(questions.map(q => q.letters.length));
  
  dictionary.forEach(word => {
    if (!lengths.has(word.length)) return;
    
    const wordSig = getSignature(word);
    
    targets.forEach(t => {
      if (word.length === t.signature.length && wordSig === t.signature && !t.known.has(word)) {
        if (!results[t.id]) results[t.id] = [];
        results[t.id].push(word);
      }
    });
  });

  return results;
}

/**
 * Checks if a specific word is a valid anagram of the given letters
 */
export function isAnagramOf(word: string, letters: string): boolean {
  if (word.length !== letters.length) return false;
  return getSignature(word) === getSignature(letters);
}

/**
 * Checks if a word is a potential simple inflection (ends in s, ed, or ing).
 * This is used for heuristic filtering in the UI.
 */
export function isPotentialSimpleInflection(word: string): boolean {
  const w = word.toLowerCase();
  
  // Pluralized / 3rd person singular
  if (w.endsWith('s') && w.length > 3) {
    return true;
  }
  
  // Past tense
  if (w.endsWith('ed') && w.length > 4) {
    return true;
  }
  
  // Present participle
  if (w.endsWith('ing') && w.length > 5) {
    return true;
  }
  
  return false;
}
