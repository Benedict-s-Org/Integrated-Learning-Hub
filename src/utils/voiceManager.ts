export interface VoiceInfo {
  name: string;
  lang: string;
  uri: string;
  voice: SpeechSynthesisVoice;
  isLocal: boolean;
  isIOSNative: boolean;
}

export interface VoicePreference {
  voiceName: string;
  voiceLang: string;
  voiceURI: string;
}

/**
 * Get all available voices from the browser
 */
export const getAvailableVoices = async (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Wait for voices to load
    const handleVoicesChanged = () => {
      voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(voices);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    // Fallback timeout
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
};

/**
 * Check if a voice is iOS native
 */
const isIOSNativeVoice = (voice: SpeechSynthesisVoice): boolean => {
  // iOS native voices typically don't have 'Google' or 'Microsoft' in the name
  // and are marked as localService
  return voice.localService &&
         !voice.name.includes('Google') &&
         !voice.name.includes('Microsoft') &&
         !voice.name.includes('Chrome');
};

/**
 * Group voices by language/accent
 */
export const groupVoicesByLanguage = async (): Promise<Record<string, VoiceInfo[]>> => {
  const voices = await getAvailableVoices();
  const grouped: Record<string, VoiceInfo[]> = {};

  voices.forEach(voice => {
    // Extract language code (e.g., 'en-US' from 'en-US')
    const langCode = voice.lang;

    if (!grouped[langCode]) {
      grouped[langCode] = [];
    }

    grouped[langCode].push({
      name: voice.name,
      lang: voice.lang,
      uri: voice.voiceURI,
      voice: voice,
      isLocal: voice.localService,
      isIOSNative: isIOSNativeVoice(voice),
    });
  });

  // Sort voices within each language group
  // Prioritize: 1) iOS Native, 2) Local, 3) Remote
  Object.keys(grouped).forEach(lang => {
    grouped[lang].sort((a, b) => {
      if (a.isIOSNative && !b.isIOSNative) return -1;
      if (!a.isIOSNative && b.isIOSNative) return 1;
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });
  });

  return grouped;
};

/**
 * Get a display-friendly name for a voice
 */
export const getVoiceDisplayName = (voice: SpeechSynthesisVoice): string => {
  let name = voice.name;

  // Remove common prefixes
  name = name.replace('Google ', '').replace('Microsoft ', '');

  // Add quality indicators
  if (isIOSNativeVoice(voice)) {
    return `${name} (iOS Native)`;
  } else if (voice.localService) {
    return `${name} (Local)`;
  } else {
    return `${name} (Online)`;
  }
};

/**
 * Find the best voice match based on preferences
 */
export const findBestVoiceMatch = async (
  preference: VoicePreference | null,
  accentCode: string,
  recommendedVoiceName?: string
): Promise<SpeechSynthesisVoice | null> => {
  const voices = await getAvailableVoices();

  // 1. Try exact match with preference
  if (preference) {
    const exactMatch = voices.find(v => v.voiceURI === preference.voiceURI);
    if (exactMatch) return exactMatch;

    // Try name match
    const nameMatch = voices.find(v => v.name === preference.voiceName && v.lang === preference.voiceLang);
    if (nameMatch) return nameMatch;
  }

  // 2. Try recommended voice
  if (recommendedVoiceName) {
    const recommended = voices.find(v =>
      v.lang === accentCode && v.name.includes(recommendedVoiceName)
    );
    if (recommended) return recommended;
  }

  // 3. Filter by accent
  const accentVoices = voices.filter(v => v.lang === accentCode);
  if (accentVoices.length === 0) {
    // Fallback to base language (e.g., 'en' from 'en-US')
    const baseLang = accentCode.split('-')[0];
    const baseLangVoices = voices.filter(v => v.lang.startsWith(baseLang));
    if (baseLangVoices.length > 0) {
      return baseLangVoices[0];
    }
    return voices.length > 0 ? voices[0] : null;
  }

  // 4. Prioritize iOS native voices
  const iosNative = accentVoices.find(v => isIOSNativeVoice(v));
  if (iosNative) return iosNative;

  // 5. Prioritize local voices
  const localVoice = accentVoices.find(v => v.localService);
  if (localVoice) return localVoice;

  // 6. Return first available voice for accent
  return accentVoices[0];
};

/**
 * Create a speech utterance with optimal settings
 */
export const createUtterance = (
  text: string,
  voice: SpeechSynthesisVoice
): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.8; // Slightly slower for clarity
  utterance.pitch = 1;
  utterance.volume = 1;

  return utterance;
};

/**
 * Test if speech synthesis is supported
 */
export const isSpeechSynthesisSupported = (): boolean => {
  return 'speechSynthesis' in window;
};
