import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Trash2, Loader2, RefreshCw, ArrowRight, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ReadingPracticeCreator } from '@/components/admin/ReadingPracticeCreator';
import { ReadingNotionImporter } from '@/components/admin/ReadingNotionImporter';
import { ReadingNotionBrowser } from '@/components/admin/ReadingNotionBrowser';

interface ReadingPractice {
  id: string;
  title: string;
  passage_image_url: string;
  created_at: string;
  question_count?: number;
}

export const ReadingManagementPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'sync' | 'notion-browse' | 'aplus-coordinates'>('list');
  const [practices, setPractices] = useState<ReadingPractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePracticeId, setActivePracticeId] = useState<string | null>(null);
  const [notionParams, setNotionParams] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    fetchPractices();
  }, []);

  const fetchPractices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reading_practices')
        .select(`
          *,
          reading_questions(count)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedData = data.map((p: any) => ({
        ...p,
        question_count: p.reading_questions?.[0]?.count || 0
      }));

      setPractices(formattedData);
    } catch (error) {
      console.error('Error fetching practices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this practice?')) return;
    
    try {
      const { error } = await supabase
        .from('reading_practices')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
      setPractices(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting practice:', error);
      alert('Failed to delete practice.');
    }
  };

  if (view === 'create') {
    return (
      <ReadingPracticeCreator 
        initialPdfUrl={notionParams?.url || undefined}
        initialTitle={notionParams?.title}
        onComplete={(_id) => {
          setView('list');
          setNotionParams(null);
          fetchPractices();
        }}
        onCancel={() => {
          setView('list');
          setNotionParams(null);
        }}
      />
    );
  }

  if (view === 'notion-browse') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <ReadingNotionBrowser 
          onSelect={(url, title) => {
            setNotionParams({ url, title });
            setView('create');
          }}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  if (view === 'sync' && activePracticeId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <ReadingNotionImporter 
          practiceId={activePracticeId}
          onComplete={() => {
            setView('list');
            fetchPractices();
          }}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Reading Comprehension</h1>
          <p className="text-slate-500">Manage your interactive reading practices</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-100 shadow-sm transition-all active:scale-95 font-bold"
          >
            <Plus className="w-5 h-5" />
            Create Reading Question
          </button>
          <button 
            onClick={() => setView('notion-browse')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95 font-bold"
          >
            <Database className="w-5 h-5 text-indigo-500" />
            Create via Notion
          </button>

        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
          <p className="mt-4 text-slate-500">Loading your practices...</p>
        </div>
      ) : practices.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">No practices yet</h2>
          <p className="text-slate-400 max-w-sm mb-8">
            Create your first reading comprehension exercise by uploading a PDF passage.
          </p>
          <button 
            onClick={() => setView('create')}
            className="text-indigo-600 font-bold hover:underline"
          >
            Start creating now →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {practices.map((practice) => (
            <div 
              key={practice.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                <img 
                  src={practice.passage_image_url} 
                  alt={practice.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button 
                    onClick={() => {
                      setActivePracticeId(practice.id);
                      setView('sync');
                    }}
                    className="p-3 bg-white rounded-full text-slate-700 hover:text-indigo-600 transition-colors shadow-lg"
                    title="Sync Questions from Notion"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(practice.id)}
                    className="p-3 bg-white rounded-full text-slate-700 hover:text-red-600 transition-colors shadow-lg"
                    title="Delete Practice"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 mb-1 truncate">{practice.title}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  Created {new Date(practice.created_at).toLocaleDateString()}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                    practice.question_count ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {practice.question_count || 0} Questions
                  </span>
                  <button 
                    onClick={() => {
                      setActivePracticeId(practice.id);
                      setView('sync');
                    }}
                    className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline"
                  >
                    Manage Questions <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReadingManagementPage;
