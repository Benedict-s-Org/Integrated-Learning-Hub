import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
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
  const { user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const [parsedSentences, setParsedSentences] = useState<ProofreadingSentence[]>([]);
  const [selectedWords, setSelectedWords] = useState<Map<number, number>>(new Map());
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [showResults, setShowResults] = useState(isPreview);
  const [correctAnswers, setCorrectAnswers] = useState<Map<number, { wordIndex: number; correction: string }>>(new Map());

  useEffect(() => {
    const parsed = sentences.map((sentence, lineNumber) => {
      const words: ProofreadingWord[] = [];
      const tokens = sentence.match(/\S+|\s+/g) || [];
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
        text: sentence,
        lineNumber,
        words,
      };
    });

    setParsedSentences(parsed);

    const answerMap = new Map();
    answers.forEach(answer => {
      answerMap.set(answer.lineNumber, {
        wordIndex: answer.wordIndex,
        correction: answer.correction,
      });
    });
    setCorrectAnswers(answerMap);
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
  };

  const handleCorrectionChange = (lineNumber: number, value: string) => {
    setCorrections(prev => {
      const newMap = new Map(prev);
      newMap.set(lineNumber, value);
      return newMap;
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

    const userAnswersList = Array.from(selectedWords.entries()).map(([lineNumber, wordIndex]) => ({
      lineNumber,
      wordIndex,
      correction: corrections.get(lineNumber) || '',
    }));

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
        completed_at: new Date().toISOString(),
      };

      if (practiceId) {
        insertData.practice_id = practiceId;
      }

      if (assignmentId) {
        insertData.assignment_id = assignmentId;
      }

      await supabase.from('proofreading_practice_results').insert(insertData);

      if (assignmentId) {
        await supabase
          .from('proofreading_practice_assignments')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', assignmentId);
      }
    } catch (error) {
      console.error('Error saving proofreading practice results:', error);
    }
  };

  const handleReset = () => {
    if (!isPreview) {
      setSelectedWords(new Map());
      setCorrections(new Map());
      setShowResults(false);
      startTimeRef.current = Date.now();
    }
  };

  const hasAllAnswers = () => {
    for (const lineNumber of selectedWords.keys()) {
      const correction = corrections.get(lineNumber);
      if (!correction || correction.trim().length === 0) {
        return false;
      }
    }
    return selectedWords.size > 0;
  };

  const isAnswerCorrect = (lineNumber: number): boolean | null => {
    if (!showResults) return null;

    const correctAnswer = correctAnswers.get(lineNumber);
    if (!correctAnswer) return null;

    const userSelectedWord = selectedWords.get(lineNumber);
    const userCorrection = corrections.get(lineNumber);

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
          onCreateNew={() => {}}
          onViewSaved={onViewSaved}
          currentView="saved"
        />
      )}
      <div
        className="pt-20 min-h-screen bg-gray-50 pr-8"
        style={{ fontFamily: 'Times New Roman, serif' }}
        data-source-tsx="ProofreadingPractice|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
      >
      <div className="max-w-[95%] mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1
            className="text-3xl font-bold text-gray-800 mb-6 text-center"
            data-source-tsx="ProofreadingPractice Title|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
          >
            Find and Correct Mistakes
          </h1>

          <div className="mb-6 text-center text-gray-600">
            <p>Click on the word that contains a mistake in each sentence, then enter the correction.</p>
          </div>

          <div className="overflow-x-auto mb-8">
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
                      className={`hover:bg-gray-50 ${
                        showResults && isCorrect === true
                          ? 'bg-green-50'
                          : showResults && isCorrect === false
                          ? 'bg-red-50'
                          : ''
                      }`}
                      data-source-tsx="ProofreadingPractice Table Row|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                    >
                      <td className="border border-gray-300 px-4 py-3 text-center font-medium text-gray-700">
                        {sentence.lineNumber + 1}
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
                                className={`inline-block px-1 py-1 rounded transition-colors ${
                                  isSelected
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
                          <input
                            type="text"
                            value={correction}
                            onChange={(e) => handleCorrectionChange(sentence.lineNumber, e.target.value)}
                            disabled={showResults || isPreview}
                            placeholder="Type correction"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                            data-source-tsx="ProofreadingPractice Answer Input|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                          />
                          {showResults && correctAnswer && (
                            <div className="flex-shrink-0">
                              {isCorrect === true ? (
                                <Check className="text-green-600" size={24} />
                              ) : (
                                <X className="text-red-600" size={24} />
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

          <div className="flex justify-between items-center">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-8 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              data-source-tsx="ProofreadingPractice Back Button|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>

            <div className="flex space-x-4">
              {showResults && !isPreview && (
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-8 py-3 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                  data-source-tsx="ProofreadingPractice Reset Button|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                >
                  <span>Try Again</span>
                </button>
              )}

              {!showResults && !isPreview && (
                <button
                  onClick={handleCheckAnswers}
                  disabled={!hasAllAnswers()}
                  className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  data-source-tsx="ProofreadingPractice Check Button|src/components/ProofreadingPractice/ProofreadingPractice.tsx"
                >
                  <Check size={20} />
                  <span>Check Answers</span>
                </button>
              )}
            </div>
          </div>

          {showResults && (() => {
            const { correctCount, totalQuestions, percentage } = calculateScore();

            return (
              <div className={`mt-6 p-4 border rounded-lg ${
                percentage >= 70 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <p className={`text-center font-medium text-lg ${
                  percentage >= 70 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Score: {correctCount} / {totalQuestions} ({percentage}%)
                </p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
    </>
  );
};

export default ProofreadingPractice;
