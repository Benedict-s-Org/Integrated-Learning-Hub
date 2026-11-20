import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpellingWordAudio } from '../../utils/spellingWordAudio';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../../utils/voiceManager', () => ({
  isGoogleCloudVoiceId: (voiceName?: string | null) =>
    !!voiceName && /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/.test(voiceName),
}));

import {
  confirmedAudioFromCacheRows,
  lookupCachedWordAudio,
  mergeConfirmedAudio,
  normalizeTtsCacheText,
} from '../../utils/ttsCacheLookup';

describe('normalizeTtsCacheText', () => {
  it('trims, collapses spaces, and lowercases like google-tts', () => {
    expect(normalizeTtsCacheText('  Hello   World ')).toBe('hello world');
  });
});

describe('confirmedAudioFromCacheRows', () => {
  it('binds practice words to cache hits and keeps original casing', () => {
    expect(
      confirmedAudioFromCacheRows(
        ['Cat', 'Dog', 'Bird'],
        [
          {
            text: 'cat',
            drive_file_id: 'drive-cat',
            accent: 'en-GB',
            voice_name: 'en-GB-Neural2-B',
          },
          {
            text: 'bird',
            drive_file_id: 'drive-bird',
            accent: 'en-GB',
            voice_name: 'en-GB-Neural2-B',
          },
        ],
        'en-GB',
        'en-GB-Neural2-B'
      )
    ).toEqual({
      0: {
        word: 'Cat',
        drive_file_id: 'drive-cat',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
      2: {
        word: 'Bird',
        drive_file_id: 'drive-bird',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
    });
  });
});

describe('mergeConfirmedAudio', () => {
  it('does not overwrite existing confirmations', () => {
    const existing: Record<number, SpellingWordAudio> = {
      0: {
        word: 'cat',
        drive_file_id: 'from-draft',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
    };
    const incoming: Record<number, SpellingWordAudio> = {
      0: {
        word: 'cat',
        drive_file_id: 'from-cache',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
      1: {
        word: 'dog',
        drive_file_id: 'from-cache',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
    };

    expect(mergeConfirmedAudio(existing, incoming)).toEqual({
      0: existing[0],
      1: incoming[1],
    });
  });
});

describe('lookupCachedWordAudio', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('queries tts_cache and returns matched bindings', async () => {
    const api: {
      select: () => unknown;
      eq: () => unknown;
      in: () => Promise<{ data: unknown[]; error: null }>;
    } = {
      select: () => api,
      eq: () => api,
      in: async () => ({
        data: [
          {
            text: 'cat',
            drive_file_id: 'drive-cat',
            accent: 'en-GB',
            voice_name: 'en-GB-Neural2-B',
          },
        ],
        error: null,
      }),
    };
    fromMock.mockReturnValue(api);

    await expect(
      lookupCachedWordAudio(['Cat', 'Missing'], 'en-GB', 'en-GB-Neural2-B')
    ).resolves.toEqual({
      0: {
        word: 'Cat',
        drive_file_id: 'drive-cat',
        accent: 'en-GB',
        voice_name: 'en-GB-Neural2-B',
      },
    });
    expect(fromMock).toHaveBeenCalledWith('tts_cache');
  });

  it('returns empty for browser-only voices', async () => {
    await expect(
      lookupCachedWordAudio(['cat'], 'en-GB', 'Google UK English Male')
    ).resolves.toEqual({});
    expect(fromMock).not.toHaveBeenCalled();
  });
});
