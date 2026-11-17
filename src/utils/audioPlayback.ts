/**
 * Browser autoplay helpers.
 *
 * After an `await` (e.g. Cloud TTS fetch), `audio.play()` often throws
 * NotAllowedError because the user-gesture token has expired.
 * `unlockAudioSync()` must play the shared element inside the gesture.
 * `playAudioUrl()` reuses that same element and calls `play()` before any await.
 */

/** Minimal silent WAV — enough to establish a media-engagement gesture. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let sharedContext: AudioContext | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
const playTokens = new WeakMap<HTMLAudioElement, number>();

function getAudioContext(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedContext) sharedContext = new AC();
  return sharedContext;
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    sharedAudio.playsInline = true;
    sharedAudio.setAttribute('playsinline', 'true');
  }
  return sharedAudio;
}

function nextPlayToken(audio: HTMLAudioElement): number {
  const next = (playTokens.get(audio) ?? 0) + 1;
  playTokens.set(audio, next);
  return next;
}

function isCurrentPlay(audio: HTMLAudioElement, token: number): boolean {
  return playTokens.get(audio) === token;
}

function aborted(): DOMException {
  return new DOMException('Playback interrupted', 'AbortError');
}

/**
 * Must be called synchronously inside a click/tap handler (before any await).
 * Plays silence on the shared element so a later play() on that element is allowed.
 */
export function unlockAudioSync(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }

    const audio = getSharedAudio();
    audio.src = SILENT_WAV;
    audio.volume = 0.001;
    const playedSrc = audio.src;
    void audio
      .play()
      .then(() => {
        unlocked = true;
        // Only stop the silence. A real clip may already have replaced src.
        if (audio.src === playedSrc) {
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        // Ignore — the shared element may still accept a later play().
      });
  } catch (err) {
    console.warn('[audioPlayback] unlockAudioSync failed:', err);
  }
}

/**
 * Play a data URI or URL. Call this synchronously from a gesture when the URL
 * is already known. Otherwise call unlockAudioSync() in the gesture first;
 * this reuses that same element. Returns the Audio element so callers can pause it.
 */
export async function playAudioUrl(
  url: string,
  existing?: HTMLAudioElement | null
): Promise<HTMLAudioElement> {
  const audio = existing ?? getSharedAudio();
  const token = nextPlayToken(audio);

  try {
    audio.pause();
  } catch {
    /* ignore */
  }
  audio.src = url;
  audio.volume = 1;
  audio.playsInline = true;
  audio.setAttribute('playsinline', 'true');

  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    void ctx.resume().catch(() => {
      /* ignore */
    });
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onEnded = () => {
      if (!isCurrentPlay(audio, token)) {
        finish(() => reject(aborted()));
        return;
      }
      finish(() => resolve());
    };
    const onError = () => {
      if (!isCurrentPlay(audio, token)) {
        finish(() => reject(aborted()));
        return;
      }
      // Ignore the error fired by swapping src before play() starts.
      if (!started) return;
      finish(() => reject(new Error('Audio element failed to load/play')));
    };
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // play() runs inside this executor, before playAudioUrl awaits.
    void audio.play().then(() => {
      if (!isCurrentPlay(audio, token)) {
        finish(() => reject(aborted()));
        return;
      }
      started = true;
      unlocked = true;
    }).catch((err) => {
      if (!isCurrentPlay(audio, token)) {
        finish(() => reject(aborted()));
        return;
      }
      finish(() => reject(err));
    });
  });

  return audio;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}
