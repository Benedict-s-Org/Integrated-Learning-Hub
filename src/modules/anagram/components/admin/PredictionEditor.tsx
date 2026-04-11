import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, Brain, Info, Target, HelpCircle, Hash, Type, CheckCircle2, AlertCircle } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface Props {
  cmsKey: string;
  taskLabel: string;
}

export default function PredictionEditor({ cmsKey, taskLabel }: Props) {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent(cmsKey);
      
      const defaults = {
        title: "Time Prediction",
        task_name: taskLabel,
        task_description: taskLabel === "Task 1 (Easy)" 
          ? "10 anagrams (3 warmup + 7 easy puzzles)" 
          : "10 anagrams (8 6-letter + 2 7-letter puzzles)",
        question_text: "How many <strong>seconds</strong> do you think <strong class=\"text-indigo-600\">[target]</strong> will need to solve <strong>each puzzle</strong>?",
        input_placeholder: "Enter seconds",
        min_val: 1,
        max_val: 600,
        confirm_button: "Confirm Prediction →",
        unit_label: "seconds/puzzle",
        validation_error_template: "Please enter a number between {min} and {max}",
        result_preview_template: "Predicted: <strong class=\"text-[#673ab7]\">{val}s</strong> / puzzle"
      };

      if (data && data.content) {
        // Merge fetched data with defaults to ensure new fields are never empty
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
    const result = await updateContent(cmsKey, content, `Prediction settings for ${taskLabel}`);
    setIsSaving(false);
    
    if (result.success) {
      setSaveStatus({ type: 'success', message: `${taskLabel} settings updated!` });
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
              <Brain className="text-indigo-600" size={32} />
              {taskLabel} Prediction Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the prediction screen for {taskLabel}.</p>
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

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <RichTextEditor
            label="Page Title"
            value={content.title}
            onChange={(v) => setContent({ ...content, title: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Task Info Card */}
        <div className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm p-6 space-y-6 group hover:shadow-md transition-all">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Task Identification</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 1</span>
            </div>
          </div>
          <div className="space-y-4">
            <RichTextEditor
              label="Task Name (Shown in blue box)"
              value={content.task_name}
              onChange={(v) => setContent({ ...content, task_name: v })}
            />
            <RichTextEditor
              label="Task Description"
              multiline
              rows={2}
              value={content.task_description}
              onChange={(v) => setContent({ ...content, task_description: v })}
            />
          </div>
        </div>

        {/* Prediction Logic Card */}
        <div className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm p-6 space-y-6 group hover:shadow-md transition-all">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Prediction Guidance</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 2</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <RichTextEditor
                label="Question Text"
                value={content.question_text}
                onChange={(v) => setContent({ ...content, question_text: v })}
              />
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest ml-1">
                Tip: Use [target] to insert "you" or "other students" automatically.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Seconds</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                  <Hash size={14} className="text-slate-400" />
                  <input 
                    type="number"
                    value={content.min_val}
                    onChange={(e) => setContent({ ...content, min_val: parseInt(e.target.value) || 1 })}
                    className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Seconds</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                  <Hash size={14} className="text-slate-400" />
                  <input 
                    type="number"
                    value={content.max_val}
                    onChange={(e) => setContent({ ...content, max_val: parseInt(e.target.value) || 600 })}
                    className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full"
                  />
                </div>
              </div>
            <RichTextEditor
              label="Input Placeholder"
              value={content.input_placeholder}
              onChange={(v) => setContent({ ...content, input_placeholder: v })}
            />
            </div>

            <RichTextEditor
              label="Confirm Button Text"
              value={content.confirm_button}
              onChange={(v) => setContent({ ...content, confirm_button: v })}
            />
          </div>
        </div>
 
        {/* Labels & Formatting Card */}
        <div className="bg-white rounded-2xl border-l-[6px] border-l-slate-400 border border-slate-200 shadow-sm p-6 space-y-6 group hover:shadow-md transition-all">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
              <Type size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Labels & Formatting</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 3</span>
            </div>
          </div>
          <div className="space-y-4">
             <RichTextEditor
               label="Unit Label (e.g., seconds/puzzle)"
               value={content.unit_label}
               onChange={(v) => setContent({ ...content, unit_label: v })}
             />
             <div className="space-y-1">
               <RichTextEditor
                 label="Validation Error Template"
                 value={content.validation_error_template}
                 onChange={(v) => setContent({ ...content, validation_error_template: v })}
               />
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                 Tip: Use {`{min}`} and {`{max}`} placeholders.
               </p>
             </div>
             <div className="space-y-1">
               <RichTextEditor
                 label="Result Preview Template (Shown after input)"
                 value={content.result_preview_template}
                 onChange={(v) => setContent({ ...content, result_preview_template: v })}
               />
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                 Tip: Use {`{val}`} placeholder.
               </p>
             </div>
          </div>
        </div>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4 text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold text-slate-800 tracking-tight">Manipulation Tip</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80">
            The <code>[target]</code> placeholder in the Question Text is crucial. It ensures that participants see the correct target depending on their experimental group.
          </p>
        </div>
      </div>
    </div>
  );
}
