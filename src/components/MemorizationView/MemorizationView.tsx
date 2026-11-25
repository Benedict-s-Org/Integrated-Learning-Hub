import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, CheckCircle, XCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Word } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';
import { supabase } from '../../lib/supabase';
import { findBestVoiceMatch, isSpeechSynthesisSupported, createUtterance, fetchCloudAudio } from '../../utils/voiceManager';
import VoiceSettings from '../SpellingPractice/VoiceSettings';

interface MemorizationViewProps {
  words: Word[];
  selectedIndices: number[];
  originalText: string;
  title?: string;
  onBack: () => void;
  onSave: () => void;
  onViewSaved: () => void;
  isPublicView?: boolean;
  assignmentId?: string;
  editingContentId?: string;
}

/** Progressive reveal: all boxed → first/last hint → fully visible. */
type WordRevealStage = 'covered' | 'hint' | 'revealed';

const BOXES_FONT_FAMILY = '"Boxes Longlegs Short f1", sans-serif';

const isChineseChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf) ||
    (code >= 0x2ceb0 && code <= 0x2ebef) ||
    (code >= 0x30000 && code <= 0x3134f)
  );
};

const containsChineseChars = (text: string): boolean => {
  return Array.from(text).some(char => isChineseChar(char));
};

/** English word including internal hyphens (e.g. Mid-Autumn, mother-in-law). */
const isEnglishWord = (text: string): boolean => {
  return /^[A-Za-z]+(?:-[A-Za-z]+)*$/.test(text);
};

/** Box-font cover for English letters. Hyphens stay visible. */
const isEnglishLetterCovered = (word: string, index: number, stage: 'covered' | 'hint'): boolean => {
  if (!isEnglishWord(word)) return false;
  if (!/[A-Za-z]/.test(word[index])) return false;
  if (stage === 'covered') return true;
  // hint: keep first and last characters visible
  return index > 0 && index < word.length - 1;
};

const coveredWordAriaLabel = (word: string, stage: 'covered' | 'hint'): string | undefined => {
  if (isEnglishWord(word)) {
    if (stage === 'covered') return 'Hidden word';
    return `Hidden word starting with ${word[0]} and ending with ${word[word.length - 1]}`;
  }
  if (containsChineseChars(word)) {
    if (stage === 'covered') return 'Hidden word';
    if (word.length <= 2) return undefined;
    return `Hidden word starting with ${word[0]} and ending with ${word[word.length - 1]}`;
  }
  return undefined;
};

const HiddenWordText: React.FC<{ word: string; stage: 'covered' | 'hint' }> = ({ word, stage }) => {
  if (!isEnglishWord(word)) {
    if (containsChineseChars(word)) {
      if (stage === 'covered') {
        return <>{'*'.repeat(word.length)}</>;
      }
      // hint: show first and last characters
      if (word.length <= 2) return <>{word}</>;
      return (
        <>
          {word[0]}
          {'*'.repeat(word.length - 2)}
          {word[word.length - 1]}
        </>
      );
    }
    return <>{word}</>;
  }

  return (
    <>
      {Array.from(word).map((char, index) => {
        if (!isEnglishLetterCovered(word, index, stage)) {
          return <span key={index}>{char}</span>;
        }
        return (
          <span key={index} style={{ fontFamily: BOXES_FONT_FAMILY }}>
            {char}
          </span>
        );
      })}
    </>
  );
};

const nextRevealStage = (stage: WordRevealStage): WordRevealStage => {
  if (stage === 'covered') return 'hint';
  if (stage === 'hint') return 'revealed';
  return 'covered';
};

const MemorizationView: React.FC<MemorizationViewProps> = ({
  words, selectedIndices, originalText, title, onBack, onSave, onViewSaved, isPublicView = false, assignmentId, editingContentId
}) => {
  const { addSavedContent, updateSavedContent, saveLimit, currentSaveCount } = useAppContext();
  const { user, isAdmin, accentPreference, voicePreference, updateVoicePreference } = useAuth();

  const [wordRevealStages, setWordRevealStages] = useState<Map<number, WordRevealStage>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const startTimeRef = useRef<number>(Date.now());
  const sessionSavedRef = useRef<boolean>(false);

  // Audio control state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [speechSupported, setSpeechSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!sessionSavedRef.current && user && !isPublicView) {
        saveSession();
      }
    };
  }, []);

  // Load saved speed preference and check speech support
  useEffect(() => {
    const savedSpeed = localStorage.getItem('memorization-tts-speed');
    if (savedSpeed) {
      setPlaybackSpeed(parseFloat(savedSpeed));
    }
    setSpeechSupported(isSpeechSynthesisSupported());
  }, []);

  // Cleanup speech synthesis on unmount or navigation
  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        isStoppingRef.current = true;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const saveSession = async () => {
    if (!user || sessionSavedRef.current || isPublicView) return;
    sessionSavedRef.current = true;

    const sessionDurationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const sessionTitle = title?.trim() || (originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''));

    try {
      // Use SECURITY DEFINER RPC to guarantee the insert succeeds regardless
      // of RLS policy edge cases (RLS blocks return {error:null} silently).
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'save_memorization_session',
        {
          p_assignment_id:            assignmentId || null,
          p_title:                    sessionTitle,
          p_original_text:            originalText,
          p_total_words:              words.length,
          p_hidden_words_count:       selectedIndices.length,
          p_session_duration_seconds: sessionDurationSeconds,
          p_completed_at:             new Date().toISOString(),
        }
      );

      if (rpcError) {
        console.error('Error saving memorization session:', rpcError);
      } else if (rpcData && rpcData.success === false) {
        console.error('save_memorization_session RPC returned failure:', rpcData.error);
      }

      if (assignmentId) {
        const { error: markError } = await (supabase.rpc('mark_assignment_complete' as any, {
          p_assignment_id: assignmentId,
          p_assignment_type: 'memorization'
        }) as any);

        if (markError) {
          console.error('Error marking memorization assignment complete:', markError);
        }
      }
    } catch (error) {
      console.error('Error in saveSession:', error);
    }
  };

  // Fully reveal all selected words
  const revealAllWords = () => {
    setWordRevealStages(new Map());
  };

  // Fully cover all selected words (every letter boxed)
  const coverAllWords = () => {
    setWordRevealStages(new Map(selectedIndices.map((index) => [index, 'covered'])));
  };

  // covered → hint (first/last) → revealed → covered
  const advanceWordReveal = (index: number) => {
    setWordRevealStages((prev) => {
      const next = new Map(prev);
      const current = next.get(index) ?? 'revealed';
      const advanced = nextRevealStage(current);
      if (advanced === 'revealed') {
        next.delete(index);
      } else {
        next.set(index, advanced);
      }
      return next;
    });
  };

  // Audio control handlers
  const handlePlay = async () => {
    if (!speechSupported) return;

    // Resume if paused (only for browser synthesis)
    if (isPaused && utteranceRef.current) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Stop and clear any current playback
    isStoppingRef.current = true;
    window.speechSynthesis.cancel();
    if (utteranceRef.current) utteranceRef.current = null;
    
    // Stop any HTML5 Audio if playing
    const existingAudios = document.querySelectorAll('audio.tts-audio');
    existingAudios.forEach((a: any) => {
      a.pause();
      a.remove();
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    isStoppingRef.current = false;

    // 1. Try Google Cloud TTS for premium consistency
    try {
      setIsPlaying(true);
      // Pass the selected premium voice URI (which is the actual Google voice ID)
      const premiumVoiceId = voicePreference?.voiceURI;
      const audioDataUri = await fetchCloudAudio(originalText, accentPreference, premiumVoiceId);
      if (audioDataUri && !isStoppingRef.current) {
        console.log('[MemorizationView] Using Google Cloud TTS audio');
        const audio = new Audio(audioDataUri);
        audio.className = 'tts-audio';
        audio.playbackRate = playbackSpeed;
        audio.onended = () => {
          setIsPlaying(false);
          setIsPaused(false);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setIsPaused(false);
        };
        
        // Handle manual pause for HTML5 Audio
        utteranceRef.current = null; // Mark as NOT browser synthesis
        await audio.play();
        return; // Success!
      }
    } catch (err) {
      console.warn('[MemorizationView] Cloud TTS failed, falling back to browser voice:', err);
    }

    // 2. Fallback to Browser native speechSynthesis
    if (isStoppingRef.current) return;
    
    console.log('[MemorizationView] handlePlay: finding best voice match');
    const voice = await findBestVoiceMatch(voicePreference, accentPreference);
    if (!voice) {
      console.warn('[MemorizationView] handlePlay: No voice available');
      setIsPlaying(false);
      return;
    }

    const utterance = createUtterance(originalText, voice);
    utterance.rate = playbackSpeed;

    utterance.onend = () => {
      if (!isStoppingRef.current) {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (utteranceRef.current) {
      // Browser synthesis pause
      if (window.speechSynthesis.speaking && !isPaused) {
        window.speechSynthesis.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
    } else {
      // HTML5 Audio pause (Cloud TTS)
      const audio = document.querySelector('audio.tts-audio') as HTMLAudioElement;
      if (audio && !audio.paused) {
        audio.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
    }
  };

  const handleReplay = () => {
    isStoppingRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setTimeout(() => {
      handlePlay();
    }, 100);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    localStorage.setItem('memorization-tts-speed', speed.toString());

    // If currently playing, restart with new speed
    if (isPlaying || isPaused) {
      handleReplay();
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      setSaveError('You must be logged in to save content');
      return;
    }

    const isUpdating = Boolean(editingContentId);

    if (!isUpdating && !isAdmin && saveLimit !== null && currentSaveCount >= saveLimit) {
      setSaveError(`Save limit reached. You can only save up to ${saveLimit} memorization practices. Please delete an existing practice to save a new one.`);
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const finalTitle = title?.trim() || (originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''));

      const success = isUpdating
        ? await updateSavedContent(editingContentId!, {
            title: finalTitle,
            originalText,
            selectedWordIndices: selectedIndices,
            practiceMode: 'memorization',
          })
        : await addSavedContent({
            title: finalTitle,
            originalText,
            selectedWordIndices: selectedIndices,
            isPublished: false,
            practiceMode: 'memorization',
          });

      if (!success) {
        throw new Error(isUpdating ? 'Failed to update content' : 'Failed to save content');
      }

      setSaveSuccess(true);

      setTimeout(() => {
        onSave();
      }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {!isPublicView && user && (
        <MemorizationTopNav
          onCreateNew={onBack}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className="min-h-screen bg-background"
        data-ui="PAGE-MEMORIZATION"
        data-source-tsx="MemorizationView|src/components/MemorizationView/MemorizationView.tsx"
      >
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 md:py-8">
          <Card className="p-4 md:p-8" data-ui="PANEL-PRACTICE-STAGE">
            <h1
              className="text-xl md:text-3xl font-bold text-foreground mb-2 text-center"
              data-source-tsx="MemorizationView Title|src/components/MemorizationView/MemorizationView.tsx"
            >
              Practice Memorization
            </h1>
            {title && (
              <h2 className="text-lg md:text-xl font-semibold text-blue-600 text-center mb-4 md:mb-6">
                {title}
              </h2>
            )}

            <div className="mb-6 space-y-4">
{/* Hiding difficulty selection as it is now managed at student level
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:space-x-3">
                <div className="flex flex-wrap justify-center items-center gap-2 sm:space-x-2">
                  <span className="text-sm font-medium text-muted-foreground">Difficulty:</span>
                  <Button
                    onClick={() => setDifficultyLevel(1)}
                    variant={difficultyLevel === 1 ? "success" : "secondary"}
                    className="h-9 px-4"
                  >
                    Level 1 (Easy)
                  </Button>
                  <Button
                    onClick={() => setDifficultyLevel(2)}
                    variant={difficultyLevel === 2 ? "gold" : "secondary"}
                    className="h-9 px-4"
                  >
                    Level 2 (Medium)
                  </Button>
                  <Button
                    onClick={() => setDifficultyLevel(3)}
                    variant={difficultyLevel === 3 ? "danger" : "secondary"}
                    className="h-9 px-4"
                  >
                    Level 3 (Hard)
                  </Button>
                </div>
              </div>
              */}

              {speechSupported && (
                <div className="bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-4">
                  <VoiceSettings
                    currentAccent={accentPreference}
                    currentVoiceURI={voicePreference?.voiceURI}
                    onVoiceChange={async (_accent, voiceName, voiceLang, voiceURI) => {
                      await updateVoicePreference(voiceName, voiceLang, voiceURI);
                      if (isPlaying) {
                        handleReplay();
                      }
                    }}
                  />
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 md:space-x-6 pt-4">
                    <div className="flex items-center space-x-3">
                      <Button
                        onClick={handlePlay}
                        disabled={isPlaying}
                        variant="primary"
                        className="rounded-full w-12 h-12 p-0"
                        title="Play"
                      >
                        <Play size={20} fill="currentColor" />
                      </Button>
                      <Button
                        onClick={handlePause}
                        disabled={!isPlaying || isPaused}
                        variant="primary"
                        className="rounded-full w-12 h-12 p-0"
                        title="Pause"
                      >
                        <Pause size={20} fill="currentColor" />
                      </Button>
                      <Button
                        onClick={handleReplay}
                        disabled={!isPlaying && !isPaused}
                        variant="secondary"
                        className="rounded-full w-12 h-12 p-0"
                        title="Replay"
                      >
                        <RotateCcw size={20} />
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-muted-foreground">Speed:</span>
                      <select
                        value={playbackSpeed}
                        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                        className="px-3 py-2 bg-white border border-input rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                      >
                        <option value="0.5">0.5x (Slow)</option>
                        <option value="0.75">0.75x (Moderate)</option>
                        <option value="1">1x (Normal)</option>
                        <option value="1.25">1.25x (Fast)</option>
                        <option value="1.5">1.5x (Very Fast)</option>
                      </select>
                    </div>

                    <div className="text-sm font-medium text-muted-foreground min-w-[60px]">
                      {isPlaying ? 'Playing...' : isPaused ? 'Paused' : 'Ready'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-4">
                <Button
                  onClick={revealAllWords}
                  variant="success"
                  className="h-9"
                >
                  Reveal all Words
                </Button>
                <Button
                  onClick={coverAllWords}
                  variant="primary"
                  className="h-9"
                >
                  Cover all Words
                </Button>
              </div>
            </div>

            {saveSuccess && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle size={24} className="text-green-600" />
                  <p className="text-green-700 font-medium">
                    {editingContentId
                      ? 'Content updated successfully! Redirecting to saved content...'
                      : 'Content saved successfully! Redirecting to saved content...'}
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

            <div className="bg-gray-50 p-6 rounded-lg mb-6 min-h-64">
              <div
                className="text-xl leading-[2.4]"
                data-source-tsx="MemorizationView Text Display|src/components/MemorizationView/MemorizationView.tsx"
              >
                {words.map((word, idx) => {
                  const isMemorized = selectedIndices.includes(word.index);
                  const revealStage: WordRevealStage = wordRevealStages.get(word.index) ?? 'revealed';
                  const isHighlighted = word.highlightGroup !== undefined;
                  // Preserve paragraph / line breaks from original text (same as WordSelection)
                  if (word.isParagraphBreak) {
                    return <div key={`para-break-${idx}`} className="block w-full h-4" aria-hidden="true" />;
                  }

                  if (word.text === '\n' || word.text === '\r\n') {
                    return <br key={`br-${idx}`} />;
                  }

                  // Spaces & punctuation: keep as normal text nodes so whitespace/layout stay intact
                  if (word.isPunctuation) {
                    return (
                      <span
                        key={`punct-${idx}`}
                        className="text-gray-800"
                        data-source-tsx="MemorizationView Punctuation|src/components/MemorizationView/MemorizationView.tsx"
                      >
                        {word.text}
                      </span>
                    );
                  }

                  // Non-selected but highlighted words
                  if (isHighlighted && !isMemorized) {
                    return (
                      <span
                        key={`word-${idx}`}
                        className="inline-block px-1 py-1 bg-yellow-100 text-gray-800 rounded"
                        data-source-tsx="MemorizationView Highlighted Word|src/components/MemorizationView/MemorizationView.tsx"
                      >
                        {word.text}
                      </span>
                    );
                  }

                  if (isMemorized) {
                    const bgColor = isHighlighted ? 'bg-purple-100' : 'bg-green-100';
                    const hoverBgColor = isHighlighted ? 'hover:bg-purple-200' : 'hover:bg-green-200';
                    const isMasked = revealStage === 'covered' || revealStage === 'hint';
                    const ariaLabel = isMasked ? coveredWordAriaLabel(word.text, revealStage) : undefined;

                    return (
                      <button
                        key={`word-${idx}`}
                        onClick={() => advanceWordReveal(word.index)}
                        className={`inline-block px-1 py-1 ${bgColor} text-gray-800 ${hoverBgColor} rounded transition-colors ${ariaLabel ? 'select-none' : ''}`}
                        aria-label={ariaLabel}
                        data-source-tsx="MemorizationView Word Button|src/components/MemorizationView/MemorizationView.tsx"
                      >
                        {isMasked ? (
                          <HiddenWordText word={word.text} stage={revealStage} />
                        ) : (
                          word.text
                        )}
                      </button>
                    );
                  }

                  return (
                    <span
                      key={`word-${idx}`}
                      className="inline-block px-1 py-1 text-gray-800 rounded"
                      data-source-tsx="MemorizationView Word Text|src/components/MemorizationView/MemorizationView.tsx"
                    >
                      {word.text}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 sm:gap-0">
              <Button
                onClick={onBack}
                variant="secondary"
                icon={ArrowLeft}
                className="w-full sm:w-auto"
              >
                {isPublicView ? 'Home' : 'Back'}
              </Button>

              {!isPublicView && user && (
                <div className="flex flex-col items-center sm:items-end space-y-2 w-full sm:w-auto">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || saveSuccess || (!isAdmin && saveLimit !== null && currentSaveCount >= saveLimit)}
                    variant={saveSuccess ? "success" : "primary"}
                    icon={Save}
                    className="w-full sm:w-auto"
                    data-ui="BTN-SAVE-PRACTICE"
                  >
                    {isSaving
                      ? (editingContentId ? 'Updating...' : 'Saving...')
                      : saveSuccess
                        ? (editingContentId ? 'Updated!' : 'Saved!')
                        : (editingContentId ? 'Update' : 'Save')}
                  </Button>
                  {!isAdmin && saveLimit !== null && (
                    <span className="text-sm text-muted-foreground">
                      {currentSaveCount >= saveLimit ? (
                        <span className="text-destructive font-medium">Limit reached ({currentSaveCount}/{saveLimit})</span>
                      ) : (
                        <span>Saved: {currentSaveCount}/{saveLimit}</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div
              className="mt-6 text-sm text-gray-600 text-center space-y-2"
              data-source-tsx="MemorizationView Instructions Container|src/components/MemorizationView/MemorizationView.tsx"
            >
              <p data-source-tsx="MemorizationView Instructions Text|src/components/MemorizationView/MemorizationView.tsx">
                Click a covered word to show its first and last letters • Click again to fully reveal • Click a revealed word to cover it again • Use audio controls to hear the text read aloud
              </p>
              <p className="text-xs text-gray-500">
                Cover all Words hides every letter with boxes • First click shows first and last letters • Second click reveals the full word
              </p>
              {speechSupported && (
                <p className="text-xs text-gray-500">
                  Audio playback uses your selected accent preference • Words are highlighted as they are spoken
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default MemorizationView;