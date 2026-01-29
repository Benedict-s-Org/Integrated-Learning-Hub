import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, CheckCircle, XCircle } from 'lucide-react';
import { ProofreadingSentence, ProofreadingWord, ProofreadingAnswer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';

interface ProofreadingPreviewProps {
  sentences: string[];
  answers: ProofreadingAnswer[];
  onNext: () => void;
  onBack: () => void;
  onViewSaved?: () => void;
}

const ProofreadingPreview: React.FC<ProofreadingPreviewProps> = ({
  sentences,
  answers,
  onNext,
  onBack,
  onViewSaved,
}) => {
  const { user } = useAuth();
  const [parsedSentences, setParsedSentences] = useState<ProofreadingSentence[]>([]);
  const [selectedWords, setSelectedWords] = useState<Map<number, number>>(new Map());
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState<Map<number, { wordIndex: number; correction: string }>>(new Map());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [practiceTitle, setPracticeTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    if (showResults) return;

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

  const handleSubmitTest = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setSelectedWords(new Map());
    setCorrections(new Map());
    setShowResults(false);
  };

  const getResultForLine = (lineNumber: number) => {
    if (!showResults) return null;

    const correctAnswer = correctAnswers.get(lineNumber);
    if (!correctAnswer) return null;

    const selectedWordIndex = selectedWords.get(lineNumber);
    const correction = corrections.get(lineNumber) || '';

    const wordCorrect = selectedWordIndex === correctAnswer.wordIndex;
    const correctionCorrect = correction.trim().toLowerCase() === correctAnswer.correction.trim().toLowerCase();

    return {
      isCorrect: wordCorrect && correctionCorrect,
      wordCorrect,
      correctionCorrect,
    };
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const handleSaveConfirm = async () => {
    if (!practiceTitle.trim()) {
      setSaveError('Please enter a practice title.');
      return;
    }

    if (!user?.id) {
      setSaveError('You must be logged in to save practices');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-practices/create`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: practiceTitle.trim(),
          sentences,
          answers,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save practice');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setShowSaveModal(false);
        setPracticeTitle('');
        setSaveError(null);
      }, 1500);
    } catch (error) {
      console.error('Error saving practice:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save practice');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {onViewSaved && (
        <ProofreadingTopNav
          onCreateNew={onBack}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className="pt-20 min-h-screen bg-gray-50 pr-8"
        style={{ fontFamily: 'Times New Roman, serif' }}
        data-source-tsx="ProofreadingPreview|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
      >
        <div className="max-w-[95%] mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <CheckCircle size={40} className="text-green-600" />
                <h1 className="text-3xl font-bold text-gray-800">Preview & Test</h1>
              </div>
              <p className="text-gray-600">
                Test the proofreading exercise below to make sure it works correctly before saving
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
                      Your Answer
                    </th>
                    {showResults && (
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-48">
                        Result
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedSentences.map((sentence) => {
                    const selectedWordIndex = selectedWords.get(sentence.lineNumber);
                    const correction = corrections.get(sentence.lineNumber) || '';
                    const result = getResultForLine(sentence.lineNumber);
                    const correctAnswer = correctAnswers.get(sentence.lineNumber);

                    return (
                      <tr
                        key={sentence.lineNumber}
                        className="hover:bg-gray-50"
                        data-source-tsx="ProofreadingPreview Table Row|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
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
                              const isCorrectWord = showResults && correctAnswer?.wordIndex === word.index;
                              const isClickable = !word.isPunctuation && !showResults;

                              let className = 'inline-block px-1 py-1 rounded transition-colors ';
                              if (showResults && isCorrectWord) {
                                className += 'bg-green-200 text-gray-800';
                              } else if (isSelected) {
                                className += 'bg-red-200 text-gray-800';
                              } else if (isClickable) {
                                className += 'hover:bg-blue-100 cursor-pointer text-gray-800';
                              } else {
                                className += 'text-gray-800 cursor-default';
                              }

                              return (
                                <button
                                  key={`word-${idx}`}
                                  onClick={() => !word.isPunctuation && handleWordClick(sentence.lineNumber, word.index)}
                                  disabled={!isClickable}
                                  className={className}
                                  data-source-tsx="ProofreadingPreview Word Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                                >
                                  {word.text}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <input
                            type="text"
                            value={correction}
                            onChange={(e) => handleCorrectionChange(sentence.lineNumber, e.target.value)}
                            placeholder="Type correction"
                            disabled={showResults}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                            data-source-tsx="ProofreadingPreview Answer Input|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                          />
                        </td>
                        {showResults && (
                          <td className="border border-gray-300 px-4 py-3">
                            {result && (
                              <div className="space-y-1">
                                {result.isCorrect ? (
                                  <div className="flex items-center space-x-2 text-green-700">
                                    <CheckCircle size={20} />
                                    <span className="font-medium">Correct!</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2 text-red-700">
                                      <XCircle size={20} />
                                      <span className="font-medium">Incorrect</span>
                                    </div>
                                    {correctAnswer && (
                                      <div className="text-sm text-gray-600">
                                        <p>Correct: {correctAnswer.correction}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!showResults && (
              <div className="mb-6 text-center">
                <button
                  onClick={handleSubmitTest}
                  className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  data-source-tsx="ProofreadingPreview Submit Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                >
                  Check Answers
                </button>
              </div>
            )}

            {showResults && (
              <div className="mb-6 text-center">
                <button
                  onClick={handleReset}
                  className="px-8 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                  data-source-tsx="ProofreadingPreview Reset Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                >
                  Try Again
                </button>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-8 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                data-source-tsx="ProofreadingPreview Back Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
              >
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>

              <div className="flex space-x-4">
                {user?.role === 'admin' && (
                  <button
                    onClick={handleSaveClick}
                    disabled={saveSuccess}
                    className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                    data-source-tsx="ProofreadingPreview Save Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                  >
                    <Save size={20} />
                    <span>{saveSuccess ? 'Saved!' : 'Save Practice'}</span>
                  </button>
                )}

                <button
                  onClick={onNext}
                  className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  data-source-tsx="ProofreadingPreview Start Button|src/components/ProofreadingPreview/ProofreadingPreview.tsx"
                >
                  <span>Start Practice</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Save Practice</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Title
                </label>
                <input
                  type="text"
                  value={practiceTitle}
                  onChange={(e) => setPracticeTitle(e.target.value)}
                  placeholder="Enter practice title"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  autoFocus
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>{sentences.length} sentence{sentences.length !== 1 ? 's' : ''} with answer keys will be saved.</p>
              </div>
              {saveError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <XCircle size={20} className="text-red-600 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{saveError}</p>
                  </div>
                </div>
              )}
              {saveSuccess && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                    <p className="text-green-700 text-sm font-medium">Practice saved successfully!</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setPracticeTitle('');
                  setSaveError(null);
                }}
                disabled={isSaving}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={isSaving || !practiceTitle.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProofreadingPreview;
