import React, { useState, useEffect } from 'react';
import { Download, Link as LinkIcon, AlertCircle, Loader2, Filter } from 'lucide-react';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';
import { supabase } from '../../integrations/supabase/client';
import { parseProofreadingNotionResponse } from '../../utils/importParsers';
import { findDifference } from '../../utils/textUtils';
import { ProofreadingAnswer } from '../../types';

interface ProofreadingInputProps {
  onNext: (sentences: string[], prefilledAnswers?: ProofreadingAnswer[]) => void;
  onViewSaved?: () => void;
  generateSentences?: unknown; // kept for backwards compatibility in App.tsx
}

const LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6'];

const ProofreadingInput: React.FC<ProofreadingInputProps> = ({ onNext, onViewSaved }) => {
  const [notionDbId, setNotionDbId] = useState('');
  const [targetLevel, setTargetLevel] = useState('P.3');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved DB ID on mount
  useEffect(() => {
    const savedId = localStorage.getItem('proofreading_notion_db_id');
    const savedLevel = localStorage.getItem('proofreading_target_level');
    if (savedId) setNotionDbId(savedId);
    if (savedLevel) setTargetLevel(savedLevel);
  }, []);

  const getLevelNumeric = (lvl?: string) => {
    if (!lvl) return 0;
    const match = lvl.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const findWordIndex = (sentence: string, targetWord?: string): number => {
    if (!targetWord) return -1;
    
    // Tokenize similar to ProofreadingAnswerSetting
    const tokens = sentence.match(/\S+|\s+/g) || [];
    let wordIndex = 0;
    
    for (const token of tokens) {
      if (token.trim().length > 0) {
        // Remove punctuation for comparison if necessary, 
        // but user says "error is the wrong word", usually exactly as in sentence
        if (token.toLowerCase() === targetWord.toLowerCase() || 
            token.replace(/[^\w\s]/g, '').toLowerCase() === targetWord.replace(/[^\w\s]/g, '').toLowerCase()) {
          return wordIndex;
        }
        wordIndex++;
      }
    }
    return -1;
  };

  const handleFetchFromNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionDbId.trim()) return;

    setIsFetching(true);
    setError(null);

    // Save for next time
    localStorage.setItem('proofreading_notion_db_id', notionDbId.trim());
    localStorage.setItem('proofreading_target_level', targetLevel);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('notion-api', {
        body: { databaseId: notionDbId.trim() }
      });

      if (fnError) throw fnError;
      if (!data || !data.results) throw new Error('No results received from Notion');

      const allParsedData = parseProofreadingNotionResponse(data.results);

      // Filtering logic
      const targetLevelNum = getLevelNumeric(targetLevel);
      
      const filteredData = allParsedData.filter(item => {
        const itemLevelNum = getLevelNumeric(item.level);
        
        // If "Level Specific" is yes, it must match exactly
        if (item.levelSpecific === 'yes') {
          return item.level === targetLevel;
        }
        
        // Otherwise, higher level can handle lower level
        // (Target P.4 can handle P.3 and P.4)
        return targetLevelNum >= itemLevelNum;
      });

      if (filteredData.length === 0) {
        throw new Error(`No questions found for ${targetLevel}. (Found ${allParsedData.length} total in DB).`);
      }

      // Process metadata
      const sentences: string[] = [];
      const prefilledAnswers: ProofreadingAnswer[] = [];

      filteredData.forEach((item, lineNumber) => {
        sentences.push(item.original);

        // Try to find index using the 'error' column first
        let wordIndex = findWordIndex(item.original, item.error);
        
        // Fallback to auto-diff if 'error' not found or not provided
        let correction = item.corrected || '';
        if (wordIndex === -1 && item.corrected) {
          const diffResult = findDifference(item.original, item.corrected);
          if (diffResult) {
            wordIndex = diffResult.wordIndex;
            correction = diffResult.correctedWord;
          }
        }

        if (wordIndex !== -1) {
          prefilledAnswers.push({
            lineNumber,
            wordIndex,
            correction: correction,
            tip: item.tip || item.feature, // Use feature as tip if tip is empty
          });
        }
      });

      onNext(sentences, prefilledAnswers);
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch from Notion. Check database ID and configuration.';
      setError(errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <>
      {onViewSaved && (
        <ProofreadingTopNav
          onCreateNew={() => { }}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className="pt-20 min-h-full bg-gray-50 pr-0 md:pr-8"
        data-source-tsx="ProofreadingInput|src/components/ProofreadingInput/ProofreadingInput.tsx"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
            <h1
              className="text-xl md:text-3xl font-bold text-gray-800 mb-2 md:mb-2 text-center"
              data-source-tsx="ProofreadingInput Title|src/components/ProofreadingInput/ProofreadingInput.tsx"
            >
              Proofreading Creator
            </h1>
            <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto font-medium">
              Import error-correction pairs directly from Notion with Level-based filtering.
            </p>

            <form onSubmit={handleFetchFromNotion} className="space-y-6 max-w-2xl mx-auto bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label
                    htmlFor="notion-db"
                    className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
                    >
                    <LinkIcon size={16} className="text-blue-500" />
                    Notion Database ID
                    </label>
                    <input
                    id="notion-db"
                    type="text"
                    value={notionDbId}
                    onChange={(e) => setNotionDbId(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white"
                    required
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Filter size={16} className="text-orange-500" />
                        Target Level
                    </label>
                    <select 
                        value={targetLevel} 
                        onChange={(e) => setTargetLevel(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-800"
                    >
                        {LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isFetching || !notionDbId.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Fetch & Filter
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-200 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} className="mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Import Error</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </form>

            <div className="mt-12 pt-8 border-t border-gray-200">
               <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 rounded-l-xl"></div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pl-4">Notion Configuration</h3>
                  <div className="flex flex-col gap-4 pl-4 text-sm text-gray-700">
                    <p>
                        Ensure your database columns match these names (or synonyms):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">Question (Title)</span>
                            <span className="text-gray-500">Error Sentence</span>
                        </div>
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">error</span>
                            <span className="text-gray-500">Wrong word</span>
                        </div>
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">Correct Answer</span>
                            <span className="text-gray-500">Correction</span>
                        </div>
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">Level</span>
                            <span className="text-gray-500">e.g. P.3, P.4</span>
                        </div>
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">Level Specific</span>
                            <span className="text-gray-500">yes / no</span>
                        </div>
                        <div className="flex justify-between border-b border-blue-100 pb-1">
                            <span className="font-semibold">Feature</span>
                            <span className="text-gray-500">Verb tense, etc.</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-white rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <Filter size={14} /> Level Logic
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Higher levels (e.g. P.4) can pull lower level questions (e.g. P.3).</li>
                            <li>If <strong>Level Specific</strong> is "yes", the item is ONLY pulled if the Target Level matches exactly.</li>
                        </ul>
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default ProofreadingInput;