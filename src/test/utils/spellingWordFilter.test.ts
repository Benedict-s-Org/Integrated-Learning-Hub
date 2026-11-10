import { describe, expect, it } from 'vitest';
import { parseSpellingWords, spellingAnswersMatch } from '../../utils/spellingWordFilter';

describe('parseSpellingWords', () => {
  it('drops 1–2 letter words and common 3-letter words from the count', () => {
    expect(parseSpellingWords('is are the for')).toEqual([]);
    expect(parseSpellingWords('is are beautiful necessary')).toEqual([
      'beautiful',
      'necessary',
    ]);
  });

  it('keeps shortened contractions as one word', () => {
    // I'm has only 2 letters so it is still dropped by the min-length rule
    expect(parseSpellingWords("can't shouldn't don't you're I've I'll I'm it's")).toEqual([
      "can't",
      "shouldn't",
      "don't",
      "you're",
      "I've",
      "I'll",
      "it's",
    ]);
  });

  it('drops possessives and other non-shortening apostrophe forms', () => {
    expect(parseSpellingWords("student's Mary's O'Brien rock'n'roll calendar")).toEqual([
      'calendar',
    ]);
  });

  it('treats numbers as separators and keeps longer content words', () => {
    expect(parseSpellingWords('1. is 2. are 3. calendar')).toEqual(['calendar']);
  });

  it('is case-insensitive for common short words', () => {
    expect(parseSpellingWords('Is Are THE Cat')).toEqual(['Cat']);
  });

  it('keeps only the first occurrence of duplicate words', () => {
    expect(parseSpellingWords('apple banana Apple APPLE banana cherry')).toEqual([
      'apple',
      'banana',
      'cherry',
    ]);
    expect(parseSpellingWords("can't don't can't")).toEqual(["can't", "don't"]);
  });
});

describe('spellingAnswersMatch', () => {
  it('accepts lowercase input when the target has capitals', () => {
    expect(spellingAnswersMatch('london', 'London')).toBe(true);
    expect(spellingAnswersMatch('usa', 'USA')).toBe(true);
    expect(spellingAnswersMatch('mcdonald', 'McDonald')).toBe(true);
  });

  it('still rejects wrong spelling regardless of case', () => {
    expect(spellingAnswersMatch('londan', 'London')).toBe(false);
  });

  it('trims whitespace and normalizes apostrophes', () => {
    expect(spellingAnswersMatch("  can't  ", "Can't")).toBe(true);
    expect(spellingAnswersMatch('can\u2019t', "Can't")).toBe(true);
  });
});
