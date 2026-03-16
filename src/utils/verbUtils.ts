import nlp from 'compromise';

export type VerbFormType = 
  | 'base' 
  | 'present' 
  | 'present_continuous' 
  | 'past' 
  | 'past_continuous' 
  | 'future' 
  | 'present_perfect'
  | 'plural'
  | 'singular';

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
  
  // Use a context string to help compromise identify and conjugate the verb correctly.
  // This is especially important for words like "last" that have multiple parts of speech.
  const ctx = `it ${base}`;
  const v = nlp(ctx).verbs();
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
    { text: `will ${base}`, type: 'future' },

    // 7. Present perfect (has/have + Past Participle)
    conjugated.Participle || conjugated.PastParticiple || conjugated.PastTense 
      ? { text: `has/have ${conjugated.Participle || conjugated.PastParticiple || conjugated.PastTense}`, type: 'present_perfect' } 
      : null,
  ];

  // Special case for "be" - ensure am/are are available and perfect form is "been"
  if (base.toLowerCase() === 'be') {
    forms.push({ text: 'am/are', type: 'present' });
    // Update the perfect form to "been" if it was "was/were"
    const perfectIdx = forms.findIndex(f => f?.type === 'present_perfect');
    if (perfectIdx !== -1) {
      forms[perfectIdx] = { text: 'has/have been', type: 'present_perfect' };
    }
  }

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
 * Generates noun forms (singular and plural).
 */
export const getNounForms = (text: string): VerbForm[] => {
  if (!text) return [];
  const doc = nlp(text);
  const singular = doc.nouns().toSingular().text().trim();
  const plural = doc.nouns().toPlural().text().trim();
  
  const forms: VerbForm[] = [];
  
  if (singular && singular.toLowerCase() !== text.trim().toLowerCase()) {
    forms.push({ text: singular, type: 'singular' });
  }
  
  if (plural && plural.toLowerCase() !== text.trim().toLowerCase()) {
    forms.push({ text: plural, type: 'plural' });
  }

  return forms;
};
