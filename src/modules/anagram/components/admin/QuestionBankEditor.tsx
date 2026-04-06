import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { easySets, hardSets } from "../../data/anagrams";
import { Save, Loader2, Plus, Trash2, Brain, Sparkles, Info } from "lucide-react";

export default function QuestionBankEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSet, setActiveSet] = useState<'easy' | 'hard'>('easy');

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_questions");
      if (data) {
        setContent(data.content);
      } else {
        // Default structure from local data
        setContent({
          easy: easySets,
          hard: hardSets
        });
      }
    };
    load();
  }, [getContent]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent("anagram_questions", content, "Anagram experiment question sets (Easy and Hard)");
    setIsSaving(false);
    alert("Question bank updated successfully!");
  };

  const addQuestion = () => {
    const newQ = { letters: "ABCD", validAnswers: ["ABCD"] };
    setContent({
      ...content,
      [activeSet]: [...content[activeSet], newQ]
    });
  };

  const updateQuestion = (idx: number, updates: any) => {
    const next = [...content[activeSet]];
    next[idx] = { ...next[idx], ...updates };
    setContent({ ...content, [activeSet]: next });
  };

  const removeQuestion = (idx: number) => {
    setContent({
      ...content,
      [activeSet]: content[activeSet].filter((_: any, i: number) => i !== idx)
    });
  };

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Question Bank...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Question Bank</h2>
          <p className="text-slate-500 text-sm font-medium">Manage the anagram sets for Task 1 and Task 2.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-50 disabled:opacity-50 active:scale-95"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Save Changes</span>
        </button>
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
                {activeSet === 'easy' ? 'Easy Set (3-4 Letters)' : 'Hard Set (5-6 Letters)'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400">Total: {content[activeSet].length} Questions</p>
            </div>
          </div>
          <button
            onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <Plus size={16} />
            <span>Add Anagram</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {(content[activeSet] || []).map((q: any, idx: number) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-all flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between">
                 <div className="flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg">
                    <span>Index</span>
                    <span className="text-blue-500">#{idx + 1}</span>
                 </div>
                 <button
                    onClick={() => removeQuestion(idx)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                 </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scrambled Letters</label>
                  <input
                    type="text"
                    value={q.letters}
                    onChange={(e) => updateQuestion(idx, { letters: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none font-black text-slate-800 text-center tracking-widest text-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valid Answers (comma separated)</label>
                  <input
                    type="text"
                    value={q.validAnswers.join(', ')}
                    onChange={(e) => updateQuestion(idx, { validAnswers: e.target.value.toUpperCase().split(',').map(s => s.trim()) })}
                    placeholder="E.g. WORD, DROW"
                    className="w-full px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-600 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
          <Info size={20} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-sm">Real-time Randomized Delivery</h4>
          <p className="text-blue-700/70 text-xs mt-1 leading-relaxed">
            The experiment automatically shuffles these sets for each participant. 
            Ensure you provide valid English words that can be formed from the scrambled letters.
          </p>
        </div>
      </div>
    </div>
  );
}
