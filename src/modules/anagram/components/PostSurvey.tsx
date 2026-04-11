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
    <div className="space-y-4 text-left">
      <p className="text-sm font-medium text-[#202124]" dangerouslySetInnerHTML={{ __html: label }} />
      <div className="flex items-center gap-2 flex-wrap">
        {lowLabel && (
          <span className="text-xs text-[#70757a] w-16 text-right mr-1 shrink-0" dangerouslySetInnerHTML={{ __html: lowLabel }} />
        )}
        <div className="flex gap-2 flex-1 justify-center flex-wrap">
          {options.map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className="w-10 h-10 rounded-full text-sm font-medium transition-all border shrink-0 flex items-center justify-center"
              style={{
                borderColor: value === n ? "#673ab7" : "#dadce0",
                backgroundColor: value === n ? "#673ab7" : "transparent",
                color: value === n ? "#fff" : "#202124",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        {highLabel && (
          <span className="text-xs text-[#70757a] w-16 ml-1 shrink-0" dangerouslySetInnerHTML={{ __html: highLabel }} />
        )}
      </div>
    </div>
  );
}

export default function PostSurvey({ groupId, onComplete }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 3;
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

  const isPage1Valid =
    form.optimism1 > 0 &&
    form.optimism2 > 0 &&
    form.optimism3 > 0 &&
    form.nfc1 > 0 &&
    form.nfc2 > 0 &&
    form.nfc3 > 0;

  const isPage2Valid =
    form.task1Difficulty > 0 &&
    form.task2Difficulty > 0 &&
    form.pastAnagramExperience > 0 &&
    form.pastPsychExperience > 0;

  const isPage3Valid =
    (content?.customQuestions || []).every((q: any) => 
      !q.enabled || (form.dynamicResponses?.[q.id] > 0)
    );

  const canProceed = 
    currentPage === 1 ? isPage1Valid : 
    currentPage === 2 ? isPage2Valid : 
    isPage3Valid;

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
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3 relative group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute -top-3 -right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert("Navigate to Admin Panel -> Content Editing -> Post-Experiment Survey to edit this page")}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#4285f4] text-white rounded-[4px] text-xs font-medium shadow-sm hover:bg-blue-600 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}

        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6 space-y-3">
            <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
            <p className="text-sm text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.subtitle }} />
            <div className="pt-2 border-t border-gray-100 mt-4">
              <p className="text-[#d93025] text-sm font-medium">
                * Indicates required question
              </p>
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
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-3">
            {/* Section 1: Optimism */}
            <div className="bg-white rounded-[8px] border p-6 space-y-5" style={{ borderColor: "#dadce0" }}>
              <div className="space-y-1 text-left">
                <h2 className="text-base font-medium text-[#202124]">
                  <span dangerouslySetInnerHTML={{ __html: displayContent.sections?.optimism?.title }} />
                  <span className="text-[#d93025] ml-1">*</span>
                </h2>
                <p className="text-sm text-[#5f6368]" dangerouslySetInnerHTML={{ __html: displayContent.sections?.optimism?.description }} />
              </div>
              <div className="space-y-8 mt-4">
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
            <div className="bg-white rounded-[8px] border p-6 space-y-5" style={{ borderColor: "#dadce0" }}>
              <div className="space-y-1 text-left">
                <h2 className="text-base font-medium text-[#202124]">
                  <span dangerouslySetInnerHTML={{ __html: displayContent.sections?.thinking?.title }} />
                  <span className="text-[#d93025] ml-1">*</span>
                </h2>
                <p className="text-sm text-[#5f6368]" dangerouslySetInnerHTML={{ __html: displayContent.sections?.thinking?.description }} />
              </div>
              <div className="space-y-8 mt-4">
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
          </div>
        )}

        {currentPage === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-3">
            {/* Section 3: Task Difficulty */}
            <div className="bg-white rounded-[8px] border p-6 space-y-5" style={{ borderColor: "#dadce0" }}>
              <div className="space-y-1 text-left">
                <h2 className="text-base font-medium text-[#202124]">
                  <span dangerouslySetInnerHTML={{ __html: displayContent.sections?.perception?.title }} />
                  <span className="text-[#d93025] ml-1">*</span>
                </h2>
                <p className="text-sm text-[#5f6368]" dangerouslySetInnerHTML={{ __html: displayContent.sections?.perception?.description }} />
              </div>
              <div className="space-y-8 mt-4">
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
            <div className="bg-white rounded-[8px] border p-6 space-y-5" style={{ borderColor: "#dadce0" }}>
              <h2 className="text-base font-medium text-[#202124] text-left">
                 <span dangerouslySetInnerHTML={{ __html: displayContent.sections?.experience?.title }} />
                 <span className="text-[#d93025] ml-1">*</span>
              </h2>
              <div className="space-y-8 mt-4">
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
          </div>
        )}

        {currentPage === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-3">


            {/* Dynamic Questions from CMS */}
            {(content?.customQuestions || []).filter((q: any) => q.enabled).map((q: any) => (
              <div key={q.id} className="bg-white rounded-[8px] border p-6 space-y-4" style={{ borderColor: "#dadce0" }}>
                <h2 className="text-base font-medium text-[#202124]">
                  {q.label}
                  <span className="text-[#d93025] ml-1">*</span>
                </h2>
                <LikertScale
                  label=""
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
            <div className="bg-white rounded-[8px] border p-6 space-y-4 text-left" style={{ borderColor: "#dadce0" }}>
              <label className="block text-base font-medium text-[#202124]">
                Any comments or feedback? (optional)
              </label>
              <textarea
                value={form.comments}
                onChange={(e) => update("comments", e.target.value)}
                placeholder="Your answer"
                rows={2}
                className="w-full md:w-3/4 px-0 py-1.5 border-b border-gray-300 focus:border-[#673ab7] focus:border-b-2 focus:outline-none transition-colors text-sm text-[#202124] bg-transparent resize-y min-h-[44px]"
              />
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
               className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-colors ${
                 canProceed
                   ? "bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
                   : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed border border-transparent"
               }`}
               disabled={!canProceed}
             >
               Next
             </button>
          ) : (
            <button
              onClick={() => onComplete(form)}
              disabled={!canProceed}
              className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-colors ${
                canProceed
                  ? "bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
                  : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed border border-transparent"
              }`}
            >
              Submit
            </button>
          )}

          <div className="flex-1 flex justify-end">
             {!canProceed && (
               <div className="text-[#d93025] text-sm flex items-center gap-1">
                 <svg aria-hidden="true" className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>
                 <span>Complete required questions on this page</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
