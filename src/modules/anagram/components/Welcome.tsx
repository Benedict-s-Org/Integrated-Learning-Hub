import { useState, useEffect } from "react";
import { useCMS } from "../../../hooks/useCMS";
import { useAuth } from "../../../context/AuthContext";
import { Edit2, Loader2 } from "lucide-react";

interface Props {
  groupId: "self" | "other";
  onStart: () => void;
}

export default function Welcome({ groupId, onStart }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;
  const { getContent, loading: cmsLoading } = useCMS();
  const { isAdmin } = useAuth();
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const loadContent = async () => {
      const data = await getContent("anagram_welcome");
      if (data) {
        setContent(data.content);
      }
    };
    loadContent();
  }, [getContent]);

  // Fallback content if DB fetch fails or is empty
  const displayContent = content || {
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
  };

  if (cmsLoading && !content) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Loading Experiment Content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3 relative group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute -top-3 -right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert("Navigate to Admin Panel -> Content Editing -> Welcome & Consent to edit this page")}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#4285f4] text-white rounded-[4px] text-xs font-medium shadow-sm hover:bg-blue-600 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}

        {/* Main Header Block */}
        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl transform group-hover:scale-110 transition-transform duration-500">🧠</div>
              <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
            </div>
            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-[#5f6368] text-sm" dangerouslySetInnerHTML={{ __html: displayContent.subtitle }} />
            </div>
          </div>
        </div>

        {/* Pagination Progress */}
        <div className="flex items-center gap-2 mb-6 text-[#5f6368] text-sm font-medium">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex-1 max-w-[200px] h-2.5 bg-[#e8eaed] rounded-full overflow-hidden ml-2">
            <div className="h-full bg-[#673ab7] transition-all duration-300" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
          </div>
        </div>

        {currentPage === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
            {/* Info Block 1 */}
            <div className="bg-white rounded-[8px] border p-6 space-y-4" style={{ borderColor: "#dadce0" }}>
              <h2 className="text-base font-medium text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.study_info_title }} />
              <div className="space-y-3 text-sm text-[#202124]">
                {displayContent.study_info_items.map((item: string, idx: number) => (
                  <p key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: item }} />
                ))}

              </div>
            </div>
          </div>
        )}

        {currentPage === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
            {/* Info Block 2 */}
            <div className="bg-white rounded-[8px] border p-6 space-y-4" style={{ borderColor: "#dadce0" }}>
              <h2 className="text-base font-medium text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.notes_title }} />
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-[#202124]">
                {displayContent.notes_items.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#673ab7] mt-0.5">•</span>
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Consent Block */}
            <div className="bg-white rounded-[8px] border p-6 space-y-6" style={{ borderColor: "#dadce0" }}>
              <label className="flex items-center gap-4 cursor-pointer hover:bg-[#f8f9fa] rounded-md px-2 -mx-2 py-1 transition-colors select-none">
                <div className="relative flex items-center shrink-0">
                  <input
                    type="checkbox"
                    id="consent-checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 transition-all checked:border-[#673ab7] checked:bg-[#673ab7] border-[#5f6368] focus:outline-none"
                  />
                  <svg
                    className="absolute left-0.5 top-0.5 h-4 w-4 stroke-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.consent_text }} />
              </label>
            </div>
          </div>
        )}

        {/* Navigation Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 mt-8 border-t border-gray-200">
          {currentPage > 1 ? (
             <button
               onClick={() => setCurrentPage(p => p - 1)}
               className="px-6 py-2 rounded-[4px] font-medium text-sm transition-colors text-[#673ab7] hover:bg-purple-50"
             >
               Back
             </button>
          ) : <div />}
          
          {currentPage < totalPages ? (
             <button
               onClick={() => setCurrentPage(p => p + 1)}
               className="px-6 py-2 rounded-[4px] font-medium text-sm transition-colors bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
             >
               Next
             </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!agreed}
              className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-colors ${
                agreed
                  ? "bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
                  : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed border border-transparent"
              }`}
            >
              <span dangerouslySetInnerHTML={{ __html: displayContent.start_button_text ? displayContent.start_button_text.replace("→", "").trim() : "Submit" }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
