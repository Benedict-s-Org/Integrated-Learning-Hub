import { useState, useEffect } from "react";
import { fetchQuestions, NotionQuestion } from "../../services/notionLogger";
import { Loader2, Brain, Sparkles, Info, ExternalLink } from "lucide-react";

export default function QuestionBankEditor() {
  const [content, setContent] = useState<{ easy: NotionQuestion[], hard: NotionQuestion[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSet, setActiveSet] = useState<'easy' | 'hard'>('easy');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [warmup, easy, hard] = await Promise.all([
          fetchQuestions("Warm-up", 50, true),
          fetchQuestions("Easy", 100, true),
          fetchQuestions("Hard", 100, true)
        ]);
        // Merge warmup and easy for the "Easy" view
        setContent({ 
          easy: [...warmup, ...easy], 
          hard 
        });
      } catch (err) {
        console.error("Error loading Notion questions:", err);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  if (isLoading || !content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Synching with Notion...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Question Bank</h2>
          <p className="text-slate-500 text-sm font-medium">Synced automatically from your Notion database.</p>
        </div>
        <a
          href="https://www.notion.so/d7ea40d03cde4e54b8a6226ac75130cc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
        >
          <ExternalLink size={18} />
          <span>Edit in Notion</span>
        </a>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSet('easy')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${
            activeSet === 'easy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles size={16} />
          Task 1 (Easy)
        </button>
        <button
          onClick={() => setActiveSet('hard')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${
            activeSet === 'hard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Brain size={16} />
          Task 2 (Hard)
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${activeSet === 'easy' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {activeSet === 'easy' ? <Sparkles size={20} /> : <Brain size={20} />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-widest">
                {activeSet === 'easy' ? 'Easy Set' : 'Hard Set'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400">Total Active: {content[activeSet].length} Questions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {(content[activeSet] || []).map((q) => (
            <div key={q.questionId} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-all flex flex-col gap-4">
              <div className="flex items-start justify-between">
                 <div className="flex items-center gap-2">
                   <div className="flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg">
                      <span>Notion ID</span>
                      <span className="text-blue-500 text-[8px]">{q.questionId.split('-')[0]}...</span>
                   </div>
                   {q.tier && (
                     <div className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                       q.tier === 'Warm-up' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                     }`}>
                       {q.tier}
                     </div>
                   )}
                 </div>
                 <a
                    href={q.questionPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="View in Notion"
                  >
                    <ExternalLink size={16} />
                 </a>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scrambled Letters</label>
                  <div className="w-full px-4 py-2.5 bg-slate-50 rounded-2xl font-black text-slate-800 text-center tracking-widest text-lg">
                    {q.letters}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valid Answers</label>
                  <div className="w-full px-4 py-2 bg-slate-50 rounded-xl font-bold text-slate-600 text-sm">
                    {q.validAnswers.join(', ') || "No correct answers set"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {content[activeSet].length === 0 && (
            <div className="p-8 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-3xl">
               No active questions found in Notion for this tier.
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
          <Info size={20} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-sm">Read-Only Mode</h4>
          <p className="text-blue-700/70 text-xs mt-1 leading-relaxed">
            The question bank is now mastered in your Notion database. Any edits to valid answers, active status, or letter sets must be done directly in Notion.
          </p>
        </div>
      </div>
    </div>
  );
}
