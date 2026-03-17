/**
 * Utility functions for text analysis and manipulation.
 */

/**
 * Finds the difference between an original sentence containing a grammar error
 * and the corrected sentence.
 *
 * It returns the index of the first differing word in the original sentence,
 * the incorrect word, and the correct word (or phrase) to replace it.
 *
 * If the sentences are identical, it returns null.
 *
 * @param original The original sentence with a mistake.
 * @param corrected The fully corrected sentence.
 */
export function findDifference(original: string, corrected: string): {
  wordIndex: number;
  wrongWord: string;
  correctedWord: string;
} | null {
  // Simple tokenization by whitespace
  // Keep punctuation attached for now, or strip it if preferred.
  // The ProofreadingAnswerSetting uses naive `\S+|\s+/g` matching, so we should try to match its word index counting.
  // In `ProofreadingAnswerSetting`, tokens are split by whitespace, and each token that is not purely punctuation gets an `index`.
  
  // Let's implement a matching tokenizer.
  const getTokens = (text: string) => {
    const rawTokens = text.match(/\S+|\s+/g) || [];
    const words: { text: string; index: number; isPunctuation: boolean }[] = [];
    let wordIndex = 0;

    rawTokens.forEach(token => {
      if (token.trim().length > 0) {
        const isPunctuation = /^[^\w]+$/.test(token);
        words.push({
          text: token,
          index: wordIndex,
          isPunctuation,
        });
        wordIndex++;
      }
    });
    return words;
  };

  const origWords = getTokens(original).filter(w => !w.isPunctuation);
  const corrWords = getTokens(corrected).filter(w => !w.isPunctuation);

  if (origWords.length === 0 || corrWords.length === 0) {
    return null;
  }

  if (original === corrected) {
    return null;
  }

  // Find the first index where words differ
  let diffIndex = -1;
  const minLen = Math.min(origWords.length, corrWords.length);

  for (let i = 0; i < minLen; i++) {
    // Basic structural equality check
    if (origWords[i].text !== corrWords[i].text) {
      diffIndex = i;
      break;
    }
  }

  // If we didn't find a difference in the common prefix, the difference is at the end (e.g., word added/omitted)
  if (diffIndex === -1 && origWords.length !== corrWords.length) {
    diffIndex = minLen;
  }

  if (diffIndex === -1) {
     return null;
  }

  // To find WHAT was changed, we look from the end as well to find the "suffix"
  let suffixDiffIndexOrig = origWords.length - 1;
  let suffixDiffIndexCorr = corrWords.length - 1;

  while (
    suffixDiffIndexOrig >= diffIndex &&
    suffixDiffIndexCorr >= diffIndex &&
    origWords[suffixDiffIndexOrig].text === corrWords[suffixDiffIndexCorr].text
  ) {
    suffixDiffIndexOrig--;
    suffixDiffIndexCorr--;
  }

  // The wrong portion is from diffIndex to suffixDiffIndexOrig in origWords
  // The correct portion is from diffIndex to suffixDiffIndexCorr in corrWords

  // Edge Case: omission (e.g. "He to school" vs "He went to school")
  // In proofreading UI, if a word is missing, there's no "word" to click on.
  // Usually, the student clicks the word BEFORE or AFTER where the omission happened.
  // For simplicity, we'll associate the change with the word at `diffIndex`.
  // If `diffIndex` is out of bounds for original words (e.g. appended word), we'll map it to the last word.
  const targetIndex = Math.min(diffIndex, origWords.length - 1);

  // We'll extract the full correct phrase that should replace the wrong phrase
  let correctedPhrase = '';
  for (let i = diffIndex; i <= suffixDiffIndexCorr; i++) {
    correctedPhrase += (i > diffIndex ? ' ' : '') + corrWords[i].text;
  }

  // If there's no explicit wrong word (it was an omission, and original has no word here, e.g. suffixDiffIndexOrig < diffIndex)
  // We still need to return a correction. Assuming the user has to rewrite the wrong word + the omitted word.
  if (suffixDiffIndexOrig < diffIndex) {
    // Omission scenario. We will target the adjacent word.
    const wrongPhrase = origWords[targetIndex].text;
    
    // We need to adjust the corrected phrase to include the adjacent word since we are "replacing" it.
    // Wait, the diff algorithm above isolates ONLY the changed part.
    // E.g., Orig: a b d. Corr: a b c d.
    // diffIndex = 2. origWords[2] = 'd'. suffixDiffOrig = 1 (since 'd' matches).
    // so suffixDiffOrig < diffIndex.
    // targetIndex = 2. wrongPhrase = 'd'.
    // the correction should be 'c d'.
    let correctedWithContext = '';
    for (let i = Math.min(diffIndex, corrWords.length - 1); i <= Math.max(diffIndex, suffixDiffIndexCorr) + (suffixDiffIndexOrig < diffIndex ? 1 : 0); i++) {
      if (corrWords[i]) {
         correctedWithContext += (correctedWithContext ? ' ' : '') + corrWords[i].text;
      }
    }
    
    return {
      wordIndex: targetIndex,
      wrongWord: wrongPhrase,
      // If we're replacing "d" with "c d", the replacement is "c d"
      correctedWord: correctedPhrase + (correctedPhrase ? ' ' : '') + origWords[targetIndex].text
    };
  }

  const wrongPhrase = origWords.slice(diffIndex, suffixDiffIndexOrig + 1).map(w => w.text).join(' ');

  return {
    wordIndex: targetIndex,
    wrongWord: wrongPhrase,
    correctedWord: correctedPhrase || '(remove)' // If correctedPhrase is empty, it means words should be removed
  };
}
