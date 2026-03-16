import nlp from 'compromise';

export type VerbFormType = 
  | 'base' 
  | 'present' 
  | 'present_continuous' 
  | 'past' 
  | 'past_continuous' 
  | 'future' 
  | 'present_perfect'
  | 'plural';

export interface VerbForm {
  text: string;
  type: VerbFormType;
  prefix?: string; // For prefixes like "is", "are", "will", "has" etc.
}

/**
 * Checks if a word or phrase contains a verb that can be conjugated.
 */
export const isVerb = (text: string): boolean => {
  const doc = nlp(text);
  return doc.verbs().length > 0;
};

/**
 * Gets the base form (infinitive) of a verb.
 */
export const getBaseForm = (text: string): string => {
  const doc = nlp(text);
  return doc.verbs().toInfinitive().text().trim();
};

/**
 * Generates and orders verb forms according to the requested 7-step priority.
 */
export const getVerbForms = (text: string): VerbForm[] => {
  if (!text || !isVerb(text)) return [];

  const base = getBaseForm(text);
  const v = nlp(base).verbs();
  const conjugated = (v.conjugate()[0] || {}) as any;

  // Define the forms based on the requested order
  const forms: (VerbForm | null)[] = [
    // 1. Base form
    { text: base, type: 'base' },

    // 2. Simple present (+s/es/ies)
    conjugated.PresentTense ? { text: conjugated.PresentTense, type: 'present' } : null,

    // 3. Present continuous (student types is/are)
    conjugated.Gerund ? { text: conjugated.Gerund, type: 'present_continuous', prefix: 'is/are' } : null,

    // 4. Simple past
    conjugated.PastTense ? { text: conjugated.PastTense, type: 'past' } : null,

    // 5. Past continuous (student types was/were)
    conjugated.Gerund ? { text: conjugated.Gerund, type: 'past_continuous', prefix: 'was/were' } : null,

    // 6. Future tense (will + Base)
    { text: base, type: 'future', prefix: 'will' },

    // 7. Present perfect (has/have + Past Participle)
    conjugated.PastParticiple || conjugated.PastTense ? { text: (conjugated.PastParticiple || conjugated.PastTense), type: 'present_perfect', prefix: 'has/have' } : null,
  ];

  // Filter out nulls and duplicates (keeping the first occurrence)
  const seen = new Set<string>();
  const result: VerbForm[] = [];

  for (const f of forms) {
    if (f) {
      const key = `${f.prefix || ''}:${f.text}`;
      if (!seen.has(key)) {
        result.push(f);
        seen.add(key);
      }
    }
  }

  return result;
};

/**
 * Generates noun forms (specifically plural).
 */
export const getNounForms = (text: string): VerbForm[] => {
  if (!text) return [];
  const doc = nlp(text);
  const plural = doc.nouns().toPlural().text().trim();
  
  // If pluralization didn't change the word, don't return an alternative
  if (plural.toLowerCase() === text.trim().toLowerCase()) return [];

  return [{ text: plural, type: 'plural' }];
};
