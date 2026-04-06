import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, Info } from "lucide-react";

export default function WelcomeEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_welcome");
      if (data) {
        setContent(data.content);
      } else {
        // Default structure if not exists
        setContent({
          title: "Cognitive Task Experiment",
          subtitle: "Things Are Harder Than They Seem: Self vs. Other Predictions",
          study_info_title: "📋 Study Information",
          study_info_items: [
            "You will complete two sets of <strong>anagram puzzles</strong> — rearranging scrambled letters to form English words.",
            "Before each set, you will be asked to <strong>predict how many seconds</strong> it will take you to complete each puzzle.",
            "Each set has <strong>10 puzzles</strong>. You have up to <strong>5 attempts</strong> per puzzle. If you can't solve it, you can skip."
          ],
          notes_title: "⚠️ Important Notes",
          notes_items: [
            "Each timer starts when you see the puzzle",
            "Type your answer and press Enter or click Submit",
            "You can skip any puzzle (max 5 attempts)",
            "Your data will be used for research purposes only"
          ],
          consent_text: "I understand the study and agree to participate",
          start_button_text: "Start Experiment →"
        });
      }
    };
    load();
  }, [getContent]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent("anagram_welcome", content, "Main Welcome page content for Anagram project");
    setIsSaving(false);
    alert("Welcome page updated successfully!");
  };


  if (!content) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading Editor...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Welcome Page</h2>
          <p className="text-slate-500 text-sm font-medium">Edit the experiment's landing page content.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-95"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Save Changes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Headings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">1</span>
            Main Headings
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page Title</label>
              <input
                type="text"
                value={content.title}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subtitle</label>
              <textarea
                value={content.subtitle}
                onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium resize-none"
              />
            </div>
          </div>
        </div>

        {/* Buttons & Consent */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs">2</span>
            CTA & Consent
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Button Text</label>
              <input
                type="text"
                value={content.start_button_text}
                onChange={(e) => setContent({ ...content, start_button_text: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consent Checkbox Text</label>
              <input
                type="text"
                value={content.consent_text}
                onChange={(e) => setContent({ ...content, consent_text: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Study Information */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Info size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 tracking-tight">Study Information</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 3</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Header Title</label>
            <input
              type="text"
              value={content.study_info_title}
              onChange={(e) => setContent({ ...content, study_info_title: e.target.value })}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-800"
              placeholder="e.g. Study Information"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Content Body</label>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">One item per line</span>
            </div>
            <textarea
              value={(content.study_info_items || []).join('\n')}
              onChange={(e) => setContent({ ...content, study_info_items: e.target.value.split('\n') })}
              rows={8}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none font-medium text-sm resize-y shadow-inner min-h-[200px]"
              placeholder="Enter each study information item on a new line..."
            />
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
             <div className="font-black text-xl">!</div>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 tracking-tight">Important Notes</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section 4</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Header Title</label>
            <input
              type="text"
              value={content.notes_title}
              onChange={(e) => setContent({ ...content, notes_title: e.target.value })}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-800"
              placeholder="e.g. Important Notes"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Content Body</label>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">One item per line</span>
            </div>
            <textarea
              value={(content.notes_items || []).join('\n')}
              onChange={(e) => setContent({ ...content, notes_items: e.target.value.split('\n') })}
              rows={6}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl transition-all outline-none font-medium text-sm resize-y shadow-inner min-h-[150px]"
              placeholder="Enter each note on a new line..."
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl flex items-start gap-3 text-blue-700 text-sm font-medium">
        <Info size={20} className="shrink-0 mt-0.5" />
        <p>Tip: You can use HTML tags like &lt;strong&gt; or &lt;br&gt; in the Study Information items for basic formatting.</p>
      </div>
    </div>
  );
}
