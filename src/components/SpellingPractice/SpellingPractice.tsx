import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ArrowLeft, CheckCircle, XCircle, Trophy, Undo2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface SpellingPracticeProps {
  title: string;
  words: string[];
  onBack: () => void;
  practiceId?: string;
  assignmentId?: string;
}

const SpellingPractice: React.FC<SpellingPracticeProps> = ({ title, words, onBack, practiceId, assignmentId }) => {
  const { accentPreference, user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const [level, setLevel] = useState<1 | 2>(1);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [clickedLetters, setClickedLetters] = useState<string[]>([]);
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<{ word: string; userAnswer: string; isCorrect: boolean; level: number }[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
    } else {
      speakWord(words[0]);
      initializeShuffledLetters(words[0]);
    }
  }, []);

  const shuffleArray = (array: string[]): string[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const initializeShuffledLetters = (word: string) => {
    const letters = word.split('');
    setShuffledLetters(shuffleArray(letters));
  };

  const speakWord = (word: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = accentPreference;
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  const handlePlayAudio = () => {
    speakWord(words[currentWordIndex]);
  };

  const handleCheck = () => {
    const currentWord = words[currentWordIndex];
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

    const newResult = {
      word: currentWord,
      userAnswer,
      isCorrect: correct,
      level,
    };
    setResults([...results, newResult]);
  };

  const handleNext = async () => {
    if (currentWordIndex < words.length - 1) {
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setUserInput('');
      setClickedLetters([]);
      setShowFeedback(false);
      speakWord(words[nextIndex]);
      initializeShuffledLetters(words[nextIndex]);
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
      word: words[currentWordIndex],
      userAnswer: level === 1 ? clickedLetters.join('') : userInput.trim(),
      isCorrect,
      level,
    }];

    try {
      await supabase.from('spelling_practice_results').insert({
        user_id: user.id,
        practice_id: practiceId || null,
        assignment_id: assignmentId || null,
        title,
        words,
        user_answers: allResults,
        correct_count: correctCount,
        total_count: totalCount,
        accuracy_percentage: accuracyPercentage,
        practice_level: level,
        time_spent_seconds: timeSpentSeconds,
        completed_at: new Date().toISOString(),
      });

      if (assignmentId) {
        const { error: markError } = await supabase.rpc('mark_assignment_complete', {
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
              <h1 className="text-xl md:text-3xl font-bold text-foreground text-center sm:text-left">{title}</h1>
              <span className="text-lg text-muted-foreground font-medium">
                Word {currentWordIndex + 1} of {words.length}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mb-4">
              <Button
                onClick={() => setLevel(1)}
                disabled={showFeedback}
                variant={level === 1 ? "primary" : "secondary"}
                className="w-full sm:w-auto"
              >
                Level 1: Letter Click
              </Button>
              <Button
                onClick={() => setLevel(2)}
                disabled={showFeedback}
                variant={level === 2 ? "primary" : "secondary"}
                className="w-full sm:w-auto"
              >
                Level 2: Typing
              </Button>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${((currentWordIndex + 1) / words.length) * 100}%` }}
              ></div>
            </div>
          </div>

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
                          className="text-3xl font-mono bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
                        >
                          {letter}
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
                        className="text-xl md:text-2xl font-mono bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-md transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {letter}
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
                  The correct spelling is: <span className="font-bold">{words[currentWordIndex]}</span>
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
                {currentWordIndex < words.length - 1 ? 'Next Word' : 'Finish'}
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
        </Card>
      </div>
    </div>
  );
};

export default SpellingPractice;
