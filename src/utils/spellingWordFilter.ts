/** Common function words with exactly 3 letters. Longer common words are never filtered. */
export const COMMON_3_LETTER_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
  'now', 'who', 'did', 'she', 'too', 'any', 'few', 'yet', 'nor', 'yes',
  'off', 'own', 'per',
]);

/**
 * `'s` forms that are shortened (it is / he is / let us…), not possessives.
 * Other `'s` words (e.g. student's) are dropped.
 */
const CONTRACTION_S_FORMS = new Set([
  "it's", "that's", "what's", "who's", "he's", "she's",
  "let's", "there's", "here's", "where's", "when's", "why's", "how's",
]);

/** Normalize curly/smart apostrophes to ASCII `'`. */
export function normalizeApostrophes(word: string): string {
  return word.replace(/[\u2018\u2019\u02BC]/g, "'");
}

/**
 * Apostrophes are allowed only for shortened/contracted forms
 * (can't, shouldn't, you're…), not possessives or other ' joins.
 */
export function isContractionOrPlainWord(word: string): boolean {
  // Letters with optional internal hyphens, no apostrophe
  if (/^[a-zA-Z]+(?:-[a-zA-Z]+)*$/.test(word)) return true;

  // Clear contraction endings: n't, 're, 've, 'll, 'd, 'm
  if (/^[a-zA-Z]+(?:n't|'re|'ve|'ll|'d|'m)$/i.test(word)) return true;

  // Whitelisted 's shortenings only (it's, that's…) — not possessives
  if (CONTRACTION_S_FORMS.has(word.toLowerCase())) return true;

  return false;
}

/**
 * Word-mode spelling list parser.
 * - Splits on spaces, commas, digits, and newlines (not contraction apostrophes)
 * - Drops non-English tokens and numbers
 * - Drops all 1–2 letter words
 * - Drops common 3-letter function words (the, are, for, ...)
 * - Keeps contractions used for shortening (can't / shouldn't); drops other ' forms
 * - Dedupes case-insensitively (keeps the first occurrence only)
 */
export function parseSpellingWords(input: string): string[] {
  const rawWords = input
    .split(/[\s,\d\n]+/)
    .map((word) => normalizeApostrophes(word.trim()))
    .filter((word) => word.length > 0);

  const kept: string[] = [];
  const seen = new Set<string>();

  for (const word of rawWords) {
    if (!isContractionOrPlainWord(word)) continue;
    const lettersOnly = (word.match(/[a-zA-Z]+/g) || []).join('').toLowerCase();
    if (lettersOnly.length < 3) continue;
    // Common 3-letter stop list applies to plain words only (don't treat "it's" as "its")
    if (!word.includes("'") && lettersOnly.length === 3 && COMMON_3_LETTER_WORDS.has(lettersOnly)) {
      continue;
    }

    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(word);
  }

  return kept;
}
