import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, BarChart2, Info, MessageSquare, BookOpen, Share2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

export default function DebriefEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      const data = await getContent("anagram_debrief");
      if (data) {
        setContent(data.content);
      } else {
        setContent({
          title: "Thank You! — Debrief",
          results_header: "📊 Your Results",
          pfi_formula: "PFI = (Actual Time − Predicted Time) / Predicted Time",
          pfi_legend: "Positive = underestimated · Negative = overestimated",
          about_header: "🔬 About This Study",
          about_description: "This experiment investigates the Planning Fallacy — the tendency for people to underestimate how long tasks will take.",
          about_group_prefix: "Your group:",
          about_conclusion: "We compare whether people show a stronger planning fallacy when predicting for themselves vs. others, and whether task difficulty affects this bias.",
          data_collection_header: "💾 Data Collection",
          download_csv_button: "📥 Download CSV File",
          copy_json_button: "📋 Copy Full Data as JSON",
          auto_send_header: "Auto-Send to Google Sheets",
          auto_send_description: "Connect this experiment to a Google Sheet to automatically collect all participant data."
        });
      }
    };
    loadContent();
  }, [getContent]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent("anagram_debrief", content, "Debrief content for Anagram project");
    setIsSaving(false);
    alert("Debrief settings updated!");
  };

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Designer...</div>;

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Block */}
      <div className="bg-white rounded-3xl border-t-[12px] border-t-indigo-600 border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic flex items-center gap-3">
              <BarChart2 className="text-indigo-600" size={32} />
              Debrief Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the final results breakdown and study explanation.</p>
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
        </div>
      </div>

      <div className="space-y-6">
        {/* Results Header Card */}
        <DesignerCard icon={MessageSquare} title="Results Visualization" sectionId="Section 1" borderColor="border-l-blue-500">
           <RichTextEditor
              label="Results Section Header"
              value={content.results_header}
              onChange={(v) => setContent({ ...content, results_header: v })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RichTextEditor
                label="PFI Formula Label"
                value={content.pfi_formula}
                onChange={(v) => setContent({ ...content, pfi_formula: v })}
              />
              <RichTextEditor
                label="PFI Legend Text"
                value={content.pfi_legend}
                onChange={(v) => setContent({ ...content, pfi_legend: v })}
              />
            </div>
        </DesignerCard>

        {/* Study Info Card */}
        <DesignerCard icon={BookOpen} title="Scientific Context" sectionId="Section 2" borderColor="border-l-amber-500">
          <RichTextEditor
            label="Scientific Header"
            value={content.about_header}
            onChange={(v) => setContent({ ...content, about_header: v })}
          />
          <RichTextEditor
            label="Hypothesis/Description"
            multiline
            rows={2}
            value={content.about_description}
            onChange={(v) => setContent({ ...content, about_description: v })}
          />
          <RichTextEditor
            label="Participant Assignment Prefix"
            value={content.about_group_prefix}
            onChange={(v) => setContent({ ...content, about_group_prefix: v })}
          />
          <RichTextEditor
            label="Conclusion / Key Takeaway"
            multiline
            rows={2}
            value={content.about_conclusion}
            onChange={(v) => setContent({ ...content, about_conclusion: v })}
          />
        </DesignerCard>

        {/* Data Options Card */}
        <DesignerCard icon={Share2} title="Data & Synchronization" sectionId="Section 3" borderColor="border-l-emerald-500">
           <RichTextEditor
              label="Data Section Header"
              value={content.data_collection_header}
              onChange={(v) => setContent({ ...content, data_collection_header: v })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RichTextEditor
                label="CSV Download Button Text"
                value={content.download_csv_button}
                onChange={(v) => setContent({ ...content, download_csv_button: v })}
              />
              <RichTextEditor
                label="JSON Copy Button Text"
                value={content.copy_json_button}
                onChange={(v) => setContent({ ...content, copy_json_button: v })}
              />
            </div>
            <hr className="border-slate-100" />
            <RichTextEditor
              label="Google Sheets Feature Header"
              value={content.auto_send_header}
              onChange={(v) => setContent({ ...content, auto_send_header: v })}
            />
            <RichTextEditor
              label="Google Sheets Description"
              value={content.auto_send_description}
              onChange={(v) => setContent({ ...content, auto_send_description: v })}
            />
        </DesignerCard>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4 text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold text-slate-800 tracking-tight">Debrief Clarity</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80 italic">
            This is the final page participants see. Transparently explaining the study's purpose and allowing them to download their data is a research best practice.
          </p>
        </div>
      </div>
    </div>
  );
}
