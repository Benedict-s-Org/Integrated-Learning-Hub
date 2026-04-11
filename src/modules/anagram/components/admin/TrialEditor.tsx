import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, PlayCircle, Info, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

export default function TrialEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_trial");
      if (data) {
        setContent(data.content);
      } else {
        setContent({
          title: "Trial Phase",
          description: "Get ready for a short trial phase to practice the puzzles. You will see 4 calibration questions.",
          button_text: "Start Trial →"
        });
      }
    };
    load();
  }, [getContent]);

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    const result = await updateContent("anagram_trial", content, "Trial phase instructions for Anagram project");
    setIsSaving(false);
    
    if (result.success) {
      setSaveStatus({ type: 'success', message: "Trial settings updated successfully!" });
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
              <PlayCircle className="text-indigo-600" size={32} />
              Trial Phase Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the instructions for the calibration trial phase.</p>
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

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Main Instructions</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 1</span>
            </div>
          </div>

          <div className="space-y-6">
            <RichTextEditor
              label="Phase Title"
              value={content.title}
              onChange={(v) => setContent({ ...content, title: v })}
            />
            <RichTextEditor
              label="Instruction Description"
              multiline
              rows={4}
              value={content.description}
              onChange={(v) => setContent({ ...content, description: v })}
            />
            <RichTextEditor
              label="Start Button Text"
              value={content.button_text}
              onChange={(v) => setContent({ ...content, button_text: v })}
            />
          </div>
        </div>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4 text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold text-slate-800 tracking-tight">Technical Note</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80 italic">
            The trial phase always fetches 4 questions tagged as 'Calibration' from your Notion Question Bank to establish participant speed.
          </p>
        </div>
      </div>
    </div>
  );
}
