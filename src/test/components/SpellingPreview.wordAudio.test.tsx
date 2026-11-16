import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import SpellingPreview from '../../components/SpellingPreview/SpellingPreview';
import { fetchCloudAudioRich, findBestVoiceMatch } from '../../utils/voiceManager';
import { playAudioUrl } from '../../utils/audioPlayback';

const PREMIUM_VOICE = 'en-GB-Neural2-B';
const BROWSER_VOICE = 'Google UK English Male';

const { authState } = vi.hoisted(() => ({
  authState: {
    accentPreference: 'en-GB',
    voicePreference: {
      voiceURI: 'en-GB-Neural2-B',
      voiceName: 'en-GB-Neural2-B',
      voiceLang: 'en-GB',
    },
    updateVoicePreference: vi.fn(),
    user: { id: 'user-1', role: 'admin' as const },
    session: { access_token: 'token' },
    isAdmin: true,
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../utils/voiceManager', () => ({
  findBestVoiceMatch: vi.fn(),
  createUtterance: vi.fn((text: string, voice: SpeechSynthesisVoice) => ({
    text,
    voice,
    onend: null as (() => void) | null,
    onerror: null as ((event: SpeechSynthesisErrorEvent) => void) | null,
  })),
  fetchCloudAudioRich: vi.fn(),
  isGoogleCloudVoiceId: (voiceName?: string | null) =>
    !!voiceName && /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/.test(voiceName),
  resolveAudioUrl: vi.fn(async (url: string) => url),
}));

vi.mock('../../utils/audioPlayback', () => ({
  unlockAudioSync: vi.fn(),
  playAudioUrl: vi.fn(),
}));

vi.mock('../../components/AccentSelector/AccentSelector', () => ({
  default: ({
    onChange,
  }: {
    onChange: (accent: string, voiceName: string, voiceLang: string, voiceURI: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange('en-US', 'en-US-Neural2-A', 'en-US', 'en-US-Neural2-A')}
    >
      Switch voice
    </button>
  ),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

beforeAll(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn((utterance: { onend?: (() => void) | null }) => {
        queueMicrotask(() => utterance.onend?.());
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
    },
  });
});

function mockCloudSuccess() {
  vi.mocked(fetchCloudAudioRich).mockImplementation(async (word: string) => ({
    audioUrl: `https://drive.example/${word}`,
    audioContent: `data:audio/mp3;base64,${btoa(word)}`,
    driveFileId: `drive-${word}`,
  }));
  vi.mocked(playAudioUrl).mockResolvedValue({} as HTMLAudioElement);
}

function renderPreview() {
  return render(
    <SpellingPreview
      title="Week 1"
      words={['cat', 'dog']}
      onNext={() => {}}
      onBack={() => {}}
    />
  );
}

describe('SpellingPreview word audio confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.voicePreference.voiceURI = PREMIUM_VOICE;
    authState.voicePreference.voiceName = PREMIUM_VOICE;
    vi.mocked(findBestVoiceMatch).mockResolvedValue({
      name: PREMIUM_VOICE,
      lang: 'en-GB',
    } as SpeechSynthesisVoice);
    mockCloudSuccess();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'practice-1' }),
      })
    );
  });

  it('disables Save until every word is confirmed with Premium Cloud audio', async () => {
    const user = userEvent.setup();
    renderPreview();

    expect(await screen.findByRole('button', { name: /save practice/i })).toBeDisabled();
    expect(screen.getByText('Audio confirmed 0/2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /play all/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Audio confirmed 2/2')).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    const save = screen.getByRole('button', { name: /save practice/i });
    expect(save).toBeEnabled();

    await user.click(save);

    const fetchMock = vi.mocked(fetch);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body));
    expect(body.wordAudio).toEqual([
      { word: 'cat', drive_file_id: 'drive-cat', accent: 'en-GB', voice_name: PREMIUM_VOICE },
      { word: 'dog', drive_file_id: 'drive-dog', accent: 'en-GB', voice_name: PREMIUM_VOICE },
    ]);
    expect(body.audioAccent).toBe('en-GB');
    expect(body.audioVoiceName).toBe(PREMIUM_VOICE);
  });

  it('never enables Save for a browser-only voice', async () => {
    authState.voicePreference.voiceURI = BROWSER_VOICE;
    authState.voicePreference.voiceName = BROWSER_VOICE;
    const user = userEvent.setup();
    renderPreview();

    await user.click(await screen.findByRole('button', { name: /play all/i }));

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /play all/i })).toBeEnabled();
      },
      { timeout: 4000 }
    );

    expect(screen.getByText('Audio confirmed 0/2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save practice/i })).toBeDisabled();
    expect(screen.getByText('A Premium Google voice is required to save.')).toBeInTheDocument();
  });

  it('clears confirmations when the voice changes', async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(await screen.findByRole('button', { name: /play all/i }));
    await waitFor(
      () => {
        expect(screen.getByText('Audio confirmed 2/2')).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    expect(screen.getByRole('button', { name: /save practice/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /switch voice/i }));

    await waitFor(() => {
      expect(screen.getByText('Audio confirmed 0/2')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /save practice/i })).toBeDisabled();
  });
});
