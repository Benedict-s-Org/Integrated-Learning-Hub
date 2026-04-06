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
    start_button_text: "Start Experiment →"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-8 relative overflow-hidden group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert("Navigate to Admin Panel -> Content Editing -> Welcome & Consent to edit this page")}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}

        <div className="text-center">
          <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform duration-500">🧠</div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
          <p className="text-slate-500 mt-3 text-lg font-medium max-w-md mx-auto" dangerouslySetInnerHTML={{ __html: displayContent.subtitle }} />
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4 text-slate-700 relative group/section">
          <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2" dangerouslySetInnerHTML={{ __html: displayContent.study_info_title }} />
          <div className="space-y-3">
            {displayContent.study_info_items.map((item: string, idx: number) => (
              <p key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: item }} />
            ))}
            <p className="bg-white/60 p-3 rounded-lg border border-blue-100 inline-block">
              <strong className="text-blue-700">Your assigned group:</strong>{" "}
              {groupId === "self"
                ? 'You will predict for "yourself"'
                : 'You will predict for "other students"'}
            </p>
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 space-y-3 text-slate-700">
          <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2" dangerouslySetInnerHTML={{ __html: displayContent.notes_title }} />
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {displayContent.notes_items.map((item: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-amber-500 mt-1">•</span>
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6 pt-4">
          <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl hover:bg-slate-50 transition-colors select-none group/consent">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id="consent-checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 focus:outline-none"
              />
              <svg
                className="absolute left-1 top-1 h-4 w-4 stroke-white opacity-0 transition-opacity peer-checked:opacity-100"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-base font-medium text-slate-700 group-hover/consent:text-slate-900 transition-colors" dangerouslySetInnerHTML={{ __html: displayContent.consent_text }} />
          </label>

          <button
            onClick={onStart}
            disabled={!agreed}
            className={`w-full py-4 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
              agreed
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {agreed ? (
              <>
                <span dangerouslySetInnerHTML={{ __html: displayContent.start_button_text }} />
              </>
            ) : (
              "Please agree to continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
