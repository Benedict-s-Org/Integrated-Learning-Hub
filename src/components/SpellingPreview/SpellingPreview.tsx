import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ArrowLeft, ArrowRight, CheckCircle, XCircle, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AccentSelector from '../AccentSelector/AccentSelector';
import SpellingTopNav from '../SpellingTopNav/SpellingTopNav';
import { findBestVoiceMatch, createUtterance, fetchCloudAudio, resolveAudioUrl } from '../../utils/voiceManager';
import { unlockAudioSync, playAudioUrl } from '../../utils/audioPlayback';
import { supabase } from '../../lib/supabase';

interface SpellingPreviewProps {
  title: string;
  words: string[];
  onNext: () => void;
  onBack: () => void;
  isPhraseMode?: boolean;
  onSave?: () => void;
  onViewSaved?: () => void;
  wordLimit?: number;
}

const SpellingPreview: React.FC<SpellingPreviewProps> = ({ title, words, onNext, onBack, isPhraseMode, onSave, onViewSaved, wordLimit }) => {
  const { accentPreference, voicePreference, updateVoicePreference, user, session, isAdmin } = useAuth();
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [currentAccent, setCurrentAccent] = useState(accentPreference);
  const [currentVoiceURI, setCurrentVoiceURI] = useState<string | undefined>(voicePreference?.voiceURI);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Use refs to track playing state for the async loops to avoid closure issues
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
      return;
    }

    loadVoice();
  }, []);

  const loadVoice = async () => {
    try {
      const { data: recommendedVoices, error: recError } = await supabase
        .from('recommended_voices' as any)
        .select('voice_name')
        .eq('accent_code', accentPreference)
        .order('priority', { ascending: false })
        .limit(1);

      if (recError) {
        console.warn('[SpellingPreview] Could not fetch recommended voices:', recError);
      }

      const recommendedVoiceName = (recommendedVoices as any)?.[0]?.voice_name;

      const voice = await findBestVoiceMatch(
        voicePreference,
        accentPreference,
        recommendedVoiceName
      );

      if (voice) {
        setCurrentVoice(voice);
      }
    } catch (error) {
      console.error('Error loading voice:', error);
    }
  };

  const handleVoiceChange = async (accent: string, voiceName: string, voiceLang: string, voiceURI: string) => {
    setCurrentAccent(accent);
    setCurrentVoiceURI(voiceURI);

    try {
      const { data: recommendedVoices, error: recError } = await supabase
        .from('recommended_voices' as any)
        .select('voice_name')
        .eq('accent_code', accent)
        .order('priority', { ascending: false })
        .limit(1);

      if (recError) {
        console.warn('[SpellingPreview] Could not fetch recommended voices on change:', recError);
      }

      const recommendedVoiceName = (recommendedVoices as any)?.[0]?.voice_name;

      const voice = await findBestVoiceMatch(
        { voiceName, voiceLang, voiceURI },
        accent,
        recommendedVoiceName
      );

      if (voice) {
        setCurrentVoice(voice);
        await updateVoicePreference(voiceName, voiceLang, voiceURI);
      }
    } catch (error) {
      console.error('Error changing voice:', error);
    }
  };

  const finishPlayback = () => {
    currentAudioRef.current = null;
    utteranceRef.current = null;
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  const speakWithBrowserVoice = (word: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !currentVoice) {
        console.warn('[SpellingPreview] Browser TTS unavailable', {
          supported: 'speechSynthesis' in window,
          hasVoice: !!currentVoice,
        });
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = createUtterance(word, currentVoice);
      utteranceRef.current = utterance; // Keep reference so Chrome does not GC mid-speak

      utterance.onend = () => {
        utteranceRef.current = null;
        resolve();
      };
      utterance.onerror = (event) => {
        console.error('[SpellingPreview] Browser utterance error:', event);
        utteranceRef.current = null;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const playCloudAudio = async (rawUrl: string): Promise<boolean> => {
    const playableUrl = rawUrl.startsWith('data:')
      ? rawUrl
      : await resolveAudioUrl(rawUrl);

    if (!playableUrl) return false;

    try {
      const audio = await playAudioUrl(playableUrl);
      currentAudioRef.current = audio;
      currentAudioRef.current = null;
      return true;
    } catch (err) {
      console.warn('[SpellingPreview] Cloud audio playback failed:', err);
      currentAudioRef.current = null;
      return false;
    }
  };

  const speakWord = async (word: string) => {
    setIsPlaying(true);
    isPlayingRef.current = true;

    try {
      // 1. Try Google Cloud TTS for premium consistency
      const audioDataUri = await fetchCloudAudio(word, currentAccent, currentVoiceURI);

      // If stopped during fetch, exit cleanly
      if (!isPlayingRef.current) {
        finishPlayback();
        return;
      }

      if (audioDataUri) {
        console.log('[SpellingPreview] Using Google Cloud TTS audio');
        const played = await playCloudAudio(audioDataUri);
        if (played) {
          finishPlayback();
          return;
        }
        console.warn('[SpellingPreview] Cloud audio unplayable, falling back to browser voice');
      }
    } catch (err) {
      console.warn('[SpellingPreview] Cloud TTS failed, falling back to browser voice:', err);
    }

    if (!isPlayingRef.current) {
      finishPlayback();
      return;
    }

    // 2. Fallback to browser native speechSynthesis
    await speakWithBrowserVoice(word);
    finishPlayback();
  };

  const handlePlayWord = (index: number) => {
    // Unlock during the click gesture before any await inside speakWord
    unlockAudioSync();

    // Stop any in-flight playback before starting a new word
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setCurrentWordIndex(index);
    speakWord(words[index]);
  };

  const handlePlayAll = async () => {
    if (words.length === 0) return;

    // Unlock during the click gesture before TTS fetches
    unlockAudioSync();

    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    setCurrentWordIndex(0);

    for (let i = 0; i < words.length; i++) {
      if (!isPlayingRef.current) break;

      setCurrentWordIndex(i);

      try {
        const audioDataUri = await fetchCloudAudio(words[i], currentAccent, currentVoiceURI);

        if (!isPlayingRef.current) break;

        let played = false;
        if (audioDataUri) {
          played = await playCloudAudio(audioDataUri);
        }

        if (!played && isPlayingRef.current) {
          await speakWithBrowserVoice(words[i]);
        }

        if (i < words.length - 1 && isPlayingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      } catch (err) {
        console.error('[SpellingPreview] Error in play all:', err);
      }
    }

    finishPlayback();
  };

  const handleStopAll = () => {
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleSave = async () => {
    if (!user?.id) {
      setSaveError('You must be logged in to save practices');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/spelling-practices/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          title: title.trim(),
          words: words,
          userId: user.id,
          isPhraseMode: isPhraseMode,
          metadata: {
            wordLimit: wordLimit || 20
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save practice');
      }

      await response.json();

      setSaveSuccess(true);
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save practice');
    } finally {
      setSaving(false);
    }
  };

  if (!speechSupported) {
    return (
      <div
        className="min-h-full bg-background p-8"
      >
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-4">
              <XCircle size={40} className="text-red-600" />
              <h1 className="text-3xl font-bold text-gray-800">Browser Not Supported</h1>
            </div>
            <p className="text-gray-600 mb-6">
              Your browser doesn't support text-to-speech functionality. Please use a modern browser like Chrome, Safari, or Edge.
            </p>
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {onViewSaved && (
        <SpellingTopNav
          onCreateNew={onBack}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8"
        style={{ paddingTop: onViewSaved ? '100px' : '32px' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <CheckCircle size={40} className="text-green-600" />
                <h1 className="text-3xl font-bold text-gray-800">Preview & Verify</h1>
              </div>
              <p className="text-gray-600">
                Listen to each word to make sure the pronunciation is correct before starting practice
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
              <p className="text-gray-600">
                Total words: <span className="font-semibold">{words.length}</span>
              </p>
            </div>

            {isAdmin && (
              <div className="mb-6">
                <AccentSelector
                  currentAccent={currentAccent}
                  currentVoiceURI={currentVoiceURI}
                  onChange={handleVoiceChange}
                  showVoiceSelection={true}
                />
              </div>
            )}

            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Word List</h3>
                <div className="flex space-x-3">
                  {!isPlaying ? (
                    <button
                      onClick={handlePlayAll}
                      disabled={isPlaying || (!currentVoice && !session)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      <Volume2 size={20} />
                      <span>Play All</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStopAll}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <XCircle size={20} />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isPlaying && currentWordIndex === index
                        ? 'bg-blue-100 border-blue-400 shadow-md'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-500 font-semibold w-8">{index + 1}.</span>
                      <span className="text-lg font-medium text-gray-800">{word}</span>
                    </div>
                    <button
                      onClick={() => handlePlayWord(index)}
                      disabled={isPlaying || (!currentVoice && !session)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${isPlaying && currentWordIndex === index
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                        }`}
                    >
                      <Volume2 size={18} />
                      <span>Play</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Tip:</span> Make sure each word is pronounced correctly.
                Select a specific voice above to ensure consistent pronunciation across all devices.
              </p>
            </div>

            {saveSuccess && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle size={24} className="text-green-600" />
                  <p className="text-green-700 font-medium">
                    Practice saved successfully! You can now assign it to students.
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <XCircle size={24} className="text-red-600" />
                  <p className="text-red-700 font-medium">{saveError}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back to Edit</span>
              </button>

              <div className="flex items-center space-x-3">
                {user?.role === 'admin' && (
                  <button
                    onClick={handleSave}
                    disabled={saving || saveSuccess}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-lg"
                  >
                    <Save size={20} />
                    <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Practice'}</span>
                  </button>
                )}
                <button
                  onClick={onNext}
                  disabled={!currentVoice}
                  className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-lg"
                >
                  <span>Start Practice</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SpellingPreview;
