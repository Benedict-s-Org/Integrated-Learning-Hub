import { useState, useRef, useEffect } from "react";

interface Props {
  taskName: string;
  taskDescription: string;
  targetLabel: string;
  onConfirm: (seconds: number) => void;
  cmsContent?: any;
}

export default function PredictionScreen({
  taskName,
  taskDescription,
  targetLabel,
  onConfirm,
  cmsContent,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const numValue = parseInt(value);
  const minVal = cmsContent?.min_val ?? 1;
  const maxVal = cmsContent?.max_val ?? 600;
  const isValid = !isNaN(numValue) && numValue >= minVal && numValue <= maxVal;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (isValid) onConfirm(numValue);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <div className="text-4xl mb-3">⏱️</div>
          <h2 className="text-2xl font-bold text-gray-900" dangerouslySetInnerHTML={{ __html: cmsContent?.title || "Time Prediction" }} />
        </div>

        {/* Task info */}
        <div className="bg-indigo-50 rounded-xl p-5 space-y-2">
          <p className="text-center font-semibold text-indigo-800" dangerouslySetInnerHTML={{ __html: taskName }} />
          <p className="text-center text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: taskDescription }} />
        </div>

        {/* Question */}
        <div className="text-center">
          <p className="text-gray-700 text-lg">
            {(cmsContent?.question_text || "How many <strong>seconds</strong> do you think <strong class=\"text-indigo-600\">[target]</strong> will need to solve <strong>each puzzle</strong>?").split('[target]').map((part: string, i: number, arr: any[]) => (
              <span key={i}>
                <span dangerouslySetInnerHTML={{ __html: part }} />
                {i < arr.length - 1 && <strong className="text-indigo-600">{targetLabel}</strong>}
              </span>
            ))}
          </p>
        </div>

        {/* Free input only — no preset buttons to avoid anchoring bias */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={maxVal}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={cmsContent?.input_placeholder || "Enter seconds"}
              className={`w-40 px-4 py-3 border-2 rounded-xl text-center text-2xl font-bold focus:outline-none transition-all ${
                isValid
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : value.length > 0
                  ? "border-red-300 bg-red-50 text-red-600"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            />
            <span className="text-gray-600 font-medium text-lg">
              seconds<br />
              <span className="text-sm text-gray-400">per puzzle</span>
            </span>
          </div>

          {/* Validation hint */}
          {value.length > 0 && !isValid && (
            <p className="text-sm text-red-500">
              Please enter a number between {minVal} and {maxVal}
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="text-center py-2">
          {isValid ? (
            <p className="text-lg text-gray-700">
              Your prediction:{" "}
              <span className="font-bold text-indigo-600 text-2xl">
                {numValue}s
              </span>{" "}
              per puzzle
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Enter your estimated time above
            </p>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`w-full py-3 rounded-xl font-semibold text-lg transition-all ${
            isValid
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <span dangerouslySetInnerHTML={{ __html: cmsContent?.confirm_button || "Confirm Prediction →" }} />
        </button>
      </div>
    </div>
  );
}
