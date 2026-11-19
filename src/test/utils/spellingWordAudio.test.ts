import { describe, expect, it } from 'vitest';
import {
  assertWordAudioAligned,
  isCompleteWordAudio,
  rematchWordAudioByWord,
  type SpellingWordAudio,
} from '../../utils/spellingWordAudio';

const entry = (word: string, overrides: Partial<SpellingWordAudio> = {}): SpellingWordAudio => ({
  word,
  drive_file_id: `id-${word}`,
  accent: 'en-GB',
  voice_name: 'en-GB-Neural2-B',
  ...overrides,
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

describe('rematchWordAudioByWord', () => {
  it('keeps confirmations for words that remain after deletes', () => {
    const previous = [entry('cat'), entry('dog'), entry('bird')];
    expect(rematchWordAudioByWord(['cat', 'bird'], previous)).toEqual({
      0: entry('cat'),
      1: entry('bird'),
    });
  });

  it('drops bindings that no longer match the current voice', () => {
    const previous = [
      entry('cat'),
      entry('dog', { accent: 'en-US', voice_name: 'en-US-Neural2-A' }),
    ];
    expect(
      rematchWordAudioByWord(['cat', 'dog'], previous, {
        accent: 'en-GB',
        voiceName: 'en-GB-Neural2-B',
      })
    ).toEqual({
      0: entry('cat'),
    });
  });

  it('consumes duplicate word bindings in order', () => {
    const previous = [
      entry('run', { drive_file_id: 'first' }),
      entry('run', { drive_file_id: 'second' }),
    ];
    expect(rematchWordAudioByWord(['run', 'run'], previous)).toEqual({
      0: entry('run', { drive_file_id: 'first' }),
      1: entry('run', { drive_file_id: 'second' }),
    });
  });
});