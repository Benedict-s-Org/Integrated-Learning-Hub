import { useState } from "react";
import type { PostSurveyData } from "../types/experiment";

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
    <div className="space-y-2">
      <p className="text-sm text-gray-700">{label}</p>
      <div className="flex items-center gap-1">
        {lowLabel && (
          <span className="text-xs text-gray-400 w-20 text-right mr-1 shrink-0">
            {lowLabel}
          </span>
        )}
        <div className="flex gap-1 flex-1 justify-center">
          {options.map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all border-2 ${
                value === n
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-200 hover:border-blue-300 text-gray-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {highLabel && (
          <span className="text-xs text-gray-400 w-20 ml-1 shrink-0">
            {highLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PostSurvey({ groupId, onComplete }: Props) {
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
    form.task2Difficulty > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Post-Task Questionnaire
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Please answer the following questions honestly. There are no right or wrong answers.
          </p>
        </div>

        {/* Section 1: Optimism */}
        <div className="bg-blue-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            🌟 Optimism Scale
          </h2>
          <p className="text-xs text-gray-500">
            Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)
          </p>
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

        {/* Section 2: Need for Cognition */}
        <div className="bg-emerald-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            🧠 Thinking Style
          </h2>
          <p className="text-xs text-gray-500">
            Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)
          </p>
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

        {/* Section 3: Task Difficulty */}
        <div className="bg-amber-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            📊 Task Perception
          </h2>
          <p className="text-xs text-gray-500">
            How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)
          </p>
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

        {/* Section 4: Past Experience */}
        <div className="bg-violet-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            📚 Past Experience
          </h2>
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

        {/* Section 5: Manipulation Check */}
        <div className="bg-rose-50 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">
            ✅ Comprehension Check
          </h2>
          <p className="text-sm text-gray-700">
            When you made your time predictions, who were you predicting for?
          </p>
          <div className="flex gap-3">
            {[
              { value: "self", label: "Myself" },
              { value: "other", label: "Other students" },
              { value: "unsure", label: "Not sure" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("manipulationCheck", opt.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  form.manipulationCheck === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.manipulationCheck &&
            form.manipulationCheck !== groupId &&
            form.manipulationCheck !== "unsure" && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ This does not match your assigned group. Your data may be flagged.
              </p>
            )}
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            💬 Any comments or feedback? (optional)
          </label>
          <textarea
            value={form.comments}
            onChange={(e) => update("comments", e.target.value)}
            placeholder="Share any thoughts about the experiment..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors resize-none"
          />
        </div>

        <button
          onClick={() => onComplete(form)}
          disabled={!allLikertsFilled}
          className={`w-full py-3 rounded-xl font-semibold text-lg transition-all ${
            allLikertsFilled
              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {allLikertsFilled
            ? "Submit & View Results →"
            : "Please answer all required questions"}
        </button>
      </div>
    </div>
  );
}
