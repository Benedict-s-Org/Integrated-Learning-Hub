import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, CheckCircle, XCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Word } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';
import { supabase } from '../../lib/supabase';
import { findBestVoiceMatch, isSpeechSynthesisSupported } from '../../utils/voiceManager';

interface MemorizationViewProps {
  words: Word[];
  selectedIndices: number[];
  originalText: string;
  onBack: () => void;
  onSave: () => void;
  onViewSaved: () => void;
  isPublicView?: boolean;
  assignmentId?: string;
}

type DifficultyLevel = 1 | 2 | 3;

const MemorizationView: React.FC<MemorizationViewProps> = ({
  words, selectedIndices, originalText, onBack, onSave, onViewSaved, isPublicView = false, assignmentId
}) => {
  const [hiddenWords, setHiddenWords] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(3);
  const startTimeRef = useRef<number>(Date.now());
  const sessionSavedRef = useRef<boolean>(false);

  // Audio control state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [speechSupported, setSpeechSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStoppingRef = useRef(false);

  const { addSavedContent, saveLimit, currentSaveCount } = useAppContext();
  const { user, isAdmin, accentPreference } = useAuth();

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
    const title = originalText.substring(0, 50) + (originalText.length > 50 ? '...' : '');

    try {
      const { error: sessionError } = await (supabase.from('memorization_practice_sessions' as any).insert({
        user_id: user.id,
        assignment_id: assignmentId || null,
        title,
        original_text: originalText,
        total_words: words.length,
        hidden_words_count: selectedIndices.length,
        session_duration_seconds: sessionDurationSeconds,
        completed_at: new Date().toISOString(),
      }) as any);

      if (sessionError) {
        console.warn('Could not save memorization session (table may be missing):', sessionError);
      }

      if (assignmentId) {
        const { error: markError } = await (supabase.rpc('mark_assignment_complete' as any, {
          p_assignment_id: assignmentId,
          p_assignment_type: 'memorization'
        }) as any);

        if (markError) {
          console.error('Error marking assignment complete:', markError);
        }
      }
    } catch (error) {
      console.error('Error in saveSession:', error);
    }
  };

  // 顯示所有選中詞
  const revealAllWords = () => {
    setHiddenWords(new Set());
  };

  // 遮蔽所有選中詞
  const coverAllWords = () => {
    setHiddenWords(new Set(selectedIndices));
  };

  // 切換指定詞的顯示/隱藏狀態
  const toggleWordVisibility = (index: number) => {
    setHiddenWords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

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

  const isEnglishWord = (text: string): boolean => {
    return /^[A-Za-z]+$/.test(text);
  };

  const maskWord = (word: string, level: DifficultyLevel): string => {
    if (word.length === 0) {
      return word;
    }

    const isChinese = containsChineseChars(word);
    const isEnglish = isEnglishWord(word);

    if (!isChinese && !isEnglish) {
      return word;
    }

    if (isChinese) {
      return '*'.repeat(word.length);
    }

    if (isEnglish) {
      if (level === 3) {
        return '*'.repeat(word.length);
      } else if (level === 2) {
        if (word.length === 1) {
          return word;
        }
        return word[0] + '*'.repeat(word.length - 1);
      } else {
        if (word.length <= 2) {
          return word;
        }
        return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
      }
    }

    return word;
  };

  // Audio control handlers
  const handlePlay = async () => {
    if (!speechSupported) return;

    // Resume if paused
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Stop any current playback
    if (window.speechSynthesis.speaking) {
      isStoppingRef.current = true;
      window.speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    isStoppingRef.current = false;

    // Find the best voice
    const voice = await findBestVoiceMatch(null, accentPreference);
    if (!voice) {
      console.error('No voice available');
      return;
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(originalText);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = playbackSpeed;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Track word boundaries (removed visuals)

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
    if (window.speechSynthesis.speaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
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

    if (!isAdmin && saveLimit !== null && currentSaveCount >= saveLimit) {
      setSaveError(`Save limit reached. You can only save up to ${saveLimit} memorization practices. Please delete an existing practice to save a new one.`);
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const title = originalText.substring(0, 50) + (originalText.length > 50 ? '...' : '');

      const success = await addSavedContent({
        title,
        originalText,
        selectedWordIndices: selectedIndices,
        isPublished: false,
      });

      if (!success) {
        throw new Error('Failed to save content');
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
        data-source-tsx="MemorizationView|src/components/MemorizationView/MemorizationView.tsx"
      >
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 md:py-8">
          <Card className="p-4 md:p-8">
            <h1
              className="text-xl md:text-3xl font-bold text-foreground mb-4 md:mb-6 text-center"
              data-source-tsx="MemorizationView Title|src/components/MemorizationView/MemorizationView.tsx"
            >
              Practice Memorization
            </h1>

            <div className="mb-6 space-y-4">
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

              {speechSupported && (
                <div className="bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-4">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 md:space-x-6">
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
                    Content saved successfully! Redirecting to saved content...
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
                className="text-xl leading-relaxed"
                data-source-tsx="MemorizationView Text Display|src/components/MemorizationView/MemorizationView.tsx"
              >
                {words.map((word, idx) => {
                  const isMemorized = selectedIndices.includes(word.index);
                  const isHidden = hiddenWords.has(word.index);
                  const isHighlighted = word.highlightGroup !== undefined;
                  if (word.isParagraphBreak) {
                    return <div key={`para-break-${word.index}`} className="mb-4" />;
                  }

                  if (word.text === '\n' || word.text === '\r\n') {
                    return <br key={word.index} />;
                  }

                  // Non-selected but highlighted words
                  if (isHighlighted && !isMemorized) {
                    return (
                      <span
                        key={idx}
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

                    const displayText = isHidden ? maskWord(word.text, difficultyLevel) : word.text;

                    return (
                      <button
                        key={idx}
                        onClick={() => toggleWordVisibility(word.index)}
                        className={`inline-block px-1 py-1 ${bgColor} text-gray-800 ${hoverBgColor} rounded transition-colors`}
                        data-source-tsx="MemorizationView Word Button|src/components/MemorizationView/MemorizationView.tsx"
                      >
                        {displayText}
                      </button>
                    );
                  } else {
                    return (
                      <span
                        key={idx}
                        className="inline-block px-1 py-1 text-gray-800 rounded"
                        data-source-tsx="MemorizationView Word Text|src/components/MemorizationView/MemorizationView.tsx"
                      >
                        {word.text}
                      </span>
                    );
                  }
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
                  >
                    {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
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
                Click masked words to reveal them • Click revealed words to hide them again • Use audio controls to hear the text read aloud
              </p>
              <p className="text-xs text-gray-500">
                Level 1: Show first & last letters (e.g., l****r) • Level 2: Show first letter only (e.g., l*****) • Level 3: Hide all letters (e.g., ******)
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