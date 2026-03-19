import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Trash2, Loader2, RefreshCw, Database, ChevronLeft, ChevronRight, Pencil, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ReadingPracticeCreator } from '@/components/admin/ReadingPracticeCreator';
import { ReadingNotionImporter } from '@/components/admin/ReadingNotionImporter';
import { ReadingNotionBrowser } from '@/components/admin/ReadingNotionBrowser';
import { ReadingPracticePreviewModal } from '@/components/admin/ReadingPracticePreviewModal';
import { ReadingAssignmentModal } from '@/components/admin/ReadingAssignmentModal';

interface ReadingPractice {
  id: string;
  title: string;
  passage_image_url: string;
  created_at: string;
  question_count?: number;
}

export const ReadingManagementPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'sync' | 'notion-browse' | 'aplus-list'>('list');
  const [practices, setPractices] = useState<ReadingPractice[]>([]);
  const [aplusQuestions, setAplusQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePracticeId, setActivePracticeId] = useState<string | null>(null);
  const [notionParams, setNotionParams] = useState<{ url: string; title: string } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedPracticeTitle, setSelectedPracticeTitle] = useState('');

  useEffect(() => {
    if (view === 'list') fetchPractices();
    if (view === 'aplus-list') fetchAplusQuestions();
  }, [view]);

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
        question_count: (p.reading_questions as any)?.[0]?.count || 0
      }));

      setPractices(formattedData);
    } catch (error) {
      console.error('Error fetching practices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAplusQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reading_questions')
        .select('*')
        .eq('interaction_type', 'aplus-coordinates')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAplusQuestions(data || []);
    } catch (error) {
      console.error('Error fetching A+ questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAplus = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      // 1. Get the image URL before deleting the record
      const { data: question } = await (supabase
        .from('reading_questions' as any) as any)
        .select('question_image_url')
        .eq('id', id)
        .single();
      
      if (question?.question_image_url) {
        const fileName = (question as any).question_image_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('reading-passages').remove([fileName]);
        }
      }

      const { error } = await (supabase.from('reading_questions' as any) as any).delete().eq('id', id);
      if (error) throw error;
      setAplusQuestions(prev => prev.filter(q => q.id !== id));
    } catch (error) {
      console.error('Error deleting A+ question:', error);
      alert('Failed to delete question.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this practice?')) return;
    
    try {
      // 1. Get all associated questions to clean up their images
      const { data: questions } = await (supabase
        .from('reading_questions' as any) as any)
        .select('question_image_url')
        .eq('practice_id', id);

      const { data: practice } = await supabase
        .from('reading_practices')
        .select('passage_image_url')
        .eq('id', id)
        .single();

      const filesToDelete: string[] = [];
      if (practice?.passage_image_url) {
        const pFile = practice.passage_image_url.split('/').pop();
        if (pFile) filesToDelete.push(pFile);
      }

      questions?.forEach((q: any) => {
        if (q.question_image_url) {
          const qFile = q.question_image_url.split('/').pop();
          if (qFile && !filesToDelete.includes(qFile)) filesToDelete.push(qFile);
        }
      });

      if (filesToDelete.length > 0) {
        await supabase.storage.from('reading-passages').remove(filesToDelete);
      }

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

  if (view === 'create' || view === 'edit') {
    return (
      <ReadingPracticeCreator 
        initialPdfUrl={notionParams?.url || undefined}
        initialTitle={notionParams?.title}
        editId={view === 'edit' ? activePracticeId || undefined : undefined}
        onComplete={(_id) => {
          setView('list');
          setNotionParams(null);
          setActivePracticeId(null);
          fetchPractices();
        }}
        onCancel={() => {
          setView('list');
          setNotionParams(null);
          setActivePracticeId(null);
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
          <div className="relative group">
            <button 
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 border border-indigo-700 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 font-bold"
            >
              <Plus className="w-5 h-5" />
              New Practice
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
              <button 
                onClick={() => setView('create')}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors text-sm font-bold border-b border-slate-50"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-white transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                Local PDF
              </button>
              <button 
                onClick={() => setView('notion-browse')}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors text-sm font-bold"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-white transition-colors">
                  <Database className="w-4 h-4" />
                </div>
                Notion Bank
              </button>
            </div>
          </div>
          <button 
            onClick={() => setView('aplus-list')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95 font-bold"
          >
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Inventory
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
      ) : view === 'aplus-list' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl font-black text-slate-800">Saved Synthesized Questions</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Independent A+ Question Inventory</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest">
              {aplusQuestions.length} Total Questions
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aplusQuestions.map((q) => (
              <div key={q.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col gap-4 group hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
                      A+
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Level {q.level || 1}</span>
                  </div>
                  <button onClick={() => handleDeleteAplus(q.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800 leading-relaxed mb-2 line-clamp-3">
                    {q.question_text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <p className="text-[11px] font-bold text-slate-500 italic truncate">
                      Ans: {q.correct_answer}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">{new Date(q.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1.5 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                    Manage <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {aplusQuestions.length === 0 && !loading && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-20 flex flex-col items-center text-center">
              <BookOpen className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold">No saved questions found. Create some via the synthesizer flow!</p>
            </div>
          )}
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
                      setView('edit');
                    }}
                    className="p-3 bg-white rounded-full text-slate-700 hover:text-indigo-600 transition-colors shadow-lg"
                    title="Edit Practice"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
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
                </div>
                
                {/* Action Buttons */}
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setActivePracticeId(practice.id);
                      setShowPreviewModal(true);
                    }}
                    className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all text-xs"
                  >
                    <BookOpen className="w-4 h-4" />
                    Practice
                  </button>
                  <button
                    onClick={() => {
                      setActivePracticeId(practice.id);
                      setSelectedPracticeTitle(practice.title);
                      setShowAssignmentModal(true);
                    }}
                    className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Assign to Students
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modals */}
      {showPreviewModal && activePracticeId && (
        <ReadingPracticePreviewModal 
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          practiceId={activePracticeId}
        />
      )}

      {showAssignmentModal && activePracticeId && (
        <ReadingAssignmentModal 
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          practiceId={activePracticeId}
          practiceTitle={selectedPracticeTitle}
        />
      )}
    </div>
  );
};

export default ReadingManagementPage;
