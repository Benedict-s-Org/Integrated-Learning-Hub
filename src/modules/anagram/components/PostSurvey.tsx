import { useState, useEffect } from "react";
import type { PostSurveyData } from "../types/experiment";
import { useCMS } from "../../../hooks/useCMS";
import { useAuth } from "../../../context/AuthContext";
import { Edit2, Loader2 } from "lucide-react";

interface Props {
  groupId: "self" | "other";
  onComplete: (data: PostSurveyData) => void;
}

function LikertScale({
  label,
  value,
  onChange,
  min = 1,
  max = 7,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-2 text-left">
      <p className="text-sm text-gray-700 font-medium" dangerouslySetInnerHTML={{ __html: label }} />
      <div className="flex items-center gap-1">
        {lowLabel && (
          <span className="text-xs text-gray-400 w-20 text-right mr-2 shrink-0" dangerouslySetInnerHTML={{ __html: lowLabel }} />
        )}
        <div className="flex gap-1.5 flex-1 justify-center">
          {options.map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all border-2 ${
                value === n
                  ? "border-blue-600 bg-blue-600 text-white shadow-md scale-110"
                  : "border-gray-100 hover:border-blue-200 bg-gray-50 text-gray-600 hover:bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {highLabel && (
          <span className="text-xs text-gray-400 w-20 ml-2 shrink-0" dangerouslySetInnerHTML={{ __html: highLabel }} />
        )}
      </div>
    </div>
  );
}

export default function PostSurvey({ groupId, onComplete }: Props) {
  const { getContent, loading: cmsLoading } = useCMS();
  const { isAdmin } = useAuth();
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const loadContent = async () => {
      const data = await getContent("anagram_survey");
      if (data) {
        setContent(data.content);
      }
    };
    loadContent();
  }, [getContent]);

  const [form, setForm] = useState<PostSurveyData>({
    optimism1: 0,
    optimism2: 0,
    optimism3: 0,
    nfc1: 0,
    nfc2: 0,
    nfc3: 0,
    pastAnagramExperience: 0,
    pastPsychExperience: 0,
    manipulationCheck: "",
    task1Difficulty: 0,
    task2Difficulty: 0,
    comments: "",
    dynamicResponses: {},
  });

  const update = <K extends keyof PostSurveyData>(
    key: K,
    value: PostSurveyData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const allLikertsFilled =
    form.optimism1 > 0 &&
    form.optimism2 > 0 &&
    form.optimism3 > 0 &&
    form.nfc1 > 0 &&
    form.nfc2 > 0 &&
    form.nfc3 > 0 &&
    form.pastAnagramExperience > 0 &&
    form.pastPsychExperience > 0 &&
    form.manipulationCheck !== "" &&
    form.task1Difficulty > 0 &&
    form.task2Difficulty > 0 &&
    (content?.customQuestions || []).every((q: any) => 
      !q.enabled || (form.dynamicResponses?.[q.id] > 0)
    );

  // Fallback content if DB fetch fails or is empty
  const defaultSurveyContent = {
    title: "Post-Task Questionnaire",
    subtitle: "Please answer the following questions honestly. There are no right or wrong answers.",
    sections: {
      optimism: {
        title: "🌟 Optimism Scale",
        description: "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
      },
      thinking: {
        title: "🧠 Thinking Style",
        description: "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
      },
      perception: {
        title: "📊 Task Perception",
        description: "How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)"
      },
      experience: {
        title: "📚 Past Experience",
        description: ""
      },
      check: {
        title: "✅ Comprehension Check",
        description: "When you made your time predictions, who were you predicting for?"
      }
    }
  };

  const displayContent = {
    ...defaultSurveyContent,
    ...content,
    sections: {
      ...defaultSurveyContent.sections,
      ...(content?.sections || {})
    }
  };

  if (cmsLoading && !content) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 middle:from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-10 relative group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert("Navigate to Admin Panel -> Content Editing -> Post-Experiment Survey to edit this page")}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}

        <div className="text-center">
          <div className="text-5xl mb-4 transform group-hover:rotate-12 transition-transform">📝</div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
          <p className="text-sm text-slate-500 mt-2 font-medium" dangerouslySetInnerHTML={{ __html: displayContent.subtitle }} />
        </div>

        {/* Section 1: Optimism */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-5">
          <div className="space-y-1 text-left">
            <h2 className="font-bold text-slate-900 text-lg" dangerouslySetInnerHTML={{ __html: displayContent.sections?.optimism?.title }} />
            <p className="text-xs text-slate-500 font-medium italic" dangerouslySetInnerHTML={{ __html: displayContent.sections?.optimism?.description }} />
          </div>
          <div className="space-y-6">
            <LikertScale
              label="1. I generally expect things to go well for me."
              value={form.optimism1}
              onChange={(v) => update("optimism1", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
            <LikertScale
              label="2. I rarely expect things to work out the way I want them to."
              value={form.optimism2}
              onChange={(v) => update("optimism2", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
            <LikertScale
              label="3. I'm always optimistic about my future."
              value={form.optimism3}
              onChange={(v) => update("optimism3", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
          </div>
        </div>

        {/* Section 2: Need for Cognition */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 space-y-5">
          <div className="space-y-1 text-left">
            <h2 className="font-bold text-slate-900 text-lg" dangerouslySetInnerHTML={{ __html: displayContent.sections?.thinking?.title }} />
            <p className="text-xs text-slate-500 font-medium italic" dangerouslySetInnerHTML={{ __html: displayContent.sections?.thinking?.description }} />
          </div>
          <div className="space-y-6">
            <LikertScale
              label="1. I enjoy tasks that require a lot of thinking."
              value={form.nfc1}
              onChange={(v) => update("nfc1", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
            <LikertScale
              label="2. I prefer complex problems over simple ones."
              value={form.nfc2}
              onChange={(v) => update("nfc2", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
            <LikertScale
              label="3. Thinking hard and for a long time is not my idea of fun."
              value={form.nfc3}
              onChange={(v) => update("nfc3", v)}
              lowLabel="Disagree"
              highLabel="Agree"
            />
          </div>
        </div>

        {/* Section 3: Task Difficulty */}
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 space-y-5">
          <div className="space-y-1 text-left">
            <h2 className="font-bold text-slate-900 text-lg" dangerouslySetInnerHTML={{ __html: displayContent.sections?.perception?.title }} />
            <p className="text-xs text-slate-500 font-medium italic" dangerouslySetInnerHTML={{ __html: displayContent.sections?.perception?.description }} />
          </div>
          <div className="space-y-6">
            <LikertScale
              label="Task 1 (3–4 letter words)"
              value={form.task1Difficulty}
              onChange={(v) => update("task1Difficulty", v)}
              lowLabel="Very Easy"
              highLabel="Very Hard"
            />
            <LikertScale
              label="Task 2 (5–6 letter words)"
              value={form.task2Difficulty}
              onChange={(v) => update("task2Difficulty", v)}
              lowLabel="Very Easy"
              highLabel="Very Hard"
            />
          </div>
        </div>

        {/* Section 4: Past Experience */}
        <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-6 space-y-5">
          <h2 className="font-bold text-slate-900 text-lg text-left" dangerouslySetInnerHTML={{ __html: displayContent.sections?.experience?.title }} />
          <div className="space-y-6">
            <LikertScale
              label="How often have you done word puzzles or anagram games before?"
              value={form.pastAnagramExperience}
              onChange={(v) => update("pastAnagramExperience", v)}
              min={1}
              max={5}
              lowLabel="Never"
              highLabel="Very often"
            />
            <LikertScale
              label="How often have you participated in psychology experiments before?"
              value={form.pastPsychExperience}
              onChange={(v) => update("pastPsychExperience", v)}
              min={1}
              max={5}
              lowLabel="Never"
              highLabel="Very often"
            />
          </div>
        </div>

        {/* Section 5: Manipulation Check */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-6 space-y-4">
          <div className="space-y-1 text-left">
            <h2 className="font-bold text-slate-900 text-lg" dangerouslySetInnerHTML={{ __html: displayContent.sections?.check?.title }} />
            <p className="text-sm text-slate-600 font-medium" dangerouslySetInnerHTML={{ __html: displayContent.sections?.check?.description }} />
          </div>
          <div className="flex gap-3">
            {[
              { value: "self", label: displayContent.option_self || "Myself" },
              { value: "other", label: displayContent.option_other || "Other students" },
              { value: "unsure", label: displayContent.option_unsure || "I'm not sure" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("manipulationCheck", opt.value)}
                className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all border-2 shadow-sm ${
                  form.manipulationCheck === opt.value
                    ? "border-blue-600 bg-white text-blue-600 ring-4 ring-blue-50"
                    : "border-transparent bg-slate-50 text-slate-400 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.manipulationCheck &&
            form.manipulationCheck !== groupId &&
            form.manipulationCheck !== "unsure" && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold animate-in slide-in-from-left">
                <span>⚠️ Note: Selection does not match assigned group.</span>
              </div>
            )}
        </div>

        {/* Dynamic Questions from CMS */}
        {(content?.customQuestions || []).filter((q: any) => q.enabled).map((q: any) => (
          <div key={q.id} className="bg-slate-50/50 border border-slate-200 rounded-3xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <LikertScale
              label={q.label}
              value={form.dynamicResponses?.[q.id] || 0}
              onChange={(v) => {
                const next = { ...(form.dynamicResponses || {}), [q.id]: v };
                update("dynamicResponses", next);
              }}
              min={q.min}
              max={q.max}
              lowLabel={q.lowLabel}
              highLabel={q.highLabel}
            />
          </div>
        ))}

        {/* Comments */}
        <div className="space-y-3 px-2 text-left">
          <label className="block text-sm font-bold text-slate-700">
            💬 Any comments or feedback? (optional)
          </label>
          <textarea
            value={form.comments}
            onChange={(e) => update("comments", e.target.value)}
            placeholder="Share any thoughts about the experiment..."
            rows={4}
            className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white focus:outline-none transition-all resize-none shadow-inner"
          />
        </div>

        <button
          onClick={() => onComplete(form)}
          disabled={!allLikertsFilled}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-[0.98] ${
            allLikertsFilled
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200"
              : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
          }`}
        >
          {allLikertsFilled
            ? "Complete & View Analysis →"
            : "Complete All Required Questions"}
        </button>
      </div>
    </div>
  );
}
