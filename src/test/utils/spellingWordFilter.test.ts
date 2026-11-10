import { describe, expect, it } from 'vitest';
import { parseSpellingWords } from '../../utils/spellingWordFilter';

describe('parseSpellingWords', () => {
  it('drops 1–2 letter words and common 3-letter words from the count', () => {
    expect(parseSpellingWords('is are the for')).toEqual([]);
    expect(parseSpellingWords('is are beautiful necessary')).toEqual([
      'beautiful',
      'necessary',
    ]);
  });

  it('keeps contractions as one word when they have 4+ letters', () => {
    expect(parseSpellingWords("can't shouldn't is are")).toEqual([
      "can't",
      "shouldn't",
    ]);
  });

  it('treats numbers as separators and keeps longer content words', () => {
    expect(parseSpellingWords('1. is 2. are 3. calendar')).toEqual(['calendar']);
  });

  it('is case-insensitive for common short words', () => {
    expect(parseSpellingWords('Is Are THE Cat')).toEqual(['Cat']);
  });
});
