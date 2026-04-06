import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, Plus, Trash2, CheckCircle2, Circle, ChevronRight, Settings } from "lucide-react";

export default function SurveyEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_survey");
      if (data) {
        // Ensure structure for customization
        const base = data.content;
        if (!base.customQuestions) base.customQuestions = [];
        setContent(base);
      } else {
        // Default structure
        setContent({
          title: "Post-Task Questionnaire",
          subtitle: "Please answer the following questions honestly. There are no right or wrong answers.",
          sections: {
            optimism: {
              title: "🌟 Optimism Scale",
              description: "Rate how much you agree with each statement (1 = Disagree, 7 = Agree)"
            },
            thinking: {
              title: "🧠 Thinking Style",
              description: "Rate how much you agree with each statement (1 = Disagree, 7 = Agree)"
            },
            perception: {
              title: "📊 Task Perception",
              description: "How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)"
            },
            experience: {
              title: "📚 Past Experience",
              description: ""
            },
            check: {
              title: "✅ Comprehension Check",
              description: "When you made your time predictions, who were you predicting for?"
            }
          },
          customQuestions: []
        });
      }
    };
    load();
  }, [getContent]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent("anagram_survey", content, "Post-survey content and custom questions for Anagram project");
    setIsSaving(false);
    alert("Survey settings updated successfully!");
  };

  const addCustomQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      label: "New Question Text...",
      type: "likert",
      min: 1,
      max: 7,
      lowLabel: "Disagree",
      highLabel: "Agree",
      enabled: true
    };
    setContent({ ...content, customQuestions: [...content.customQuestions, newQ] });
  };

  const updateCustomQuestion = (idx: number, updates: any) => {
    const next = [...content.customQuestions];
    next[idx] = { ...next[idx], ...updates };
    setContent({ ...content, customQuestions: next });
  };

  const removeCustomQuestion = (idx: number) => {
    setContent({ ...content, customQuestions: content.customQuestions.filter((_: any, i: number) => i !== idx) });
  };

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Survey Editor...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Survey Editor</h2>
          <p className="text-slate-500 text-sm font-medium">Manage headers, sections, and add new research questions.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-50 disabled:opacity-50 active:scale-95"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Save Changes</span>
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-10">
        <div>
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
            <Settings className="w-5 h-5 text-emerald-500" />
            Survey Configuration
          </h3>
          
          <div className="grid grid-cols-1 gap-8">
            {/* Main Headers */}
            <div className="grid grid-cols-1 gap-6 pb-8 border-b border-slate-100">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Survey Title</label>
                <input
                  type="text"
                  value={content.title}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-800 text-lg"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Survey Subtitle</label>
                <input
                  type="text"
                  value={content.subtitle}
                  onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Standard Sections */}
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 italic">Default Survey Sections</h4>
              <div className="grid grid-cols-1 gap-6">
                {Object.entries(content.sections || {}).map(([key, section]: [string, any]) => (
                  <div key={key} className="space-y-4 p-6 bg-slate-50/50 border border-slate-100 rounded-3xl group hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center text-xs font-black shadow-sm group-hover:scale-110 transition-transform">
                        {key.charAt(0).toUpperCase()}
                      </div>
                      <h4 className="font-black text-slate-500 text-[10px] uppercase tracking-widest">{key} Section</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Display Title</label>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const nextSections = { ...content.sections, [key]: { ...section, title: e.target.value } };
                            setContent({ ...content, sections: nextSections });
                          }}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description / Instructions</label>
                        <textarea
                          value={section.description}
                          onChange={(e) => {
                            const nextSections = { ...content.sections, [key]: { ...section, description: e.target.value } };
                            setContent({ ...content, sections: nextSections });
                          }}
                          rows={2}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-xs resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 tracking-tight">Custom Research Questions</h3>
          <button
            onClick={addCustomQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <Plus size={16} />
            <span>Add Question</span>
          </button>
        </div>

        {content.customQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-100 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 space-y-2">
            <div className="p-3 bg-slate-200 rounded-full"><Plus size={24} /></div>
            <p className="font-bold text-sm">No custom questions added yet.</p>
            <p className="text-xs">Click the button above to add new Likert scale questions to the post-survey.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {content.customQuestions.map((q: any, idx: number) => (
              <div key={q.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-6 animate-in zoom-in-95 duration-200">
                <div className="pt-2">
                  <button 
                    onClick={() => updateCustomQuestion(idx, { enabled: !q.enabled })}
                    className={`transition-colors p-1 rounded-full ${q.enabled ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {q.enabled ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <input
                      type="text"
                      placeholder="Enter question text..."
                      value={q.label}
                      onChange={(e) => updateCustomQuestion(idx, { label: e.target.value })}
                      className="flex-1 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-800"
                    />
                    <button
                      onClick={() => removeCustomQuestion(idx)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Low Label (1)</label>
                      <input
                        type="text"
                        value={q.lowLabel}
                        onChange={(e) => updateCustomQuestion(idx, { lowLabel: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1.5 text-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scale Range</label>
                      <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-black text-slate-600">
                        <span>1</span>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span>7</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">High Label (7)</label>
                      <input
                        type="text"
                        value={q.highLabel}
                        onChange={(e) => updateCustomQuestion(idx, { highLabel: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <h4 className="font-bold text-emerald-900 text-sm">Dynamic Integration Active</h4>
          <p className="text-emerald-700/70 text-xs mt-1 leading-relaxed">
            All enabled custom questions will be automatically injected into the participant's post-experiment survey. 
            Responses are captured in the <code className="bg-white/50 px-1 rounded">dynamicResponses</code> field of the experiment data.
          </p>
        </div>
      </div>
    </div>
  );
}
