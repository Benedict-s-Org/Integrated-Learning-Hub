import { describe, expect, it } from 'vitest';
import { assertWordAudioAligned, isCompleteWordAudio, type SpellingWordAudio } from '../../utils/spellingWordAudio';

const entry = (word: string): SpellingWordAudio => ({
  word,
  drive_file_id: `id-${word}`,
  accent: 'en-GB',
  voice_name: 'en-GB-Neural2-B',
});

describe('isCompleteWordAudio', () => {
  it('is false for empty or short bindings', () => {
    expect(isCompleteWordAudio(['a', 'b'], [])).toBe(false);
    expect(isCompleteWordAudio(['a', 'b'], [entry('a')])).toBe(false);
  });

  it('is true when every word is bound in order', () => {
    expect(isCompleteWordAudio(['Cat', 'Dog'], [entry('Cat'), entry('Dog')])).toBe(true);
  });
});

describe('assertWordAudioAligned', () => {
  it('rejects mismatched word at index', () => {
    const result = assertWordAudioAligned(['Cat'], [entry('Dog')]);
    expect(result.ok).toBe(false);
  });

  it('rejects missing drive_file_id', () => {
    const result = assertWordAudioAligned(['Cat'], [{ ...entry('Cat'), drive_file_id: '' }]);
    expect(result.ok).toBe(false);
  });

  it('accepts aligned complete bindings', () => {
    expect(assertWordAudioAligned(['Cat'], [entry('Cat')]).ok).toBe(true);
  });
});