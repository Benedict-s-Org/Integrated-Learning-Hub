import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import MemorizationView from '../../components/MemorizationView/MemorizationView';
import { processText } from '../../utils/textProcessor';

const addSavedContent = vi.fn();
const updateSavedContent = vi.fn();

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
    user: { id: 'user-1', memorization_level: 3 },
    isAdmin: true,
    accentPreference: 'en-GB',
    voicePreference: null,
    updateVoicePreference: vi.fn(),
  }),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    addSavedContent,
    updateSavedContent,
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
  supabase: { rpc: vi.fn() },
}));

describe('MemorizationView update save', () => {
  const noop = () => {};
  const words = processText('Hello world');

  it('calls updateSavedContent when editingContentId is set', async () => {
    addSavedContent.mockReset();
    updateSavedContent.mockReset();
    updateSavedContent.mockResolvedValue(true);

    const user = userEvent.setup();
    render(
      <MemorizationView
        words={words}
        selectedIndices={[0]}
        originalText="Hello world"
        title="Sample"
        onBack={noop}
        onSave={noop}
        onViewSaved={noop}
        editingContentId="content-99"
      />
    );

    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(updateSavedContent).toHaveBeenCalledWith(
        'content-99',
        expect.objectContaining({
          title: 'Sample',
          originalText: 'Hello world',
          selectedWordIndices: [0],
          practiceMode: 'memorization',
        })
      );
    });
    expect(addSavedContent).not.toHaveBeenCalled();
  });
});
