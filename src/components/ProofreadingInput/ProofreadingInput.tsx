import React, { useState, useEffect } from 'react';
import { Download, Link as LinkIcon, AlertCircle, Loader2 } from 'lucide-react';
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

const ProofreadingInput: React.FC<ProofreadingInputProps> = ({ onNext, onViewSaved }) => {
  const [notionDbId, setNotionDbId] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved DB ID on mount
  useEffect(() => {
    const savedId = localStorage.getItem('proofreading_notion_db_id');
    if (savedId) {
      setNotionDbId(savedId);
    }
  }, []);

  const handleFetchFromNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionDbId.trim()) return;

    setIsFetching(true);
    setError(null);

    // Save for next time
    localStorage.setItem('proofreading_notion_db_id', notionDbId.trim());

    try {
      const { data, error: fnError } = await supabase.functions.invoke('notion-api', {
        body: { databaseId: notionDbId.trim() },
        method: 'POST',
      });

      if (fnError) throw fnError;
      if (!data || !data.results) throw new Error('No results received from Notion');

      const parsedData = parseProofreadingNotionResponse(data.results);

      if (parsedData.length === 0) {
        throw new Error('No valid proofreading questions found. Ensure your database has "Original" and "Corrected" columns.');
      }

      // Process auto-diffing
      const sentences: string[] = [];
      const prefilledAnswers: ProofreadingAnswer[] = [];

      parsedData.forEach((item, lineNumber) => {
        sentences.push(item.original);

        const diffResult = findDifference(item.original, item.corrected);
        if (diffResult) {
          prefilledAnswers.push({
            lineNumber,
            wordIndex: diffResult.wordIndex,
            correction: diffResult.correctedWord,
            tip: item.tip,
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
            <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
              Fetch sentences and Auto-Diff metadata directly from your Notion Database to instantly generate Proofreading Practices.
            </p>

            <form onSubmit={handleFetchFromNotion} className="space-y-6 max-w-2xl mx-auto bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <label
                  htmlFor="notion-db"
                  className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
                >
                  <LinkIcon size={16} className="text-blue-500" />
                  Notion Database ID
                </label>
                <div className="flex gap-3">
                  <input
                    id="notion-db"
                    type="text"
                    value={notionDbId}
                    onChange={(e) => setNotionDbId(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isFetching || !notionDbId.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Fetch & Auto-Diff
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Ensure your associated database contains the properties: <strong>Sentence/Original</strong>, <strong>Corrected/Answer</strong>.
                  Optional: <strong>Tip</strong>, <strong>Day</strong>.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-200">
                  <AlertCircle size={20} className="mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Failed to fetch data</p>
                    <p>{error}</p>
                    <p className="mt-2 text-xs text-red-600">
                      Does the Notion Database follow the correct format? Make sure the integration is invited to the database.
                    </p>
                  </div>
                </div>
              )}
            </form>

            <div className="mt-12 pt-8 border-t border-gray-200">
               <div className="bg-blue-50/50 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 rounded-l-xl"></div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pl-4">How Auto-Diff Works</h3>
                  <div className="flex flex-col gap-4 pl-4 text-sm text-gray-700">
                    <p>
                        Instead of manually identifying which word is wrong and clicking on it, <strong>Auto-Diff</strong> automatically calculates the difference between your <strong>Original</strong> (incorrect) sentence and the <strong>Corrected</strong> sentence straight from your Notion table.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                             <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Original Column</div>
                             <div className="font-medium">She <span className="text-red-500 line-through">don't</span> like apples.</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                             <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Corrected Column</div>
                             <div className="font-medium">She <span className="text-green-600">doesn't</span> like apples.</div>
                        </div>
                    </div>
                    <p className="text-gray-500 italic mt-2">
                        The engine automatically maps "don't" as the error and "doesn't" as the correction. You can review the mapping in the next step before saving.
                    </p>
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