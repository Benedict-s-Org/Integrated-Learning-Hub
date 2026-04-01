import React, { useState, useEffect } from 'react';
import { Download, Link as LinkIcon, AlertCircle, Loader2, Filter, Check, X, ChevronRight, ListChecks, Lock } from 'lucide-react';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { parseProofreadingNotionResponse, ProofreadingImportData } from '../../utils/importParsers';
import { findDifference } from '../../utils/textUtils';
import { ProofreadingAnswer } from '../../types';

interface ProofreadingInputProps {
  onNext: (sentences: string[], prefilledAnswers?: ProofreadingAnswer[], exerciseNumber?: string) => void;
  onViewSaved?: () => void;
  generateSentences?: unknown; // kept for backwards compatibility in App.tsx
}

const LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6'];

const ProofreadingInput: React.FC<ProofreadingInputProps> = ({ onNext, onViewSaved }) => {
  const { session } = useAuth();
  const { proofreadingPractices } = useAppContext();
  const [notionDbId, setNotionDbId] = useState('');
  const [targetLevel, setTargetLevel] = useState('P.3');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allFetchedQuestions, setAllFetchedQuestions] = useState<ProofreadingImportData[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [excludedCount, setExcludedCount] = useState(0);

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
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notion-api`;
      
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
          'x-action': 'query-mcq-database',
          'x-database-id': notionDbId.trim()
        },
        body: JSON.stringify({ 
          databaseId: notionDbId.trim(),
          action: 'query-mcq-database'
        })
      });

      const responseText = await response.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Edge Function returned non-JSON: ${response.status} ${responseText}`);
      }

      if (!response.ok) {
        console.error('Notion API Error:', data);
        if (response.status === 404 && data && data.object === 'error') {
          throw new Error(`Notion Database Not Found! Please ensure you have connected the 'Supabase Integration' to this database in Notion. Details: ${data.message || 'Unknown'}`);
        }
        throw new Error(`Edge Function Error ${response.status}: ${data?.error || data?.message || JSON.stringify(data)}`);
      }
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

      // Exclude already used questions
      const usedSentences = new Set<string>();
      proofreadingPractices.forEach(p => {
        p.sentences.forEach(s => usedSentences.add(s.trim().toLowerCase()));
      });

      const finalFilteredData = filteredData.filter(item => {
        const isUsed = usedSentences.has(item.original.trim().toLowerCase());
        return !isUsed;
      });

      const excluded = filteredData.length - finalFilteredData.length;
      setExcludedCount(excluded);

      if (finalFilteredData.length === 0) {
        if (excluded > 0) {
          throw new Error(`All matching questions (${excluded}) for ${targetLevel} have already been used in previous practices.`);
        }
        throw new Error(`No questions found for ${targetLevel}. (Found ${allParsedData.length} total in DB).`);
      }

      setAllFetchedQuestions(finalFilteredData);
      setSelectedIndices(new Set(finalFilteredData.map((_, i) => i)));
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch from Notion. Check database ID and configuration.';
      setError(errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const toggleGroupSelection = (groupQuestions: ProofreadingImportData[]) => {
    const groupIndices = groupQuestions.map(q => allFetchedQuestions!.indexOf(q));
    const allGroupSelected = groupIndices.every(idx => selectedIndices.has(idx));
    
    const newSelected = new Set(selectedIndices);
    if (allGroupSelected) {
      groupIndices.forEach(idx => newSelected.delete(idx));
    } else {
      groupIndices.forEach(idx => newSelected.add(idx));
    }
    setSelectedIndices(newSelected);
  };

  const selectAll = () => {
    if (!allFetchedQuestions) return;
    setSelectedIndices(new Set(allFetchedQuestions.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedIndices(new Set());
  };

  const handleConfirmSelection = () => {
    if (!allFetchedQuestions) return;

    const selectedData = allFetchedQuestions.filter((_, i) => selectedIndices.has(i));
    
    if (selectedData.length === 0) {
      setError("Please select at least one question.");
      return;
    }

    const sentences: string[] = [];
    const prefilledAnswers: ProofreadingAnswer[] = [];

    selectedData.forEach((item, lineNumber) => {
      sentences.push(item.original);

      // Find index
      let wordIndex = findWordIndex(item.original, item.error);
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
          correction,
          tip: item.tip || item.feature,
        });
      }
    });

    const exerciseNumbers = selectedData
      .map(q => q.exercise_number)
      .filter((val): val is string => !!val && val.length > 0);
    
    const distinctExerciseNumber = exerciseNumbers.length > 0 ? exerciseNumbers[0] : undefined;

    onNext(sentences, prefilledAnswers, distinctExerciseNumber);
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
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-gray-100 relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50 pointer-events-none"></div>
            
            <div className="relative z-10">
              <h1 className="text-2xl md:text-4xl font-black text-gray-900 mb-2 text-center tracking-tight">
                Proofreading <span className="text-blue-600">Creator</span>
              </h1>
              <p className="text-center text-gray-500 mb-10 max-w-xl mx-auto font-medium">
                {allFetchedQuestions 
                  ? "Select the specific items you'd like to include in this exercise." 
                  : "Import error-correction pairs directly from Notion with ease."}
              </p>

              {!allFetchedQuestions ? (
                /* STEP 1: INPUT FORM */
                <form onSubmit={handleFetchFromNotion} className="space-y-6 max-w-2xl mx-auto bg-blue-50/30 p-8 rounded-2xl border border-blue-100 shadow-sm backdrop-blur-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <LinkIcon size={16} className="text-blue-500" />
                          Notion Database ID
                        </label>
                        <input
                          type="text"
                          value={notionDbId}
                          onChange={(e) => setNotionDbId(e.target.value)}
                          placeholder="Paste your Notion DB ID here..."
                          className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 bg-white transition-all shadow-sm"
                          required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter size={16} className="text-orange-500" />
                            Target Level
                        </label>
                        <select 
                            value={targetLevel} 
                            onChange={(e) => setTargetLevel(e.target.value)}
                            className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-800 transition-all shadow-sm font-semibold"
                        >
                            {LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                        </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isFetching || !notionDbId.trim()}
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-200 active:scale-[0.98] group"
                      >
                        {isFetching ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            Fetching Data...
                          </>
                        ) : (
                          <>
                            <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                            Begin Import
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-4 border border-red-100 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle size={22} className="mt-0.5 shrink-0 text-red-500" />
                      <div className="text-sm">
                        <p className="font-bold mb-1">Import Error</p>
                        <p className="opacity-90">{error}</p>
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                /* STEP 2: QUESTION SELECTION */
                <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                  {excludedCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                      <AlertCircle size={14} />
                      <span>{excludedCount} questions already used in other practices were automatically excluded.</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                        <ListChecks size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{selectedIndices.size} selected</p>
                        <p className="text-xs text-gray-500">Total {allFetchedQuestions.length} found for {targetLevel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={selectAll}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                       >
                        Select All
                       </button>
                       <button 
                        onClick={selectNone}
                        className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                       >
                        Clear All
                       </button>
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                    {(() => {
                      // Group questions by exercise number
                      const groups: Record<string, ProofreadingImportData[]> = {};
                      allFetchedQuestions.forEach(q => {
                        const key = q.exercise_number || 'Uncategorized';
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(q);
                      });

                      return Object.entries(groups).map(([groupName, groupQuestions]) => {
                        const groupIndices = groupQuestions.map(q => allFetchedQuestions.indexOf(q));
                        const selectedInGroup = groupIndices.filter(idx => selectedIndices.has(idx)).length;
                        const allGroupSelected = selectedInGroup === groupQuestions.length;

                        return (
                          <div key={groupName} className="space-y-3">
                            <div className="flex items-center justify-between px-2 pb-1 border-b border-gray-100 mb-4 sticky top-0 bg-white/95 backdrop-blur-sm z-20 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                  {groupName === 'Uncategorized' ? groupName : `Exercise ${groupName}`}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400">
                                  ({groupQuestions.length} questions)
                                </span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupSelection(groupQuestions);
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                                  allGroupSelected 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'
                                }`}
                              >
                                {allGroupSelected ? 'Deselect Group' : 'Select Group'}
                              </button>
                            </div>

                            <div className="space-y-3">
                              {groupQuestions.map((q) => {
                                const originalIdx = allFetchedQuestions.indexOf(q);
                                const isSelected = selectedIndices.has(originalIdx);
                                return (
                                  <div 
                                    key={originalIdx}
                                    onClick={() => toggleSelection(originalIdx)}
                                    className={`
                                      group relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4
                                      ${isSelected 
                                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                        : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md'}
                                    `}
                                  >
                                    <div className={`
                                      shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                                      ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 group-hover:border-blue-400'}
                                    `}>
                                      {isSelected && <Check size={14} strokeWidth={4} />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                                          {q.level || targetLevel}
                                        </span>
                                        {q.feature && (
                                          <span className="text-[10px] font-bold text-gray-400 truncate max-w-[150px]">
                                            {q.feature}
                                          </span>
                                        )}
                                      </div>
                                      <p className={`text-sm font-medium transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                        {q.original}
                                      </p>
                                    </div>

                                    <div className="shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors">
                                      <ChevronRight size={18} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button
                      onClick={() => setAllFetchedQuestions(null)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all border border-gray-200"
                    >
                      <X size={20} />
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSelection}
                      disabled={selectedIndices.size === 0}
                      className="flex-[2] flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-green-200 active:scale-[0.98]"
                    >
                      <Check size={20} strokeWidth={3} />
                      Continue with {selectedIndices.size} Items
                    </button>
                  </div>
                </div>
              )}

              {/* Helpful Guide (Only shows on Step 1) */}
              {!allFetchedQuestions && (
                <div className="mt-12 pt-10 border-t border-gray-100">
                  <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-3xl p-8 border border-blue-100 relative overflow-hidden shadow-inner">
                      <div className="absolute top-0 left-0 w-2 h-full bg-blue-500/20"></div>
                      <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                          <Filter size={18} />
                        </div>
                        Import Requirements
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-sm">
                          {[
                            { label: 'Question (Title)', antonym: 'Error Sentence' },
                            { label: 'error', antonym: 'Wrong word' },
                            { label: 'Correct Answer', antonym: 'Correction' },
                            { label: 'Level', antonym: 'P.3, P.4, etc.' },
                            { label: 'Level Specific', antonym: 'yes / no' },
                            { label: 'Feature', antonym: 'Grammar Tip' },
                            { label: 'Exercise Number', antonym: 'Set Name' },
                          ].map((req, i) => (
                            <div key={i} className="flex justify-between items-center group">
                                <span className="font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{req.label}</span>
                                <div className="h-[1px] flex-1 mx-4 bg-blue-100/50"></div>
                                <span className="text-gray-400 font-medium italic">{req.antonym}</span>
                            </div>
                          ))}
                      </div>
                      
                      <div className="mt-8 flex flex-col md:flex-row gap-4">
                          <div className="flex-1 p-5 bg-white/60 rounded-2xl border border-blue-100 shadow-sm backdrop-blur-sm">
                              <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                  <Filter size={14} className="text-blue-500" /> Smart Logic
                              </h4>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                Higher target levels (e.g. P.4) will automatically include lower level questions (e.g. P.3) in the selection list.
                              </p>
                          </div>
                          <div className="flex-1 p-5 bg-white/60 rounded-2xl border border-blue-100 shadow-sm backdrop-blur-sm">
                              <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                  <Lock size={14} className="text-orange-500" /> Level Specific
                              </h4>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                Set <strong>Level Specific</strong> to "yes" for items that should strictly only appear when that exact level is selected.
                              </p>
                          </div>
                      </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProofreadingInput;