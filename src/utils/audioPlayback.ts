/**
 * Browser autoplay helpers.
 *
 * After an `await` (e.g. Cloud TTS fetch), `audio.play()` often throws
 * NotAllowedError because the user-gesture token has expired.
 * Call `unlockAudioSync()` synchronously at the start of the click handler,
 * then use `playAudioUrl()` after the fetch.
 */

/** Minimal silent WAV — enough to establish a media-engagement gesture. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let sharedContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedContext) sharedContext = new AC();
  return sharedContext;
}

/**
 * Must be called synchronously inside a click/tap handler (before any await).
 * Primes AudioContext + HTMLAudioElement so later async play() is allowed.
 */
export function unlockAudioSync(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }

    const silent = new Audio(SILENT_WAV);
    silent.volume = 0.001;
    void silent
      .play()
      .then(() => {
        silent.pause();
        silent.currentTime = 0;
        unlocked = true;
      })
      .catch(() => {
        // Ignore — sticky activation may still land via AudioContext.resume()
      });
  } catch (err) {
    console.warn('[audioPlayback] unlockAudioSync failed:', err);
  }
}

/**
 * Play a data URI or URL. Prefer calling unlockAudioSync() on the same click first.
 * Returns the Audio element so callers can pause/stop it.
 */
export async function playAudioUrl(
  url: string,
  existing?: HTMLAudioElement | null
): Promise<HTMLAudioElement> {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }

  const audio = existing ?? new Audio();
  audio.pause();
  audio.src = url;
  audio.volume = 1;

  await new Promise<void>((resolve, reject) => {
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Audio element failed to load/play'));
    };
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    void audio.play().then(() => {
      unlocked = true;
      // Wait for ended/error — play() only means start succeeded
    }).catch((err) => {
      cleanup();
      reject(err);
    });
  });

  return audio;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}
