import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, Info, Layout, CheckCircle2, MessageSquare, AlertCircle, Target } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

const DesignerCard = ({ icon: Icon, title, sectionId, children, borderColor = "border-l-indigo-500" }: any) => (
  <div className={`bg-white rounded-2xl border-l-[6px] ${borderColor} border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md`}>
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
            <Icon size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 tracking-tight">{title}</h4>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sectionId}</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-2">
        {children}
      </div>
    </div>
  </div>
);

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
          start_button_text: "Start Experiment →",
          group_label: "Your assigned group:",
          predict_self_text: 'You will predict for "yourself"',
          predict_other_text: 'You will predict for "other students"'
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

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Designer...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Block */}
      <div className="bg-white rounded-3xl border-t-[12px] border-t-indigo-600 border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic flex items-center gap-3">
              <Layout className="text-indigo-600" size={32} />
              Welcome Page Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the experiment's landing and consent page.</p>
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

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <RichTextEditor
            label="Page Title"
            value={content.title}
            onChange={(v) => setContent({ ...content, title: v })}
          />
          <RichTextEditor
            label="Subtitle"
            multiline
            rows={2}
            value={content.subtitle}
            onChange={(v) => setContent({ ...content, subtitle: v })}
          />
        </div>
      </div>

      {/* Main Designer Cards */}
      <div className="space-y-6">
        
        {/* Study Info Card */}
        <DesignerCard icon={MessageSquare} title="Study Information" sectionId="Section 1" borderColor="border-l-blue-500">
          <RichTextEditor
            label="Header Title"
            value={content.study_info_title}
            onChange={(v) => setContent({ ...content, study_info_title: v })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Information Items (One per line)</label>
            </div>
            <textarea
              value={(content.study_info_items || []).join('\n')}
              onChange={(e) => setContent({ ...content, study_info_items: e.target.value.split('\n') })}
              rows={6}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none font-medium text-slate-700 text-sm resize-y"
              placeholder="Enter study details here..."
            />
          </div>
        </DesignerCard>

        {/* Important Notes Card */}
        <DesignerCard icon={AlertCircle} title="Important Notes" sectionId="Section 2" borderColor="border-l-amber-500">
          <RichTextEditor
            label="Header Title"
            value={content.notes_title}
            onChange={(v) => setContent({ ...content, notes_title: v })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Notes (One per line)</label>
            </div>
            <textarea
              value={(content.notes_items || []).join('\n')}
              onChange={(e) => setContent({ ...content, notes_items: e.target.value.split('\n') })}
              rows={4}
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 focus:border-amber-500 focus:bg-white rounded-2xl transition-all outline-none font-medium text-slate-700 text-sm resize-y"
              placeholder="Enter experiment rules/notes..."
            />
          </div>
        </DesignerCard>

        {/* Consent Card */}
        <DesignerCard icon={CheckCircle2} title="Consent & Participation" sectionId="Section 3" borderColor="border-l-emerald-500">
          <RichTextEditor
            label="Consent Checkbox Text"
            value={content.consent_text}
            onChange={(v) => setContent({ ...content, consent_text: v })}
          />
          <RichTextEditor
            label="Start Button Text"
            value={content.start_button_text}
            onChange={(v) => setContent({ ...content, start_button_text: v })}
          />
        </DesignerCard>
 
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-4 text-indigo-700">
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-600" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold tracking-tight">Designer Tip</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80">
            Use formatting (Bold, Italic, Color) to emphasize key instructions. Long lists like 'Study Information' are automatically converted into bullet points for participants.
          </p>
        </div>
      </div>
    </div>
  );
}
