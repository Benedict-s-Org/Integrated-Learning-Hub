import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, BarChart3, CheckCircle2, XCircle } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface Props {
  cmsKey: string;
  taskLabel: string;
}

export default function FeedbackEditor({ cmsKey, taskLabel }: Props) {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent(cmsKey);
      if (data) {
        setContent(data.content);
      } else {
        setContent({
          title: "Task Complete!",
          success_msg: "Great job! You were faster than you predicted.",
          failure_msg: "You were a bit slower than you predicted.",
          continue_button: "Continue to Next Phase →"
        });
      }
    };
    load();
  }, [getContent, cmsKey, taskLabel]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent(cmsKey, content, `Feedback phase for ${taskLabel}`);
    setIsSaving(false);
    alert(`${taskLabel} feedback saved!`);
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
