import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ArrowLeft, CheckCircle, XCircle, Trophy, Undo2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useSpellingSrs } from '../../context/SpellingSrsContext';
import { supabase } from '../../lib/supabase';
import { findBestVoiceMatch, createUtterance, fetchCloudAudio } from '../../utils/voiceManager';

interface SpellingPracticeProps {
  title: string;
  words: string[];
  onBack: () => void;
  practiceId?: string;
  assignmentId?: string;
  isPhraseMode?: boolean;
  initialLevel?: number;
  wordLimit?: number; // 10, 20, 40
  isSRSReview?: boolean; // Whether this is an SRS review session
}

const SpellingPractice: React.FC<SpellingPracticeProps> = ({ 
  title, 
  words: rawWords, 
  onBack, 
  practiceId, 
  assignmentId, 
  isPhraseMode, 
  initialLevel,
  wordLimit,
  isSRSReview
}) => {
  const { accentPreference, voicePreference, user } = useAuth();
  const { recordWordAttempt, getWordsDueForReview } = useSpellingSrs();
  const startTimeRef = useRef<number>(Date.now());
  const wordStartTimeRef = useRef<number>(Date.now());
  
  const [practiceWords, setPracticeWords] = useState<string[]>([]);
  const [level, setLevel] = useState<1 | 2>(1);
  const [assignedLevel, setAssignedLevel] = useState<1 | 2>(1);
  const [isManualLevel, setIsManualLevel] = useState(false);

  // Sync level from user profile or props
  useEffect(() => {
    // Only auto-sync if user hasn't manually toggled
    if (!isManualLevel) {
      if (user?.spelling_level) {
        const userLevel = user.spelling_level as 1 | 2;
        setLevel(userLevel);
        setAssignedLevel(userLevel);
      } else if (initialLevel) {
        const initLevel = initialLevel as 1 | 2;
        setLevel(initLevel);
        setAssignedLevel(initLevel);
      }
    }
  }, [user?.spelling_level, initialLevel, isManualLevel]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [clickedLetters, setClickedLetters] = useState<string[]>([]);
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<{ word: string; userAnswer: string; isCorrect: boolean; level: number }[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isWordsLoading, setIsWordsLoading] = useState(true);

  // Helper to shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    const initializePractice = async () => {
      setIsWordsLoading(true);
      let selectedWords: string[] = [];

      if (isSRSReview) {
        // Fetch due words directly to ensure freshness
        const dueWords = await getWordsDueForReview();
        selectedWords = shuffleArray(dueWords);
      } else {
        // Standard practice - shuffle and limit
        selectedWords = shuffleArray(rawWords);
      }

      // Apply limit if specified
      if (wordLimit && selectedWords.length > wordLimit) {
        selectedWords = selectedWords.slice(0, wordLimit);
      }

      setPracticeWords(selectedWords);
      setIsWordsLoading(false);

      if (selectedWords.length > 0) {
        initializeShuffledLetters(selectedWords[0]);
      }
    };

    initializePractice();
  }, [isSRSReview, rawWords, wordLimit]);


  useEffect(() => {
    const initVoice = async () => {
      if (!('speechSynthesis' in window)) {
        setSpeechSupported(false);
        return;
      }

      // Wait for voices to be available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = initVoice;
        return;
      }

      const bestVoice = await findBestVoiceMatch(voicePreference, accentPreference);
      console.log(`[SpellingPractice] initVoice: Found best voice: ${bestVoice?.name} (${bestVoice?.lang})`, { voicePreference, accentPreference });
      setCurrentVoice(bestVoice);
    };

    initVoice();

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voicePreference, accentPreference]);

  useEffect(() => {
    if (speechSupported && practiceWords.length > currentWordIndex && currentVoice) {
      console.log(`[SpellingPractice] Initializing word: ${practiceWords[currentWordIndex]}, Voice current status:`, !!currentVoice);
      speakWord(practiceWords[currentWordIndex]);
      initializeShuffledLetters(practiceWords[currentWordIndex]);
    }
  }, [currentVoice, practiceWords]);


  // shuffleArray was moved outside or into functional scope


  const initializeShuffledLetters = (word: string) => {
    const letters = word.split('');
    setShuffledLetters(shuffleArray(letters));
  };

  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const speakWord = async (word: string) => {
    console.log(`[SpellingPractice] speakWord called for: "${word}"`, { accentPreference });

    // 1. Try Google Cloud TTS for premium consistency
    try {
      // Pass the selected premium voice URI (which is the actual Google voice ID)
      const premiumVoiceId = voicePreference?.voiceURI;
      
      const audioDataUri = await fetchCloudAudio(word, accentPreference, premiumVoiceId);
      if (audioDataUri) {
        console.log('[SpellingPractice] Using Google Cloud TTS audio', { premiumVoiceId });
        const audio = new Audio(audioDataUri);
        // Slightly slower playback was already handled in Edge Function config (speakingRate: 0.9)
        // Set volume and play
        audio.volume = 1;
        await audio.play();
        return; // Success!
      }
    } catch (err) {
      console.warn('[SpellingPractice] Cloud TTS failed, falling back to browser voice:', err);
    }

    // 2. Fallback to Browser native speechSynthesis
    console.log('[SpellingPractice] Using browser-native fallback voice');
    if (!('speechSynthesis' in window) || !currentVoice) {
      console.warn('[SpellingPractice] speakWord: Cannot speak. Synthesis supported:', 'speechSynthesis' in window, 'Voice present:', !!currentVoice);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = createUtterance(word, currentVoice);
    utteranceRef.current = utterance; // Prevent GC

    utterance.onend = () => {
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error('[SpellingPractice] Browser Utterance error:', event);
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleLevel = () => {
    const nextLevel = level === 1 ? 2 : 1;
    setLevel(nextLevel);
    setIsManualLevel(true);
    
    // Reset current word state to avoid confusion
    setUserInput('');
    setClickedLetters([]);
    const currentWord = practiceWords[currentWordIndex];
    if (currentWord) {
      initializeShuffledLetters(currentWord);
    }
  };

  const handlePlayAudio = () => {
    if (practiceWords[currentWordIndex]) {
      speakWord(practiceWords[currentWordIndex]);
    }
  };

  const handleCheck = () => {
    const currentWord = practiceWords[currentWordIndex];
    let correct = false;
    let userAnswer = '';

    if (level === 1) {
      userAnswer = clickedLetters.join('');
      correct = userAnswer.toLowerCase() === currentWord.toLowerCase();
    } else {
      userAnswer = userInput.trim();
      correct = userAnswer.toLowerCase() === currentWord.toLowerCase();
    }

    setIsCorrect(correct);
    setShowFeedback(true);

    const responseTimeMs = Date.now() - wordStartTimeRef.current;
    recordWordAttempt(currentWord, correct, responseTimeMs);

    const newResult = {
      word: currentWord,
      userAnswer,
      isCorrect: correct,
      level,
    };
    setResults([...results, newResult]);
  };

  const handleNext = async () => {
    if (currentWordIndex < practiceWords.length - 1) {
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setUserInput('');
      setClickedLetters([]);
      setShowFeedback(false);
      wordStartTimeRef.current = Date.now();
      speakWord(practiceWords[nextIndex]);
      initializeShuffledLetters(practiceWords[nextIndex]);
    } else {
      await saveResults();
      setIsCompleted(true);
    }
  };

  const saveResults = async () => {
    if (!user) return;

    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const correctCount = results.filter(r => r.isCorrect).length + (isCorrect ? 1 : 0);
    const totalCount = results.length + 1;
    const accuracyPercentage = Math.round((correctCount / totalCount) * 100);

    const allResults = [...results, {
      word: practiceWords[currentWordIndex],
      userAnswer: level === 1 ? clickedLetters.join('') : userInput.trim(),
      isCorrect,
      level,
    }];

    try {
      await (supabase as any).from('spelling_practice_results').insert({
        user_id: user.id,
        practice_id: practiceId || null,
        assignment_id: assignmentId || null,
        title,
        words: practiceWords,
        user_answers: allResults,
        correct_count: correctCount,
        total_count: totalCount,
        accuracy_percentage: accuracyPercentage,
        practice_level: level,
        time_spent_seconds: timeSpentSeconds,
        completed_at: new Date().toISOString(),
        is_srs: isSRSReview || false
      });

      if (assignmentId) {
        const { error: markError } = await (supabase as any).rpc('mark_assignment_complete', {
          p_assignment_id: assignmentId,
          p_assignment_type: 'spelling'
        });

        if (markError) {
          console.error('Error marking assignment complete:', markError);
        }
      }
    } catch (error) {
      console.error('Error saving spelling practice results:', error);
    }
  };

  const handleLetterClick = (letter: string, index: number) => {
    setClickedLetters([...clickedLetters, letter]);
    setShuffledLetters(shuffledLetters.filter((_, i) => i !== index));
  };

  const handleUndo = () => {
    if (clickedLetters.length > 0) {
      const lastLetter = clickedLetters[clickedLetters.length - 1];
      setClickedLetters(clickedLetters.slice(0, -1));
      setShuffledLetters([...shuffledLetters, lastLetter]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showFeedback && userInput.trim()) {
      handleCheck();
    } else if (e.key === 'Enter' && showFeedback) {
      handleNext();
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      handlePlayAudio();
    }
  };

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  if (isWordsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Preparing your words...</p>
        </div>
      </div>
    );
  }

  if (!speechSupported) {
    return (
      <div
        className="min-h-full bg-background p-8"
      >
        <div className="max-w-2xl mx-auto">
          <Card className="p-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Browser Not Supported</h1>
            <p className="text-muted-foreground mb-4">
              Your browser doesn't support text-to-speech functionality. Please use a modern browser like Chrome, Safari, or Edge.
            </p>
            <Button
              onClick={onBack}
              icon={ArrowLeft}
            >
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div
        className="min-h-full bg-background p-8"
      >
        <div className="max-w-3xl mx-auto">
          <Card className="p-8">
            <div className="text-center mb-8">
              <Trophy size={80} className="mx-auto text-yellow-500 mb-4" />
              <h1 className="text-4xl font-bold text-foreground mb-2">Practice Complete!</h1>
              <p className="text-muted-foreground text-lg">Great job working through your spelling words</p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Results</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                  <p className="text-gray-600">Correct</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600">{totalCount - correctCount}</p>
                  <p className="text-gray-600">Incorrect</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{accuracy}%</p>
                  <p className="text-gray-600">Accuracy</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 text-center">
                Practice Level: {results[0]?.level === 1 ? 'Letter Click' : 'Typing'}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground mb-3">Review</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg flex items-center justify-between ${result.isCorrect ? 'bg-green-50' : 'bg-red-50'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      {result.isCorrect ? (
                        <CheckCircle size={20} className="text-green-600" />
                      ) : (
                        <XCircle size={20} className="text-red-600" />
                      )}
                      <span className="font-medium text-gray-800">{result.word}</span>
                    </div>
                    {!result.isCorrect && (
                      <span className="text-sm text-gray-600">
                        Your answer: <span className="line-through">{result.userAnswer}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={onBack}
              className="w-full"
              icon={ArrowLeft}
            >
              Back to Word List
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background p-4 md:p-8"
    >
      <div className="max-w-3xl mx-auto">
        <Card className="p-4 md:p-8">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl md:text-3xl font-bold text-foreground text-center sm:text-left">{title}</h1>
                {isPhraseMode && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200 uppercase tracking-wider">
                    Phrase Mode
                  </span>
                )}
              </div>

              {/* Only allow Level 1 students to switch as per request */}
              {assignedLevel === 1 && !showFeedback && (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => level === 2 && handleToggleLevel()}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      level === 1 ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    LETTER CLICK
                  </button>
                  <button 
                    onClick={() => level === 1 && handleToggleLevel()}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      level === 2 ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    TYPING
                  </button>
                </div>
              )}
            </div>

            {practiceWords.length > 0 ? (
              <div className="space-y-8">
                {currentWordIndex < practiceWords.length ? (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Volume2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-lg text-muted-foreground font-medium">
                          Word {currentWordIndex + 1} of {practiceWords.length}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${((currentWordIndex + 1) / practiceWords.length) * 100}%` }}
                      ></div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {practiceWords.length > 0 ? (
            <div className="space-y-8">
              {currentWordIndex < practiceWords.length ? (
                <>
                  <div className="mb-8">
                    <div className="flex justify-center mb-6">
                      <Button
                        onClick={handlePlayAudio}
                        className="px-8 py-4 h-auto text-xl shadow-lg"
                        icon={Volume2}
                      >
                        Play Word
                      </Button>
                    </div>

                    <p className="hidden sm:block text-center text-sm text-gray-500 mb-6">
                      Keyboard shortcuts: <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl + Space</kbd> to replay
                    </p>

                    {level === 1 ? (
                      <div>
                        <div className="mb-6">
                          <label className="block text-lg font-semibold text-gray-700 mb-3 text-center">
                            Your spelling:
                          </label>
                          <div className="min-h-[80px] px-4 py-4 border-2 border-gray-300 rounded-lg bg-gray-50 flex flex-wrap gap-2 items-center justify-center">
                            {clickedLetters.length > 0 ? (
                              clickedLetters.map((letter, index) => (
                                <span
                                  key={index}
                                  className={`text-3xl font-mono px-4 py-2 rounded-lg shadow-sm border border-gray-200 ${letter === ' ' ? 'bg-blue-50 border-blue-200 w-12 text-center' : 'bg-white'}`}
                                >
                                  {letter === ' ' ? '␣' : letter}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-lg">Click letters below...</span>
                            )}
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-lg font-semibold text-gray-700 mb-3 text-center">
                            Available letters:
                          </label>
                          <div className="flex flex-wrap gap-3 justify-center">
                            {shuffledLetters.map((letter, index) => (
                              <button
                                key={index}
                                onClick={() => handleLetterClick(letter, index)}
                                disabled={showFeedback}
                                className={`text-xl md:text-2xl font-mono px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-md transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${letter === ' ' ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-blue-100 hover:bg-blue-200 text-blue-800'}`}
                              >
                                {letter === ' ' ? 'Space' : letter}
                              </button>
                            ))}
                          </div>
                        </div>

                        {clickedLetters.length > 0 && !showFeedback && (
                          <div className="flex justify-center mb-4">
                            <Button
                              onClick={handleUndo}
                              variant="secondary"
                              icon={Undo2}
                            >
                              Undo
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="spelling-input" className="block text-lg font-semibold text-gray-700 mb-2">
                          Type the spelling:
                        </label>
                        <Input
                          id="spelling-input"
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          disabled={showFeedback}
                          className="w-full text-2xl text-center font-mono py-6"
                          placeholder="Type here..."
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {showFeedback && (
                    <div
                      className={`mb-6 p-6 rounded-xl ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
                        }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        {isCorrect ? (
                          <CheckCircle size={32} className="text-green-600" />
                        ) : (
                          <XCircle size={32} className="text-red-600" />
                        )}
                        <span className={`text-2xl font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                          {isCorrect ? 'Correct!' : 'Incorrect'}
                        </span>
                      </div>
                      {!isCorrect && (
                        <p className="text-gray-700 text-lg">
                          The correct spelling is: <span className="font-bold">{practiceWords[currentWordIndex]}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 sm:gap-0">
                    <Button
                      onClick={onBack}
                      variant="secondary"
                      icon={ArrowLeft}
                      className="w-full sm:w-auto"
                    >
                      Back
                    </Button>

                    {!showFeedback ? (
                      <Button
                        onClick={handleCheck}
                        disabled={level === 1 ? clickedLetters.length === 0 : !userInput.trim()}
                        variant="success"
                        className="w-full sm:w-auto"
                      >
                        Check Spelling
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        variant="primary"
                        className="w-full sm:w-auto"
                      >
                        {currentWordIndex < practiceWords.length - 1 ? 'Next Word' : 'Finish'}
                      </Button>
                    )}
                  </div>

                  {results.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <p className="text-center text-gray-600">
                        Current Score: {correctCount} / {totalCount} ({accuracy}%)
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 mb-4">You have reviewed all {practiceWords.length} words in this session!</p>
                  <Button onClick={saveResults} variant="primary">Finish Practice</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-6 text-center">
                <p className="text-red-600 font-medium">No words found for this practice session.</p>
                <Button onClick={onBack} variant="secondary" className="mt-4">Go Back</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SpellingPractice;
