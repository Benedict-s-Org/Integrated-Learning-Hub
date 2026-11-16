import { render } from '@testing-library/react';
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

describe('MemorizationView line breaks', () => {
  const noop = () => {};

  it('renders single newlines as <br> and paragraph breaks as spacing', () => {
    const originalText = 'Line one has words\nLine two continues\n\nAfter a blank line';
    const words = processText(originalText);
    const keyWarnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '');
      if (msg.includes('same key')) keyWarnings.push(msg);
      originalError(...args);
    };

    try {
      const { container } = render(
        <MemorizationView
          words={words}
          selectedIndices={[0, 1]}
          originalText={originalText}
          onBack={noop}
          onSave={noop}
          onViewSaved={noop}
        />
      );

      const display = container.querySelector(
        '[data-source-tsx="MemorizationView Text Display|src/components/MemorizationView/MemorizationView.tsx"]'
      );
      expect(display).toBeTruthy();

      // One single newline between line one and line two
      expect(display!.querySelectorAll('br')).toHaveLength(1);

      // Double newline becomes a paragraph-break spacer
      const paragraphBreaks = Array.from(display!.children).filter(
        (el) => el.tagName === 'DIV' && el.className.includes('w-full')
      );
      expect(paragraphBreaks.length).toBeGreaterThanOrEqual(1);

      // Words from later lines must still be present (not collapsed away)
      expect(display!.textContent).toContain('Line');
      expect(display!.textContent).toContain('two');
      expect(display!.textContent).toContain('After');
      expect(keyWarnings).toEqual([]);
    } finally {
      console.error = originalError;
    }
  });

  it('keeps line breaks when English spaces create index/key overlap risk', () => {
    // Spaces make word.index diverge from array idx — keys must stay unique
    const originalText = 'alpha beta gamma\ndelta epsilon';
    const words = processText(originalText);
    const keyWarnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '');
      if (msg.includes('same key')) keyWarnings.push(msg);
      originalError(...args);
    };

    try {
      const { container } = render(
        <MemorizationView
          words={words}
          selectedIndices={[]}
          originalText={originalText}
          onBack={noop}
          onSave={noop}
          onViewSaved={noop}
        />
      );

      const display = container.querySelector(
        '[data-source-tsx="MemorizationView Text Display|src/components/MemorizationView/MemorizationView.tsx"]'
      );
      expect(display!.querySelectorAll('br')).toHaveLength(1);
      expect(display!.textContent).toContain('delta');
      expect(keyWarnings).toEqual([]);
    } finally {
      console.error = originalError;
    }
  });
});
