import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { ProofreadingSentence, ProofreadingWord, ProofreadingAnswer } from '../../types';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';

interface ProofreadingAnswerSettingProps {
  sentences: string[];
  onNext: (answers: ProofreadingAnswer[]) => void;
  onBack: () => void;
  onViewSaved?: () => void;
}

const ProofreadingAnswerSetting: React.FC<ProofreadingAnswerSettingProps> = ({
  sentences,
  onNext,
  onBack,
  onViewSaved,
}) => {
  const [parsedSentences, setParsedSentences] = useState<ProofreadingSentence[]>([]);
  const [selectedWords, setSelectedWords] = useState<Map<number, number>>(new Map());
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [isLoadingAI, setIsLoadingAI] = useState(false);

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
  }, [sentences]);

  const handleWordClick = (lineNumber: number, wordIndex: number) => {
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

  const handleSubmit = () => {
    const answers: ProofreadingAnswer[] = [];
    selectedWords.forEach((wordIndex, lineNumber) => {
      const correction = corrections.get(lineNumber) || '';
      if (correction.trim()) {
        answers.push({
          lineNumber,
          wordIndex,
          correction: correction.trim(),
        });
      }
    });
    onNext(answers);
  };

  const hasAllAnswers = () => {
    if (selectedWords.size === 0) return false;
    for (const lineNumber of selectedWords.keys()) {
      const correction = corrections.get(lineNumber);
      if (!correction || correction.trim().length === 0) {
        return false;
      }
    }
    return true;
  };

  const handleAIAutoDetect = async () => {
    setIsLoadingAI(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        alert('Supabase configuration is missing');
        return;
      }

      const apiUrl = `${supabaseUrl}/functions/v1/ai-proofread`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sentences }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`AI processing failed: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      const results = data.results || [];

      const newSelectedWords = new Map<number, number>();
      const newCorrections = new Map<number, string>();

      results.forEach((result: { lineNumber: number; wordIndex: number; correction: string }) => {
        newSelectedWords.set(result.lineNumber, result.wordIndex);
        newCorrections.set(result.lineNumber, result.correction);
      });

      setSelectedWords(newSelectedWords);
      setCorrections(newCorrections);

      if (results.length === 0) {
        alert('No errors detected by AI in the sentences.');
      }
    } catch (error) {
      console.error('Error calling AI function:', error);
      alert('Failed to process sentences with AI. Please try again.');
    } finally {
      setIsLoadingAI(false);
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
        data-source-tsx="ProofreadingAnswerSetting|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
      >
      <div className="max-w-[95%] mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1
            className="text-3xl font-bold text-gray-800 mb-6 text-center"
            data-source-tsx="ProofreadingAnswerSetting Title|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
          >
            Set Answer Key
          </h1>

          <div className="mb-6 text-center text-gray-600">
            <p>Click on the word that contains a mistake in each sentence, then enter the correction.</p>
            <button
              onClick={handleAIAutoDetect}
              disabled={isLoadingAI}
              className="mt-4 inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              data-source-tsx="ProofreadingAnswerSetting AI Button|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
            >
              <Sparkles size={20} />
              <span>{isLoadingAI ? 'AI Processing...' : 'AI Auto-Detect Errors'}</span>
            </button>
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

                  return (
                    <tr
                      key={sentence.lineNumber}
                      className="hover:bg-gray-50"
                      data-source-tsx="ProofreadingAnswerSetting Table Row|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
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
                            const isClickable = !word.isPunctuation;

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
                                data-source-tsx="ProofreadingAnswerSetting Word Button|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          data-source-tsx="ProofreadingAnswerSetting Answer Input|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-500">
                        {selectedWordIndex !== undefined && correction ? (
                          <span className="text-green-700 font-medium">{correction}</span>
                        ) : (
                          <span className="text-gray-400 italic">Not set</span>
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
              data-source-tsx="ProofreadingAnswerSetting Back Button|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>

            <button
                onClick={handleSubmit}
                disabled={!hasAllAnswers()}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                data-source-tsx="ProofreadingAnswerSetting Next Button|src/components/ProofreadingAnswerSetting/ProofreadingAnswerSetting.tsx"
              >
              <span>Next</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>

    </>
  );
};

export default ProofreadingAnswerSetting;
