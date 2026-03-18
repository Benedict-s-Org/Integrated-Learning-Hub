import { supabase } from '../lib/supabase';

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

export interface AccentOption {
  code: string;
  label: string;
  flag: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { code: 'en-GB', label: 'British English', flag: '🇬🇧' },
  { code: 'en-US', label: 'American English', flag: '🇺🇸' },
  { code: 'en-AU', label: 'Australian English', flag: '🇦🇺' },
  { code: 'en-IE', label: 'Irish English', flag: '🇮🇪' },
];

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
      const finalVoices = window.speechSynthesis.getVoices();
      console.log(`[VoiceManager] getAvailableVoices fallback timeout. Found ${finalVoices.length} voices.`);
      resolve(finalVoices);
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
 * Check if a voice is considered "High Quality" (Premium, Enhanced, or stable native)
 */
const isHighQualityVoice = (voice: SpeechSynthesisVoice): boolean => {
  const name = voice.name.toLowerCase();
  
  // 1. Explicit high-quality markers
  if (name.includes('premium') || 
      name.includes('enhanced') || 
      name.includes('natural') || 
      name.includes('neural')) {
    return true;
  }

  // 2. Known reliable iOS/macOS native voices
  const reliableNames = ['samantha', 'alex', 'daniel', 'karen', 'moira', 'rishi', 'veena', 'tessa'];
  if (reliableNames.some(reliable => name.includes(reliable))) {
    return true;
  }

  // 3. iOS Native is generally high quality for our use case (iPad focus)
  if (isIOSNativeVoice(voice)) {
    return true;
  }

  return false;
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

  // Sort and filter voices within each language group
  Object.keys(grouped).forEach(lang => {
    // Determine if we have any high-quality voices in this group
    const hasHighQuality = grouped[lang].some(v => isHighQualityVoice(v.voice));

    // If we have high-quality voices, filter out the "legacy" or low-quality ones
    // to keep the list clean and reliable.
    let filteredVoices = grouped[lang];
    if (hasHighQuality) {
      filteredVoices = grouped[lang].filter(v => isHighQualityVoice(v.voice));
    }

    filteredVoices.sort((a, b) => {
      // Prioritize: 1) iOS Native, 2) High Quality (non-native), 3) Local
      const aHQ = isHighQualityVoice(a.voice);
      const bHQ = isHighQualityVoice(b.voice);
      
      if (a.isIOSNative && !b.isIOSNative) return -1;
      if (!a.isIOSNative && b.isIOSNative) return 1;
      
      if (aHQ && !bHQ) return -1;
      if (!aHQ && bHQ) return 1;
      
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      
      return a.name.localeCompare(b.name);
    });

    // Limit to top 3 voices per accent for each OS
    grouped[lang] = filteredVoices.slice(0, 3);
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
  console.log(`[VoiceManager] findBestVoiceMatch: Searching among ${voices.length} voices for accent: ${accentCode}`, { preference, recommendedVoiceName });

  if (voices.length === 0) {
    console.warn('[VoiceManager] findBestVoiceMatch: No voices available in browser.');
    return null;
  }

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

  // 4. Prioritize high-quality voices for the accent
  const highQualityVoices = accentVoices.filter(v => isHighQualityVoice(v));
  
  const iosNative = (highQualityVoices.length > 0 ? highQualityVoices : accentVoices)
    .find(v => isIOSNativeVoice(v));
  if (iosNative) return iosNative;

  // 5. Prioritize local voices among high quality (or all if none are HQ)
  const localVoice = (highQualityVoices.length > 0 ? highQualityVoices : accentVoices)
    .find(v => v.localService);
  if (localVoice) return localVoice;

  // 6. Return first available voice for accent
  const finalVoice = accentVoices[0];
  console.log(`[VoiceManager] findBestVoiceMatch: Selected fallback accent voice: ${finalVoice?.name} (${finalVoice?.lang})`);
  return finalVoice;
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
 * Fetch high-quality audio from Google Cloud TTS via Supabase Edge Function
 */
export const fetchCloudAudio = async (text: string, accent: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-tts', {
      body: { text, accent }
    });

    if (error) {
      console.error('[VoiceManager] Error invoking google-tts:', error);
      return null;
    }

    if (data?.audioContent) {
      // Return as a data URI that can be played by an Audio object
      return `data:audio/mp3;base64,${data.audioContent}`;
    }

    return null;
  } catch (error) {
    console.error('[VoiceManager] fetchCloudAudio failed:', error);
    return null;
  }
};

/**
 * Test if speech synthesis is supported
 */
export const isSpeechSynthesisSupported = (): boolean => {
  return 'speechSynthesis' in window;
};
