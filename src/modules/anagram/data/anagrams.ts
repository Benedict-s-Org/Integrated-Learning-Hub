export interface AnagramSet {
  letters: string;
  validAnswers: string[];
}

// ==========================================
// EASY: 8×3-letter + 2×4-letter (IELTS B2)
// ==========================================
export const easySets: AnagramSet[] = [
  // --- 3-letter B2 words ---
  { letters: "EOW", validAnswers: ["OWE", "WOE"] },
  { letters: "AEW", validAnswers: ["AWE"] },
  { letters: "EOR", validAnswers: ["ORE", "ROE"] },
  { letters: "DEY", validAnswers: ["DYE"] },
  { letters: "EFO", validAnswers: ["FOE"] },
  { letters: "OVW", validAnswers: ["VOW"] },
  { letters: "CEU", validAnswers: ["CUE", "ECU"] },
  { letters: "BOS", validAnswers: ["SOB"] },
  // --- 4-letter B2 words ---
  { letters: "ACEH", validAnswers: ["ACHE", "EACH"] },
  { letters: "AEFT", validAnswers: ["FEAT", "FATE", "FETA"] },
];

// ==========================================
// HARD: 8×5-letter + 2×6-letter (IELTS B2)
// ==========================================
export const hardSets: AnagramSet[] = [
  // --- 5-letter B2 words ---
  { letters: "ACERT", validAnswers: ["TRACE", "CRATE", "REACT", "CATER", "CARET", "CARTE"] },
  { letters: "AELST", validAnswers: ["STEAL", "STALE", "TALES", "LEAST", "SLATE", "TESLA"] },
  { letters: "AEPRS", validAnswers: ["SPARE", "SPEAR", "PARSE", "PEARS", "REAPS", "PARES"] },
  { letters: "ACENR", validAnswers: ["CRANE", "NACRE", "CANER", "RANCE"] },
  { letters: "ADERT", validAnswers: ["TRADE", "TREAD", "RATED", "DATER", "TARED"] },
  { letters: "ACEHT", validAnswers: ["CHEAT", "TEACH", "THECA"] },
  { letters: "BERTU", validAnswers: ["BRUTE", "TUBER", "REBUT", "BURET"] },
  { letters: "AEILS", validAnswers: ["AISLE"] },
  // --- 6-letter B2 words ---
  { letters: "ADEGNR", validAnswers: ["GARDEN", "DANGER", "GANDER", "RANGED"] },
  { letters: "EILNST", validAnswers: ["LISTEN", "SILENT", "ENLIST", "TINSEL", "INLETS"] },
];

/**
 * Scramble letters so the display does NOT accidentally spell any valid answer.
 * Re-shuffles up to 50 times until a non-answer arrangement is found.
 */
export function scrambleLetters(
  letters: string,
  validAnswers: string[]
): string {
  const upper = validAnswers.map((a) => a.toUpperCase());
  let scrambled: string;
  let attempts = 0;
  do {
    scrambled = letters
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    attempts++;
  } while (upper.includes(scrambled.toUpperCase()) && attempts < 50);
  return scrambled;
}
