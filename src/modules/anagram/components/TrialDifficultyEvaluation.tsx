import { useState } from "react";

type DifficultyValue = 'easy' | 'moderate' | 'difficult';

interface Props {
  onBack: () => void;
  onSubmit: (difficulty: DifficultyValue) => void;
  cmsContent?: any;
}

export default function TrialDifficultyEvaluation({ onBack, onSubmit, cmsContent }: Props) {
  const [selected, setSelected] = useState<DifficultyValue | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);

  const finalTitle = cmsContent?.title || "Practice Trial Check";
  const finalSubtitle = cmsContent?.subtitle || "Before you continue, please rate how difficult the practice trial felt overall.";
  const finalQuestionLabel = cmsContent?.question_label || "Practice trial difficulty (overall)";
  const finalHelperText = cmsContent?.helper_text || "Rate the difficulty of solving the puzzles, not just whether you got them correct.";

  const options: { label: string; value: DifficultyValue }[] = [
    { label: cmsContent?.opt_easy || "Easy", value: "easy" },
    { label: cmsContent?.opt_moderate || "Moderate", value: "moderate" },
    { label: cmsContent?.opt_difficult || "Difficult", value: "difficult" },
  ];

  const handleContinue = () => {
    if (selected) {
      onSubmit(selected);
    } else {
      setErrorVisible(true);
    }
  };

  const handleOptionSelect = (value: DifficultyValue) => {
    setSelected(value);
    setErrorVisible(false);
  };

  return (
    <div className="min-h-screen py-8 px-4 flex flex-col items-center" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="w-full max-w-[560px] space-y-3">
        
        {/* Header Card */}
        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6 space-y-2">
            <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: finalTitle }} />
            <p className="text-[#202124] text-sm" dangerouslySetInnerHTML={{ __html: finalSubtitle }} />
          </div>
        </div>

        {/* Question Card */}
        <div 
          className="bg-white rounded-[8px] border p-6 space-y-6" 
          style={{ borderColor: errorVisible ? "#d93025" : "#dadce0" }}
        >
          <div className="space-y-1">
            <h2 className="text-base font-medium text-[#202124]">
              <span dangerouslySetInnerHTML={{ __html: finalQuestionLabel }} />
              <span className="text-[#d93025] ml-1">*</span>
            </h2>
            <p className="text-xs text-[#5f6368]" dangerouslySetInnerHTML={{ __html: finalHelperText }} />
          </div>

          <div className="space-y-1 -mx-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#f8f9fa] transition-colors group select-none"
                onClick={() => handleOptionSelect(option.value)}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <input
                    type="radio"
                    name="difficulty"
                    value={option.value}
                    checked={selected === option.value}
                    onChange={() => handleOptionSelect(option.value)}
                    className="sr-only"
                    aria-label={option.label}
                  />
                  <div 
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selected === option.value 
                        ? "border-[#673ab7]" 
                        : "border-[#5f6368] group-hover:border-[#202124]"
                    }`}
                  >
                    {selected === option.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#673ab7]" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-[#202124] font-medium" dangerouslySetInnerHTML={{ __html: option.label }} />
              </label>
            ))}
          </div>

          {errorVisible && (
            <div className="flex items-center gap-2 text-[#d93025] text-xs font-medium animate-in fade-in slide-in-from-top-1">
              <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
              </svg>
              <span>Please select one option to continue.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#673ab7]"
          >
            Back
          </button>
          
          <button
            onClick={handleContinue}
            disabled={!selected && !errorVisible}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleContinue();
            }}
            className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#673ab7] ${
              selected
                ? "bg-[#673ab7] text-white hover:bg-[#5b32a3] active:bg-[#4f2b8f]"
                : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>

        {/* Privacy Note */}
        <div className="pt-8 text-center px-4">
          <p className="text-[11px] text-[#5f6368] leading-relaxed">
            Your response is anonymous and used for research only.
          </p>
        </div>

      </div>
    </div>
  );
}
