import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import SpellingPractice from '../../components/SpellingPractice/SpellingPractice';
import type { SpellingWordAudio } from '../../utils/spellingWordAudio';
import { fetchCloudAudio, findBestVoiceMatch, resolveAudioUrl } from '../../utils/voiceManager';
import { playAudioUrl } from '../../utils/audioPlayback';

const PRACTICE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const { authState, srsApi, supabaseFrom } = vi.hoisted(() => ({
  authState: {
    accentPreference: 'en-GB',
    voicePreference: {
      voiceURI: 'en-GB-Neural2-B',
      voiceName: 'en-GB-Neural2-B',
      voiceLang: 'en-GB',
    },
    user: { id: 'user-1', spelling_level: 2 },
  },
  srsApi: {
    getWordsDueForReview: vi.fn(async () => ['quiz']),
    recordWordAttempt: vi.fn(),
  },
  supabaseFrom: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../context/SpellingSrsContext', () => ({
  useSpellingSrs: () => srsApi,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: supabaseFrom,
  },
}));

vi.mock('../../utils/voiceManager', () => ({
  findBestVoiceMatch: vi.fn(),
  createUtterance: vi.fn((text: string, voice: SpeechSynthesisVoice) => ({
    text,
    voice,
    onend: null as (() => void) | null,
    onerror: null as ((event: SpeechSynthesisErrorEvent) => void) | null,
  })),
  fetchCloudAudio: vi.fn(),
  driveFileToProxyUrl: (id: string) => `https://drive.google.com/uc?export=download&id=${id}`,
  resolveAudioUrl: vi.fn(async (url: string) => url),
}));

vi.mock('../../utils/audioPlayback', () => ({
  unlockAudioSync: vi.fn(),
  playAudioUrl: vi.fn(),
}));

const speak = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false,
      cancel: vi.fn(),
      speak,
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [{ name: 'en-GB', lang: 'en-GB' }],
      onvoiceschanged: null,
    },
  });
});

function binding(word: string, overrides: Partial<SpellingWordAudio> = {}): SpellingWordAudio {
  return {
    word,
    drive_file_id: `drive-${word}`,
    accent: 'en-GB',
    voice_name: 'en-GB-Neural2-B',
    ...overrides,
  };
}

function proxyFor(word: string) {
  return `https://drive.google.com/uc?export=download&id=drive-${word}`;
}

function mockPracticeRow(wordAudio: unknown, error: { message: string } | null = null) {
  supabaseFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: error ? null : { word_audio: wordAudio },
          error,
        }),
      }),
    }),
  }));
}

function renderPractice(
  props: Partial<React.ComponentProps<typeof SpellingPractice>> = {}
) {
  return render(
    <SpellingPractice
      title="Week 1"
      words={['cat', 'dog']}
      onBack={() => {}}
      {...props}
    />
  );
}

describe('SpellingPractice bound playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    vi.mocked(findBestVoiceMatch).mockResolvedValue({
      name: 'en-GB-Neural2-B',
      lang: 'en-GB',
    } as SpeechSynthesisVoice);
    vi.mocked(fetchCloudAudio).mockResolvedValue('data:audio/mp3;base64,Y2xvdWQ=');
    vi.mocked(resolveAudioUrl).mockImplementation(async (url: string) => url);
    vi.mocked(playAudioUrl).mockResolvedValue({} as HTMLAudioElement);
    mockPracticeRow([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays only the bound Drive file and does not re-synthesize', async () => {
    renderPractice({
      wordAudio: [binding('cat'), binding('dog')],
    });

    await waitFor(() => {
      expect(resolveAudioUrl).toHaveBeenCalledWith(proxyFor('cat'));
    });
    expect(playAudioUrl).toHaveBeenCalledWith(proxyFor('cat'));
    expect(fetchCloudAudio).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it('keeps the selected word binding when a word limit shuffles the list', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderPractice({
      words: ['cat', 'dog', 'bird'],
      wordLimit: 1,
      wordAudio: [binding('cat'), binding('dog'), binding('bird')],
    });

    await waitFor(() => {
      expect(resolveAudioUrl).toHaveBeenCalledWith(proxyFor('dog'));
    });
    expect(fetchCloudAudio).not.toHaveBeenCalled();
  });

  it('shows an English error when bound audio fails and does not fall back', async () => {
    const user = userEvent.setup();
    vi.mocked(resolveAudioUrl).mockResolvedValueOnce('');

    renderPractice({
      wordAudio: [binding('cat'), binding('dog')],
    });

    expect(await screen.findByText('Audio unavailable for this word')).toBeInTheDocument();
    expect(fetchCloudAudio).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(playAudioUrl).not.toHaveBeenCalled();

    vi.mocked(resolveAudioUrl).mockImplementation(async (url: string) => url);
    await user.click(screen.getByRole('button', { name: 'Play Word' }));

    await waitFor(() => {
      expect(playAudioUrl).toHaveBeenCalledWith(proxyFor('cat'));
    });
    expect(screen.queryByText('Audio unavailable for this word')).not.toBeInTheDocument();
    expect(fetchCloudAudio).not.toHaveBeenCalled();
  });

  it('disables play when bindings are non-empty but incomplete', async () => {
    renderPractice({
      wordAudio: [binding('cat')],
    });

    expect(await screen.findByText('Practice audio is incomplete.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Word' })).toBeDisabled();
    expect(fetchCloudAudio).not.toHaveBeenCalled();
    expect(resolveAudioUrl).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('keeps preference Cloud audio when word_audio is empty', async () => {
    renderPractice({ wordAudio: [] });

    await waitFor(() => {
      expect(fetchCloudAudio).toHaveBeenCalledWith('cat', 'en-GB', 'en-GB-Neural2-B');
    });
    expect(resolveAudioUrl).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(screen.queryByText('Practice audio is incomplete.')).not.toBeInTheDocument();
  });

  it('falls back to browser speech when legacy Cloud audio is missing', async () => {
    vi.mocked(fetchCloudAudio).mockResolvedValue(null as unknown as string);
    renderPractice({ wordAudio: [] });

    await waitFor(() => {
      expect(speak).toHaveBeenCalled();
    });
    expect(resolveAudioUrl).not.toHaveBeenCalled();
  });

  it('loads word_audio by practice id when the prop is omitted', async () => {
    mockPracticeRow([binding('cat'), binding('dog')]);
    renderPractice({ practiceId: PRACTICE_ID });

    await waitFor(() => {
      expect(resolveAudioUrl).toHaveBeenCalledWith(proxyFor('cat'));
    });
    expect(supabaseFrom).toHaveBeenCalledWith('spelling_practices');
    expect(fetchCloudAudio).not.toHaveBeenCalled();
  });

  it('does not fall back to Cloud audio when the binding fetch fails', async () => {
    mockPracticeRow(null, { message: 'network' });
    renderPractice({ practiceId: PRACTICE_ID });

    expect(await screen.findByText('Could not load practice audio.')).toBeInTheDocument();
    expect(screen.queryByText('Practice audio is incomplete.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Word' })).toBeDisabled();
    expect(fetchCloudAudio).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('skips the binding fetch for srs-review and uses legacy audio', async () => {
    srsApi.getWordsDueForReview.mockResolvedValue(['quiz']);
    renderPractice({
      practiceId: 'srs-review',
      isSRSReview: true,
      words: ['cat'],
    });

    await waitFor(() => {
      expect(fetchCloudAudio).toHaveBeenCalledWith('quiz', 'en-GB', 'en-GB-Neural2-B');
    });
    expect(supabaseFrom).not.toHaveBeenCalled();
    expect(resolveAudioUrl).not.toHaveBeenCalled();
  });
});
