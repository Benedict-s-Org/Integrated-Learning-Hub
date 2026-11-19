import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import MemorizationView from '../../components/MemorizationView/MemorizationView';
import { processText } from '../../utils/textProcessor';

beforeAll(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
    },
  });
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', memorization_level: 3 },
    isAdmin: false,
    accentPreference: 'en-GB',
    voicePreference: null,
    updateVoicePreference: vi.fn(),
  }),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    addSavedContent: vi.fn(),
    updateSavedContent: vi.fn(),
    saveLimit: null,
    currentSaveCount: 0,
  }),
}));

vi.mock('../../utils/voiceManager', () => ({
  findBestVoiceMatch: vi.fn(),
  isSpeechSynthesisSupported: () => false,
  createUtterance: vi.fn(),
  fetchCloudAudio: vi.fn(),
}));

vi.mock('../../components/MemorizationTopNav/MemorizationTopNav', () => ({
  default: () => null,
}));

vi.mock('../../components/SpellingPractice/VoiceSettings', () => ({
  default: () => null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
}));

const boxedText = (button: HTMLElement) =>
  Array.from(button.querySelectorAll('span'))
    .filter((el) => (el as HTMLElement).style.fontFamily.includes('Boxes'))
    .map((el) => el.textContent)
    .join('');

const plainText = (button: HTMLElement) =>
  Array.from(button.querySelectorAll('span'))
    .filter((el) => !(el as HTMLElement).style.fontFamily.includes('Boxes'))
    .map((el) => el.textContent)
    .join('');

describe('MemorizationView progressive reveal', () => {
  const noop = () => {};

  it('covers all letters, then hints ends, then fully reveals on successive clicks', async () => {
    const user = userEvent.setup();
    const originalText = 'Hello world';
    const words = processText(originalText);
    const hello = words.find((w) => w.text === 'Hello')!;

    render(
      <MemorizationView
        words={words}
        selectedIndices={[hello.index]}
        originalText={originalText}
        onBack={noop}
        onSave={noop}
        onViewSaved={noop}
      />
    );

    await user.click(screen.getByRole('button', { name: /Cover all Words/i }));

    // Stage 1: every letter boxed
    let button = screen.getByRole('button', { name: 'Hidden word' });
    expect(boxedText(button)).toBe('Hello');
    expect(plainText(button)).toBe('');

    // Stage 2: first and last letters visible
    await user.click(button);
    button = screen.getByRole('button', {
      name: /Hidden word starting with H and ending with o/i,
    });
    expect(plainText(button)).toBe('Ho');
    expect(boxedText(button)).toBe('ell');

    // Stage 3: fully revealed (button name is the word text)
    await user.click(button);
    button = screen.getByRole('button', { name: 'Hello' });
    expect(button.textContent).toBe('Hello');
    expect(button.querySelectorAll('span')).toHaveLength(0);

    // Click again re-covers fully
    await user.click(button);
    button = screen.getByRole('button', { name: 'Hidden word' });
    expect(boxedText(button)).toBe('Hello');
  });
});
