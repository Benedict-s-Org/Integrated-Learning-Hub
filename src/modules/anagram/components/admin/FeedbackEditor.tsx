import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, BarChart3, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface Props {
  cmsKey: string;
  taskLabel: string;
  onPreview?: () => void;
}

export default function FeedbackEditor({ cmsKey, taskLabel, onPreview }: Props) {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent(cmsKey);
      
      const defaults = {
        title: "Task Complete!",
        success_msg: "Great job! You were faster than you predicted.",
        failure_msg: "You were a bit slower than you predicted.",
        continue_button: "Continue to Next Phase →",
        stat_correct_label: "Correct",
        stat_skipped_label: "Skipped",
        stat_predicted_label: "Predicted / question",
        stat_actual_label: "Actual total time",
        pfi_label: "Planning Fallacy Index (PFI)",
        pfi_invalid_text: "N/A (invalid data — all skipped)",
        pfi_underestimate_text: "You underestimated the time needed",
        pfi_overestimate_text: "You overestimated the time needed",
        breakdown_label: "Question breakdown:",
        breakdown_q_prefix: "Q",
        breakdown_skipped_text: "Skipped",
        breakdown_correct_template: "✓ {ans} ({timer}s)",
        breakdown_incorrect_template: "✗ ({timer}s, {tries} tries)"
      };

      if (data && data.content) {
        setContent({ ...defaults, ...data.content });
      } else {
        setContent(defaults);
      }
    };
    load();
  }, [getContent, cmsKey, taskLabel]);

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    const result = await updateContent(cmsKey, content, `Feedback phase for ${taskLabel}`);
    setIsSaving(false);
    
    if (result.success) {
      setSaveStatus({ type: 'success', message: `${taskLabel} feedback saved!` });
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
              <BarChart3 className="text-indigo-600" size={32} />
              {taskLabel} Feedback Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the performance feedback screen for {taskLabel}.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onPreview}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-600 hover:text-indigo-600 rounded-2xl font-black transition-all active:scale-95"
            >
              <Eye size={20} />
              <span>Preview Page</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              <span>Save Designer</span>
            </button>
          </div>
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

      <div className="grid grid-cols-1 gap-6">
        {/* Dynamic Messaging Card */}
        <div className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm p-6 space-y-6 group hover:shadow-md transition-all">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Outcome Messaging</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 1</span>
            </div>
          </div>
          <div className="space-y-6">
            <RichTextEditor
              label="Feedback Screen Title"
              value={content.title}
              onChange={(v) => setContent({ ...content, title: v })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RichTextEditor
                label="Success Messsage (Under Prediction)"
                multiline
                rows={2}
                value={content.success_msg}
                onChange={(v) => setContent({ ...content, success_msg: v })}
              />
              <RichTextEditor
                label="Failure Message (Over Prediction)"
                multiline
                rows={2}
                value={content.failure_msg}
                onChange={(v) => setContent({ ...content, failure_msg: v })}
              />
            </div>
            <RichTextEditor
              label="Continue Button Text"
              value={content.continue_button}
              onChange={(v) => setContent({ ...content, continue_button: v })}
            />
          </div>
        </div>
 
        {/* Detailed Stats & Labels Card */}
        <div className="bg-white rounded-2xl border-l-[6px] border-l-slate-400 border border-slate-200 shadow-sm p-6 space-y-6 group hover:shadow-md transition-all">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Detailed Stats & Labels</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 2</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-4">
              <h5 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-50 pb-1">Stat Card Labels</h5>
              <RichTextEditor label="Correct Stat" value={content.stat_correct_label} onChange={(v) => setContent({ ...content, stat_correct_label: v })} />
              <RichTextEditor label="Skipped Stat" value={content.stat_skipped_label} onChange={(v) => setContent({ ...content, stat_skipped_label: v })} />
              <RichTextEditor label="Predicted Stat" value={content.stat_predicted_label} onChange={(v) => setContent({ ...content, stat_predicted_label: v })} />
              <RichTextEditor label="Actual Stat" value={content.stat_actual_label} onChange={(v) => setContent({ ...content, stat_actual_label: v })} />
            </div>
            
            <div className="space-y-4">
              <h5 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-50 pb-1">PFI Messaging</h5>
              <RichTextEditor label="PFI Main Label" value={content.pfi_label} onChange={(v) => setContent({ ...content, pfi_label: v })} />
              <RichTextEditor label="Invalid Data Text" value={content.pfi_invalid_text} onChange={(v) => setContent({ ...content, pfi_invalid_text: v })} />
              <RichTextEditor label="Underestimate Msg" value={content.pfi_underestimate_text} onChange={(v) => setContent({ ...content, pfi_underestimate_text: v })} />
              <RichTextEditor label="Overestimate Msg" value={content.pfi_overestimate_text} onChange={(v) => setContent({ ...content, pfi_overestimate_text: v })} />
            </div>
          </div>
 
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h5 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-50 pb-1">Question Breakdown Formatting</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RichTextEditor label="Breakdown Title" value={content.breakdown_label} onChange={(v) => setContent({ ...content, breakdown_label: v })} />
              <RichTextEditor label="Question Prefix" value={content.breakdown_q_prefix} onChange={(v) => setContent({ ...content, breakdown_q_prefix: v })} />
              <RichTextEditor label="Skipped Text" value={content.breakdown_skipped_text} onChange={(v) => setContent({ ...content, breakdown_skipped_text: v })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                 <RichTextEditor label="Correct Template" value={content.breakdown_correct_template} onChange={(v) => setContent({ ...content, breakdown_correct_template: v })} />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Placeholders: {`{ans}`}, {`{timer}`}</p>
               </div>
               <div className="space-y-1">
                 <RichTextEditor label="Incorrect Template" value={content.breakdown_incorrect_template} onChange={(v) => setContent({ ...content, breakdown_incorrect_template: v })} />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Placeholders: {`{timer}`}, {`{tries}`}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4 text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
           <XCircle size={24} className="text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold text-slate-800 tracking-tight">UX Consideration</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80 italic">
            The feedback is shown immediately after the final anagram in the set. If you use HTML/styling, ensure the messages remain legible and encouraging.
          </p>
        </div>
      </div>
    </div>
  );
}
