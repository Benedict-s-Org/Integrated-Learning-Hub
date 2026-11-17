import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeAudio = {
  src: string;
  volume: number;
  currentTime: number;
  playsInline: boolean;
  preload: string;
  paused: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setAttribute: ReturnType<typeof vi.fn>;
};

function installDom() {
  const instances: FakeAudio[] = [];

  class FakeCtx {
    state = 'suspended';
    resume = vi.fn(() => new Promise<void>(() => {}));
  }

  vi.stubGlobal(
    'AudioContext',
    vi.fn(function AudioContextMock() {
      return new FakeCtx();
    })
  );
  vi.stubGlobal('webkitAudioContext', undefined);
  vi.stubGlobal(
    'Audio',
    vi.fn(function AudioMock(_src?: string) {
      const el: FakeAudio = {
        src: _src ?? '',
        volume: 1,
        currentTime: 0,
        playsInline: false,
        preload: '',
        paused: true,
        play: vi.fn(),
        pause: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setAttribute: vi.fn(),
      };
      el.play = vi.fn(() => {
        el.paused = false;
        return Promise.resolve();
      });
      el.pause = vi.fn(() => {
        el.paused = true;
      });
      instances.push(el);
      return el;
    })
  );

  return instances;
}

function endedHandler(audio: FakeAudio): () => void {
  const call = audio.addEventListener.mock.calls.find((entry) => entry[0] === 'ended');
  if (!call) throw new Error('ended listener was not registered');
  return call[1] as () => void;
}

async function loadModule() {
  vi.resetModules();
  return import('../../utils/audioPlayback');
}

describe('audioPlayback', () => {
  let instances: FakeAudio[] = [];

  beforeEach(() => {
    instances = installDom();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('calls play() before a suspended AudioContext can resume', async () => {
    const { playAudioUrl } = await loadModule();
    const pending = playAudioUrl('data:audio/mp3;base64,QQ==');

    expect(instances).toHaveLength(1);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(instances[0].src).toBe('data:audio/mp3;base64,QQ==');

    endedHandler(instances[0])();
    await pending;
  });

  it('plays the real clip on the element that was unlocked in the gesture', async () => {
    const { playAudioUrl, unlockAudioSync } = await loadModule();
    unlockAudioSync();
    expect(instances).toHaveLength(1);

    const pending = playAudioUrl('data:audio/mp3;base64,QQ==');

    expect(instances).toHaveLength(1);
    expect(instances[0].src).toBe('data:audio/mp3;base64,QQ==');
    expect(instances[0].play.mock.calls.length).toBeGreaterThanOrEqual(2);

    endedHandler(instances[0])();
    await pending;
  });
});
