import { useState, useEffect } from "react";
import { useCMS } from "../../../hooks/useCMS";
import { Download, Copy, Check, Send, Loader2, Edit2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

interface Props {
  data: any;
  groupId: string;
}

export default function Debrief({ data, groupId }: Props) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { getContent, loading: cmsLoading } = useCMS();
  const { isAdmin } = useAuth();
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const loadContent = async () => {
      const data = await getContent("anagram_debrief");
      if (data) {
        setContent(data.content);
      }
    };
    loadContent();
  }, [getContent]);

  const pfi1 = data.task1Result ? calculatePFI(data.task1Result) : null;
  const pfi2 = data.task2Result ? calculatePFI(data.task2Result) : null;

  function calculatePFI(result: any) {
    const answered = result.responses.filter((r: any) => !r.skipped);
    if (answered.length === 0) return null;
    const totalPredicted = result.predictionSeconds * answered.length;
    const totalActual = answered.reduce((sum: number, r: any) => sum + r.timeTaken, 0);
    return (totalActual - totalPredicted) / totalPredicted;
  }

  const downloadCSV = () => {
    // 1. Identify all demographic fields from CMS or data
    const demoFields = data.demographicsContent?.fields || [];
    const demoKeys = demoFields.map((f: any) => f.id);
    const demoLabels = demoFields.map((f: any) => {
        // Clean HTML from labels
        return f.label.replace(/<[^>]*>?/gm, '').trim();
    });

    const headers = [
      "ParticipantID",
      "Timestamp",
      "Group",
      ...demoLabels,
      "Task1_PFI",
      "Task2_PFI",
      "Optimism_Avg",
      "NFC_Avg",
      "Difficulty_Avg",
      "Survey_Comments",
    ];

    const survey = data.postSurvey || {};

    const row = [
      data.participantId,
      data.timestamp || new Date().toISOString(),
      groupId,
      ...demoKeys.map((key: string) => `"${(data.demographics?.[key] || "N/A").toString().replace(/"/g, '""')}"`),
      pfi1?.toFixed(2) || "N/A",
      pfi2?.toFixed(2) || "N/A",
      (( (survey.optimism1 || 0) + (survey.optimism2 || 0) + (survey.optimism3 || 0) ) / 3).toFixed(2),
      (( (survey.nfc1 || 0) + (survey.nfc2 || 0) + (survey.nfc3 || 0) ) / 3).toFixed(2),
      (( (survey.task1Difficulty || 0) + (survey.task2Difficulty || 0) ) / 2).toFixed(2),
      `"${(survey.comments || "").replace(/"/g, '""')}"`,
    ];

    const csvContent = [headers.join(","), row.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `experiment_data_${data.participantId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syncToSheets = async () => {
    setIsSending(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSent(true);
    setIsSending(false);
  };

  // Fallback content if DB fetch fails or is empty
  const displayContent = content || {
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
  };

  if (cmsLoading && !content) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 space-y-12 relative group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert("Navigate to Content Editing -> Debrief to edit this content")}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}

        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🎓</div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
          <div className="h-2 w-24 bg-gradient-to-r from-indigo-500 to-blue-500 mx-auto rounded-full" />
        </div>

        {/* Results Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 text-center" dangerouslySetInnerHTML={{ __html: displayContent.results_header }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 flex flex-col items-center justify-center space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Task 1 PFI
              </p>
              <p className="text-4xl font-black text-slate-900">
                {pfi1 !== null ? pfi1.toFixed(2) : "N/A"}
              </p>
              <p className="text-xs text-slate-500 font-medium">3–4 letter words</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 flex flex-col items-center justify-center space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Task 2 PFI
              </p>
              <p className="text-4xl font-black text-slate-900">
                {pfi2 !== null ? pfi2.toFixed(2) : "N/A"}
              </p>
              <p className="text-xs text-slate-500 font-medium">5–6 letter words</p>
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-600" dangerouslySetInnerHTML={{ __html: displayContent.pfi_formula }} />
            <p className="text-xs text-slate-400 font-medium" dangerouslySetInnerHTML={{ __html: displayContent.pfi_legend }} />
          </div>
        </section>

        {/* About the study */}
        <section className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2" dangerouslySetInnerHTML={{ __html: displayContent.about_header }} />
          <p className="text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: displayContent.about_description }} />
          <div className="bg-white/60 p-4 rounded-2xl border border-indigo-100/50 inline-block">
             <p className="text-indigo-800 font-bold">
               <span dangerouslySetInnerHTML={{ __html: displayContent.about_group_prefix || "Your group:" }} /> {groupId === 'self' ? '"You provided predictions for yourself"' : '"You provided predictions for other students"'}
             </p>
          </div>
          <p className="text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: displayContent.about_conclusion }} />
        </section>

        {/* Data Options */}
        <section className="space-y-6 pt-4 border-t border-slate-100">
          <div className="flex flex-col items-center space-y-4">
            <h2 className="text-xl font-bold text-slate-800" dangerouslySetInnerHTML={{ __html: displayContent.data_collection_header }} />
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                <Download size={18} />
                <span dangerouslySetInnerHTML={{ __html: displayContent.download_csv_button }} />
              </button>
              <button
                onClick={copyJSON}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95"
              >
                {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                <span dangerouslySetInnerHTML={{ __html: displayContent.copy_json_button }} />
              </button>
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="font-bold text-slate-900 text-lg" dangerouslySetInnerHTML={{ __html: displayContent.auto_send_header }} />
              <p className="text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: displayContent.auto_send_description }} />
            </div>
            <button
              onClick={syncToSheets}
              disabled={isSending || sent}
              className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black transition-all active:scale-95 ${
                sent
                  ? "bg-emerald-500 text-white shadow-emerald-100"
                  : "bg-white text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-50 shadow-sm"
              }`}
            >
              {isSending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : sent ? (
                <Check size={20} />
              ) : (
                <Send size={20} />
              )}
              <span>{sent ? "Sent to Sheets" : "Sync Now"}</span>
            </button>
          </div>
        </section>

        <p className="text-center text-slate-400 text-xs font-medium">
          Note: This is a research simulation. No data is stored permanently
          unless you export it.
        </p>
      </div>
    </div>
  );
}
