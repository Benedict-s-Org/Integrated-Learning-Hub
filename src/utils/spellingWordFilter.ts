/** Common function words with exactly 3 letters. Longer common words are never filtered. */
export const COMMON_3_LETTER_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
  'now', 'who', 'did', 'she', 'too', 'any', 'few', 'yet', 'nor', 'yes',
  'off', 'own', 'per',
]);

/** Normalize curly/smart apostrophes to ASCII `'`. */
export function normalizeApostrophes(word: string): string {
  return word.replace(/[\u2018\u2019\u02BC]/g, "'");
}

/**
 * Word-mode spelling list parser.
 * - Splits on spaces, commas, digits, and newlines (not apostrophes)
 * - Drops non-English tokens and numbers
 * - Drops all 1–2 letter words
 * - Drops common 3-letter function words (the, are, for, ...)
 * - Keeps every word with 4+ letters (including can't / shouldn't)
 */
export function parseSpellingWords(input: string): string[] {
  const rawWords = input
    .split(/[\s,\d\n]+/)
    .map((word) => normalizeApostrophes(word.trim()))
    .filter((word) => word.length > 0);

  return rawWords.filter((word) => {
    if (!/^[a-zA-Z'-]+$/.test(word)) return false;
    const lettersOnly = (word.match(/[a-zA-Z]+/g) || []).join('').toLowerCase();
    if (lettersOnly.length < 3) return false;
    if (lettersOnly.length === 3 && COMMON_3_LETTER_WORDS.has(lettersOnly)) return false;
    return true;
  });
}
