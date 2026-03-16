import React, { useState, useEffect } from 'react';
import { BookOpen, Star, Clock, Trophy, Play, Loader2, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ReadingChallenge } from '@/components/reading/ReadingChallenge';

interface ReadingPractice {
  id: string;
  title: string;
  passage_image_url: string;
  created_at: string;
  question_count?: number;
}

export const ReadingLearningPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [practices, setPractices] = useState<ReadingPractice[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

      setPractices(formattedData.filter(p => p.question_count > 0));
    } catch (err) {
      console.error('Error fetching practices:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPractices = practices.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedPracticeId && user) {
    return (
      <ReadingChallenge 
        practiceId={selectedPracticeId}
        studentId={user.id}
        onComplete={(score, bonus) => {
          console.log(`Completed with score: ${score}, bonus: ${bonus}`);
          setSelectedPracticeId(null);
          fetchPractices();
        }}
        onExit={() => setSelectedPracticeId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-12 mb-12 relative overflow-hidden shadow-2xl shadow-indigo-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="text-center md:text-left max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-widest mb-6">
                <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                Reading Master
              </div>
              <h1 className="text-5xl font-black text-white mb-6 leading-tight">Master Reading Comprehension</h1>
              <p className="text-indigo-100 text-lg font-medium leading-relaxed">
                Interact with passages, build logical sentence structures, and earn rewards while sharpening your accuracy.
              </p>
            </div>
            
            <div className="flex-shrink-0 grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-white font-black text-2xl">0</p>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Mastered</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                <Clock className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                <p className="text-white font-black text-2xl">{practices.length}</p>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Available</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search practices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Practice Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            <p className="mt-4 text-slate-500 font-medium">Preparing your library...</p>
          </div>
        ) : filteredPractices.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-20 flex flex-col items-center text-center border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
              <BookOpen className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">No practices found</h2>
            <p className="text-slate-500">Check back later or try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPractices.map((practice) => (
              <div 
                key={practice.id}
                className="group bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-indigo-100 transition-all hover:-translate-y-1"
              >
                <div className="aspect-[16/10] relative overflow-hidden">
                  <img 
                    src={practice.passage_image_url} 
                    alt={practice.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-lg">
                      {practice.question_count} Questions
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                    {practice.title}
                  </h3>
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        Bonus Exp
                      </span>
                    </div>
                    <button 
                      onClick={() => setSelectedPracticeId(practice.id)}
                      className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
