import React, { useState } from 'react';
import { Database, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/context/AuthContext';

interface ReadingNotionImporterProps {
  practiceId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export const ReadingNotionImporter: React.FC<ReadingNotionImporterProps> = ({ 
  practiceId, 
  onComplete, 
  onCancel 
}) => {
  const { session } = useAuth();
  const [databaseId, setDatabaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'fetching' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, imported: 0 });

  const handleImport = async () => {
    if (!databaseId) {
      setError('Please enter a Notion Database ID');
      return;
    }

    setLoading(true);
    setStatus('fetching');
    setError(null);

    try {
      console.log('[ReadingNotionImporter] Debug Info:', {
        url: (supabase as any).functions.url,
        functionName: 'notion-api'
      });

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // 1. Fetch from Notion via Edge Function
      const { data: notionData, error: notionError } = await supabase.functions.invoke('notion-api', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: { 
          databaseId: databaseId.trim(),
          action: 'query-mcq-database'
        }
      });

      if (notionError && (notionError as any).status === 404) {
        console.error('[ReadingNotionImporter] 404 ERROR: The Edge Function "reading-api" was not found on the project. Please ensure it is deployed to the correct project ref.');
      }

      if (notionError) throw notionError;
      if (notionData.error) throw new Error(notionData.error);

      const results = notionData.results || [];
      setStats({ total: results.length, imported: 0 });
      setStatus('saving');

      // 2. Map and Save to DB
      let importedCount = 0;
      for (const entry of results) {
        const props = entry.properties;
        
        // Helper to extract text from Notion properties
        const getText = (name: string) => {
          const prop = props[name];
          if (!prop) return '';
          if (prop.type === 'title') return prop.title?.map((t: any) => t.plain_text).join('') || '';
          if (prop.type === 'rich_text') return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
          return '';
        };

        const getSelect = (name: string) => {
          const prop = props[name];
          return prop?.type === 'select' ? prop.select?.name : '';
        };

        const getNumber = (name: string) => {
          const prop = props[name];
          return prop?.type === 'number' ? prop.number : null;
        };

        const questionText = getText('Question') || getText('text');
        const correctAnswer = getText('Answer') || getText('correct_answer');
        const errorSentence = getText('Error Sentence') || getText('error_sentence');
        const errorWord = getText('Error') || getText('error');
        const type = getSelect('Type') || getSelect('interaction_type') || 'rearrange';
        const level = getNumber('Level') || 1;
        const chunksRaw = getText('Chunks'); // Expected as comma-separated or JSON string
        
        let metadata = {};
        if (chunksRaw) {
          try {
            metadata = { chunks: chunksRaw.includes('[') ? JSON.parse(chunksRaw) : chunksRaw.split(',').map((s: string) => s.trim()) };
          } catch {
            metadata = { chunks: chunksRaw.split(',').map((s: string) => s.trim()) };
          }
        }

        if (correctAnswer) {
          const insertData: any = {
            practice_id: practiceId,
            question_text: questionText,
            correct_answer: correctAnswer,
            interaction_type: type.toLowerCase().includes('proof') ? 'proofreading' : 'rearrange',
            level: level,
            metadata: metadata,
            order_index: importedCount
          };

          // Add new proofreading specific columns if they exist
          if (insertData.interaction_type === 'proofreading') {
            insertData.error_sentence = errorSentence;
            insertData.error = errorWord;
          }

          const { error: dbError } = await supabase
            .from('reading_questions')
            .insert(insertData);

          if (!dbError) {
            importedCount++;
            setStats(prev => ({ ...prev, imported: importedCount }));
          }
        }
      }

      setStatus('success');
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2000);

    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import from Notion');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 max-w-xl w-full mx-auto shadow-2xl border border-slate-100">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sync from Notion</h2>
          <p className="text-slate-500 text-sm">Import your question bank directly</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Notion Database ID</label>
          <div className="relative">
            <input
              type="text"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder="Paste ID here (e.g., a35db621...)"
              className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              disabled={loading}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
              <RefreshCw className={`w-5 h-5 ${status === 'fetching' ? 'animate-spin text-indigo-500' : ''}`} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Ensure your Notion integration has access to this database.
          </p>
        </div>

        {status === 'saving' && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-indigo-900">Importing Questions...</p>
              <div className="w-full bg-indigo-200 h-2 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(stats.imported / stats.total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-indigo-500 mt-1">
                {stats.imported} of {stats.total} entries processed
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in zoom-in">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="font-bold text-emerald-900">Success!</p>
              <p className="text-xs text-emerald-600">Imported {stats.imported} questions successfully.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4 animate-in shake">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="font-bold text-red-900">Import Failed</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          {onCancel && (
            <button 
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={loading || !databaseId}
            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {status === 'idle' ? 'Start Synchronization' : 'Processing...'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Required Notion Columns</h4>
        <div className="grid grid-cols-2 gap-3">
          {['Question', 'Answer', 'Type', 'Level', 'Error Sentence', 'Error'].map(col => (
            <div key={col} className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-1 h-1 bg-indigo-400 rounded-full" />
              {col}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
