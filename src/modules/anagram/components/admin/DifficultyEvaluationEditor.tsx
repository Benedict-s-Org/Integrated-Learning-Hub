import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, ClipboardList, Info, MessageSquare, CheckCircle2, AlertCircle, Eye, Settings2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import TrialDifficultyEvaluation from "../TrialDifficultyEvaluation";

export default function DifficultyEvaluationEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_trial_difficulty");
      if (data) {
        setContent(data.content);
      } else {
        setContent({
          title: "Practice Trial Check",
          subtitle: "Before you continue, please rate how difficult the practice trial felt overall.",
          question_label: "Practice trial difficulty (overall)",
          helper_text: "Rate the difficulty of solving the puzzles, not just whether you got them correct.",
          opt_easy: "Easy",
          opt_moderate: "Moderate",
          opt_difficult: "Difficult"
        });
      }
    };
    load();
  }, [getContent]);

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    const result = await updateContent(
      "anagram_trial_difficulty", 
      content, 
      "Practice trial difficulty evaluation screen text"
    );
    setIsSaving(false);
    
    if (result.success) {
      setSaveStatus({ type: 'success', message: "Evaluation screen updated successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: `Failed to save: ${result.error || 'Unknown error'}` });
    }
  };

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Designer...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Block */}
      <div className="bg-white rounded-3xl border-t-[12px] border-t-indigo-600 border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic flex items-center gap-3">
              <ClipboardList className="text-indigo-600" size={32} />
              Difficulty Evaluation Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Customize the feedback collection screen shown after the practice trial.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>Save Designer</span>
          </button>
        </div>

        {saveStatus && (
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 overflow-hidden ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              saveStatus.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'
            }`}>
              {saveStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </div>
            <p className="text-sm font-black">{saveStatus.message}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          {/* Text Content Card */}
          <div className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">Standard Labels</h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instructional Text</span>
                </div>
              </div>

              <div className="space-y-6">
                <RichTextEditor
                  label="Page Title"
                  value={content.title}
                  onChange={(v) => setContent({ ...content, title: v })}
                />
                <RichTextEditor
                  label="Description Subtitle"
                  multiline
                  rows={2}
                  value={content.subtitle}
                  onChange={(v) => setContent({ ...content, subtitle: v })}
                />
                <RichTextEditor
                  label="Question Label"
                  value={content.question_label}
                  onChange={(v) => setContent({ ...content, question_label: v })}
                />
                <RichTextEditor
                  label="Helper Hint (Small Text)"
                  multiline
                  rows={2}
                  value={content.helper_text}
                  onChange={(v) => setContent({ ...content, helper_text: v })}
                />
              </div>
            </div>
          </div>

          {/* Option Labels Card */}
          <div className="bg-white rounded-2xl border-l-[6px] border-l-blue-500 border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Settings2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">Option Labels</h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selection Choices</span>
                </div>
              </div>

              <div className="space-y-4">
                <RichTextEditor
                  label="Option 1 (Easy)"
                  value={content.opt_easy || "Easy"}
                  onChange={(v) => setContent({ ...content, opt_easy: v })}
                />
                <RichTextEditor
                  label="Option 2 (Moderate)"
                  value={content.opt_moderate || "Moderate"}
                  onChange={(v) => setContent({ ...content, opt_moderate: v })}
                />
                <RichTextEditor
                  label="Option 3 (Difficult)"
                  value={content.opt_difficult || "Difficult"}
                  onChange={(v) => setContent({ ...content, opt_difficult: v })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Side */}
        <div className="space-y-4 sticky top-8">
          <div className="flex items-center gap-2 px-2">
            <Eye size={18} className="text-slate-400" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Preview</h4>
          </div>
          <div className="scale-[0.8] origin-top border-4 border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl pointer-events-none select-none grayscale-[0.2]">
            <TrialDifficultyEvaluation 
              onBack={() => {}} 
              onSubmit={() => {}} 
              cmsContent={content} 
            />
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-500 font-medium italic text-center">
            This is a visual preview. Interactivity is disabled here.
          </div>
        </div>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4 text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold text-slate-800 tracking-tight">Data Consistency Note</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80 italic">
            Changing the labels here only affects the interface. The values logged to the database will remain 'easy', 'moderate', and 'difficult' regardless of the display text.
          </p>
        </div>
      </div>
    </div>
  );
}
