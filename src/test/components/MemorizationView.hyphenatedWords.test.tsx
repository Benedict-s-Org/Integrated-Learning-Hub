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
    user: { id: 'test-user', memorization_level: 1 },
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

describe('MemorizationView hyphenated words', () => {
  const noop = () => {};

  it('masks hyphenated English words instead of leaving them fully visible', async () => {
    const user = userEvent.setup();
    const originalText = 'The Mid-Autumn Festival';
    const words = processText(originalText);
    const midAutumn = words.find((w) => w.text === 'Mid-Autumn');
    expect(midAutumn).toBeTruthy();
    expect(midAutumn!.isPunctuation).toBe(false);

    const { container } = render(
      <MemorizationView
        words={words}
        selectedIndices={[midAutumn!.index]}
        originalText={originalText}
        onBack={noop}
        onSave={noop}
        onViewSaved={noop}
      />
    );

    await user.click(screen.getByRole('button', { name: /Cover all Words/i }));

    const button = screen.getByRole('button', {
      name: /Hidden word starting with M and ending with n/i,
    });
    expect(button).toBeTruthy();

    // Level 1: first and last letters stay normal; middle letters use the box font.
    // The hyphen must remain a visible character, not a covered letter box.
    const letterSpans = Array.from(button.querySelectorAll('span'));
    const boxedSpans = letterSpans.filter(
      (el) => (el as HTMLElement).style.fontFamily.includes('Boxes')
    );
    const plainSpans = letterSpans.filter(
      (el) => !(el as HTMLElement).style.fontFamily.includes('Boxes')
    );

    // Mid-Autumn at level 1: cover i,d,A,u,t,u,m (7) — keep M, -, n plain
    expect(boxedSpans.map((el) => el.textContent).join('')).toBe('idAutum');
    expect(plainSpans.map((el) => el.textContent).join('')).toBe('M-n');
    expect(container.textContent).toContain('The');
    expect(container.textContent).toContain('Festival');
  });
});
