import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, Lightbulb, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { ProofreadingSentence, ProofreadingWord, ProofreadingAnswer } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';

interface ProofreadingPracticeProps {
  sentences: string[];
  answers: ProofreadingAnswer[];
  onBack: () => void;
  practiceId?: string;
  assignmentId?: string;
  onViewSaved?: () => void;
  isPreview?: boolean;
}

const ProofreadingPractice: React.FC<ProofreadingPracticeProps> = ({
  sentences,
  answers,
  onBack,
  practiceId,
  assignmentId,
  onViewSaved,
  isPreview = false
}) => {
  const { user, isAdmin } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const [parsedSentences, setParsedSentences] = useState<ProofreadingSentence[]>([]);
  const [selectedWords, setSelectedWords] = useState<Map<number, number>>(new Map());
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [showResults, setShowResults] = useState(isPreview);
  const [correctAnswers, setCorrectAnswers] = useState<Map<number, { wordIndex: number; correction: string; tip?: string }>>(new Map());
  const [revealedTips, setRevealedTips] = useState<Set<number>>(new Set());
  const [notSureLines, setNotSureLines] = useState<Set<number>>(new Set());
  const [isParsing, setIsParsing] = useState(true);

  useEffect(() => {
    if (!Array.isArray(sentences)) {
      console.error('ProofreadingPractice: sentences prop is not an array', sentences);
      setParsedSentences([]);
      setIsParsing(false);
      return;
    }

    setIsParsing(true);
    try {
      const parsed = sentences.map((sentence, lineNumber) => {
        const words: ProofreadingWord[] = [];
        // Safety check for sentence being a string
        const safeSentence = typeof sentence === 'string' ? sentence : String(sentence || '');
        const tokens = safeSentence.match(/\S+|\s+/g) || [];
        let wordIndex = 0;

        tokens.forEach(token => {
          if (token.trim().length > 0) {
            const isPunctuation = /^[^\w]+$/.test(token);
            words.push({
              text: token,
              index: wordIndex,
              isSelected: false,
              isPunctuation,
            });
            wordIndex++;
          } else {
            words.push({
              text: token,
              index: -1,
              isSelected: false,
              isPunctuation: true,
            });
          }
        });

        return {
          text: safeSentence,
          lineNumber,
          words,
        };
      });

      setParsedSentences(parsed);

      const answerMap = new Map();
      if (Array.isArray(answers)) {
        answers.forEach(answer => {
          if (answer && typeof answer.lineNumber === 'number') {
            answerMap.set(answer.lineNumber, {
              wordIndex: answer.wordIndex,
              correction: answer.correction,
              tip: answer.tip,
            });
          }
        });
      }
      setCorrectAnswers(answerMap);
    } catch (err) {
      console.error('Error parsing proofreading sentences:', err);
    } finally {
      setIsParsing(false);
    }
  }, [sentences, answers]);

  const handleWordClick = (lineNumber: number, wordIndex: number) => {
    if (showResults || isPreview) return;

    setSelectedWords(prev => {
      const newMap = new Map(prev);
      if (newMap.get(lineNumber) === wordIndex) {
        newMap.delete(lineNumber);
        setCorrections(prevCorrections => {
          const newCorrections = new Map(prevCorrections);
          newCorrections.delete(lineNumber);
          return newCorrections;
        });
      } else {
        newMap.set(lineNumber, wordIndex);
      }
      return newMap;
    });

    // Clear "Not Sure" if user selects a word
    setNotSureLines(prev => {
      if (prev.has(lineNumber)) {
        const newSet = new Set(prev);
        newSet.delete(lineNumber);
        return newSet;
      }
      return prev;
    });
  };

  const handleCorrectionChange = (lineNumber: number, value: string) => {
    setCorrections(prev => {
      const newMap = new Map(prev);
      newMap.set(lineNumber, value);
      return newMap;
    });
    // Clear "Not Sure" if user starts typing
    setNotSureLines(prev => {
      if (prev.has(lineNumber)) {
        const newSet = new Set(prev);
        newSet.delete(lineNumber);
        return newSet;
      }
      return prev;
    });
  };

  const handleNotSureToggle = (lineNumber: number) => {
    if (showResults || isPreview) return;

    setNotSureLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
        // Clear selection and correction if marking as Not Sure
        setSelectedWords(prevSelected => {
          const newMap = new Map(prevSelected);
          newMap.delete(lineNumber);
          return newMap;
        });
        setCorrections(prevCorrections => {
          const newCorrections = new Map(prevCorrections);
          newCorrections.delete(lineNumber);
          return newCorrections;
        });
      }
      return newSet;
    });
  };

  const handleCheckAnswers = async () => {
    setShowResults(true);
    if (!isPreview) {
      await saveResults();
    }
  };

  const saveResults = async () => {
    if (!user) return;

    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const { correctCount, totalQuestions, percentage } = calculateScore();

    const userAnswersList = parsedSentences.map((sentence) => {
      const lineNumber = sentence.lineNumber;
      return {
        lineNumber,
        wordIndex: selectedWords.get(lineNumber),
        correction: corrections.get(lineNumber) || '',
        isNotSure: notSureLines.has(lineNumber),
      };
    });

    try {
      const insertData: any = {
        user_id: user.id,
        sentences,
        correct_answers: answers,
        user_answers: userAnswersList,
        correct_count: correctCount,
        total_count: totalQuestions,
        accuracy_percentage: percentage,
        time_spent_seconds: timeSpentSeconds,
        tips_used: Array.from(revealedTips),
        completed_at: new Date().toISOString(),
      };

      if (practiceId) {
        insertData.practice_id = practiceId;
      }

      if (assignmentId) {
        insertData.assignment_id = assignmentId;
      }

      const { error: insertError } = await (supabase.from('proofreading_practice_results' as any) as any).insert(insertData);

      if (insertError) {
        console.error('Error saving proofreading practice results:', insertError);
      }

      if (assignmentId) {
        const { error: updateError } = await supabase
          .from('proofreading_practice_assignments')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', assignmentId);

        if (updateError) {
          console.error('Error updating proofreading assignment:', updateError);
        }
      }
    } catch (error) {
      console.error('Unexpected error saving proofreading practice results:', error);
    }
  };

  const handleReset = () => {
    if (!isPreview) {
      setSelectedWords(new Map());
      setCorrections(new Map());
      setShowResults(false);
      setRevealedTips(new Set());
      startTimeRef.current = Date.now();
    }
  };


  const isAnswerCorrect = (lineNumber: number): boolean | null => {
    if (!showResults) return null;

    const correctAnswer = correctAnswers.get(lineNumber);
    if (!correctAnswer) return null;

    const userSelectedWord = selectedWords.get(lineNumber);
    const userCorrection = corrections.get(lineNumber);
    const isNotSure = notSureLines.has(lineNumber);

    if (isNotSure) return false;

    return (
      userSelectedWord === correctAnswer.wordIndex &&
      userCorrection?.trim().toLowerCase() === correctAnswer.correction.trim().toLowerCase()
    );
  };

  const calculateScore = () => {
    const totalQuestions = correctAnswers.size;
    let correctCount = 0;
    correctAnswers.forEach((_, lineNumber) => {
      if (isAnswerCorrect(lineNumber) === true) {
        correctCount++;
      }
    });
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    return { correctCount, totalQuestions, percentage };
  };

  return (
    <>
      {onViewSaved && !isPreview && (
        <ProofreadingTopNav
          onCreateNew={() => { }}
          onViewSaved={onViewSaved}
          currentView="saved"
        />
      )}
      <div
        className="min-h-screen bg-background"
        data-source-tsx="ProofreadingPractice|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
      >
        <div className="max-w-[95%] md:max-w-6xl mx-auto px-4 py-4 md:py-8">
          <Card className="p-4 md:p-8">
            <h1
              className="text-3xl font-bold text-foreground mb-6 text-center"
              data-source-tsx="ProofreadingPractice Title|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
            >
              Find and Correct Mistakes
            </h1>

            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse">Preparing your exercise...</p>
              </div>
            ) : parsedSentences.length === 0 ? (
              <div className="text-center py-20">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">Failed to load content</h2>
                <p className="text-muted-foreground mb-6">There was an issue loading the proofreading sentences.</p>
                <Button onClick={onBack} variant="secondary">Go Back</Button>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center text-muted-foreground">
                  <p>Click on the word that contains a mistake in each sentence, then enter the correction.</p>
                </div>

                <div className="overflow-x-auto mb-8 hidden md:block">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-24">
                          Question No.
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                          Question
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-64">
                          Answer
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-48">
                          Correct Answer
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedSentences.map((sentence) => {
                        const selectedWordIndex = selectedWords.get(sentence.lineNumber);
                        const correction = corrections.get(sentence.lineNumber) || '';
                        const correctAnswer = correctAnswers.get(sentence.lineNumber);
                        const isCorrect = isAnswerCorrect(sentence.lineNumber);

                        return (
                          <tr
                            key={sentence.lineNumber}
                            className={`hover:bg-gray-50 ${showResults && isCorrect === true
                              ? 'bg-green-50'
                              : showResults && isCorrect === false
                                ? 'bg-red-50'
                                : ''
                              }`}
                            data-source-tsx="ProofreadingPractice Table Row|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                          >
                            <td className="border border-gray-300 px-4 py-3 text-center font-medium text-gray-700 relative group">
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <span>{sentence.lineNumber + 1}</span>
                                {correctAnswer?.tip && !showResults && (isPreview || isAdmin || user?.proofreading_level === 1) && (
                                  <button
                                    onClick={() => setRevealedTips(prev => new Set(prev).add(sentence.lineNumber))}
                                    className={`p-1 rounded-full transition-colors ${revealedTips.has(sentence.lineNumber)
                                      ? 'text-yellow-600 bg-yellow-100'
                                      : 'text-blue-500 hover:bg-blue-50'
                                      }`}
                                    title="Show Tip"
                                  >
                                    <Lightbulb size={16} />
                                  </button>
                                )}
                              </div>
                              {revealedTips.has(sentence.lineNumber) && correctAnswer?.tip && !showResults && (isPreview || isAdmin || user?.proofreading_level === 1) && (
                                <div className="absolute left-full top-0 ml-2 z-10 w-48 p-2 bg-yellow-50 border border-yellow-200 rounded shadow-sm text-xs text-yellow-800 italic text-left">
                                  Tip: {correctAnswer.tip}
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-3">
                              <div className="text-lg leading-relaxed">
                                {sentence.words.map((word, idx) => {
                                  if (word.index === -1) {
                                    return (
                                      <span key={`space-${idx}`} className="text-gray-800">
                                        {word.text}
                                      </span>
                                    );
                                  }

                                  const isSelected = selectedWordIndex === word.index;
                                  const isClickable = !word.isPunctuation && !showResults && !isPreview;

                                  return (
                                    <button
                                      key={`word-${idx}`}
                                      onClick={() => !word.isPunctuation && handleWordClick(sentence.lineNumber, word.index)}
                                      disabled={!isClickable}
                                      className={`inline-block px-1 py-1 rounded transition-colors ${isSelected
                                        ? 'bg-red-200 text-gray-800'
                                        : isClickable
                                          ? 'hover:bg-blue-100 cursor-pointer text-gray-800'
                                          : 'text-gray-800 cursor-default'
                                        }`}
                                      data-source-tsx="ProofreadingPractice Word Button|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                                    >
                                      {word.text}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="text"
                                  value={notSureLines.has(sentence.lineNumber) ? '不知道 (Not Sure)' : correction}
                                  onChange={(e) => handleCorrectionChange(sentence.lineNumber, e.target.value)}
                                  disabled={showResults || isPreview || notSureLines.has(sentence.lineNumber)}
                                  placeholder={notSureLines.has(sentence.lineNumber) ? '' : "Type correction"}
                                  className={`flex-1 ${notSureLines.has(sentence.lineNumber) ? 'bg-gray-100 italic text-gray-500' : ''}`}
                                  data-source-tsx="ProofreadingPractice Answer Input|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                                />
                                {!showResults && !isPreview && (
                                  <button
                                    onClick={() => handleNotSureToggle(sentence.lineNumber)}
                                    className={`p-2 rounded-md border transition-colors ${notSureLines.has(sentence.lineNumber)
                                      ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                      : 'bg-white border-gray-300 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                      }`}
                                    title="I'm not sure"
                                  >
                                    <span className="text-xs font-bold">不知道</span>
                                  </button>
                                )}
                                {showResults && (
                                  <div className="flex-shrink-0 flex items-center space-x-1">
                                    {notSureLines.has(sentence.lineNumber) && (
                                      <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100">
                                        Not Sure
                                      </span>
                                    )}
                                    {correctAnswer && (
                                      isCorrect === true ? (
                                        <Check className="text-green-600" size={24} />
                                      ) : (
                                        <X className="text-red-600" size={24} />
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              {showResults && correctAnswer ? (
                                <span className="text-blue-700 font-medium">
                                  {correctAnswer.correction}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Hidden</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-6 mb-8">
                  {parsedSentences.map((sentence) => {
                    const selectedWordIndex = selectedWords.get(sentence.lineNumber);
                    const correction = corrections.get(sentence.lineNumber) || '';
                    const correctAnswer = correctAnswers.get(sentence.lineNumber);
                    const isCorrect = isAnswerCorrect(sentence.lineNumber);

                    return (
                      <div
                        key={sentence.lineNumber}
                        className={`bg-white border rounded-lg p-4 shadow-sm ${showResults && isCorrect === true
                          ? 'border-green-200 bg-green-50/30'
                          : showResults && isCorrect === false
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-gray-200'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                          <span className="font-semibold text-gray-500 text-sm">Question {sentence.lineNumber + 1}</span>
                          {correctAnswer?.tip && !showResults && (isPreview || isAdmin || user?.proofreading_level === 1) && (
                            <div className="relative">
                              <button
                                onClick={() => {
                                  const newSet = new Set(revealedTips);
                                  if (newSet.has(sentence.lineNumber)) {
                                    newSet.delete(sentence.lineNumber);
                                  } else {
                                    newSet.add(sentence.lineNumber);
                                  }
                                  setRevealedTips(newSet);
                                }}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${revealedTips.has(sentence.lineNumber)
                                  ? 'text-yellow-700 bg-yellow-100'
                                  : 'text-blue-600 bg-blue-50'
                                  }`}
                              >
                                <Lightbulb size={12} />
                                {revealedTips.has(sentence.lineNumber) ? 'Hide Tip' : 'Show Tip'}
                              </button>
                              {revealedTips.has(sentence.lineNumber) && (
                                <div className="absolute right-0 top-full mt-2 z-10 w-48 p-2 bg-yellow-50 border border-yellow-200 rounded shadow-md text-xs text-yellow-800 italic text-left">
                                  {correctAnswer.tip}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mb-4 text-lg leading-relaxed">
                          {sentence.words.map((word, idx) => {
                            if (word.index === -1) {
                              return <span key={`space-${idx}`} className="text-gray-800">{word.text}</span>;
                            }

                            const isSelected = selectedWordIndex === word.index;
                            const isClickable = !word.isPunctuation && !showResults && !isPreview;

                            return (
                              <button
                                key={`word-${idx}`}
                                onClick={() => !word.isPunctuation && handleWordClick(sentence.lineNumber, word.index)}
                                disabled={!isClickable}
                                className={`inline-block px-1 py-0.5 rounded transition-colors ${isSelected
                                  ? 'bg-red-200 text-gray-800'
                                  : isClickable
                                    ? 'active:bg-blue-100 text-gray-800 decoration-dotted decoration-gray-400 underline-offset-4 hover:underline'
                                    : 'text-gray-800'
                                  }`}
                              >
                                {word.text}
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Your Correction:</label>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                value={notSureLines.has(sentence.lineNumber) ? '不知道 (Not Sure)' : correction}
                                onChange={(e) => handleCorrectionChange(sentence.lineNumber, e.target.value)}
                                disabled={showResults || isPreview || notSureLines.has(sentence.lineNumber)}
                                placeholder={notSureLines.has(sentence.lineNumber) ? '' : "Type correction..."}
                                className={`flex-1 bg-white ${notSureLines.has(sentence.lineNumber) ? 'bg-gray-100 italic text-gray-500' : ''}`}
                              />
                              {!showResults && !isPreview && (
                                <button
                                  onClick={() => handleNotSureToggle(sentence.lineNumber)}
                                  className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${notSureLines.has(sentence.lineNumber)
                                    ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                    : 'bg-white border-gray-300 text-gray-500 active:bg-gray-50'
                                    }`}
                                >
                                  不知道
                                </button>
                              )}
                              {showResults && (
                                <div className="flex-shrink-0 flex items-center justify-center w-10 gap-1">
                                  {notSureLines.has(sentence.lineNumber) && (
                                    <span className="text-[10px] font-medium text-yellow-600 bg-yellow-50 px-1 py-0.5 rounded border border-yellow-100">
                                      ?
                                    </span>
                                  )}
                                  {correctAnswer && (
                                    isCorrect === true ? (
                                      <Check className="text-green-600" size={24} />
                                    ) : (
                                      <X className="text-red-600" size={24} />
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {showResults && correctAnswer && (
                            <div className="pt-2 border-t border-gray-200">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Correct Answer:</label>
                              <span className="text-blue-700 font-medium">
                                {correctAnswer.correction}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between items-center mt-6 gap-4 sm:gap-0">
                  <Button
                    onClick={onBack}
                    variant="secondary"
                    icon={ArrowLeft}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>

                  <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4 w-full sm:w-auto">
                    {showResults && !isPreview && (
                      <Button
                        onClick={handleReset}
                        variant="gold"
                        className="w-full sm:w-auto"
                      >
                        Try Again
                      </Button>
                    )}

                    {!showResults && !isPreview && (
                      <Button
                        onClick={handleCheckAnswers}
                        variant="success"
                        icon={Check}
                        className="w-full sm:w-auto"
                      >
                        Check Answers
                      </Button>
                    )}
                  </div>
                </div>

                {showResults && (() => {
                  const { correctCount, totalQuestions, percentage } = calculateScore();

                  return (
                    <div className={`mt-6 p-4 border rounded-lg ${percentage >= 70 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                      }`}>
                      <p className={`text-center font-medium text-lg ${percentage >= 70 ? 'text-green-800' : 'text-yellow-800'
                        }`}>
                        Score: {correctCount} / {totalQuestions} ({percentage}%)
                      </p>
                    </div>
                  );
                })()}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default ProofreadingPractice;
