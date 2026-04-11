import type { TaskResult } from "../types/experiment";

interface Props {
  result: TaskResult;
  onNext: () => void;
  isLast: boolean;
  cmsContent?: any;
}

/**
 * PFI = (Actual Time − Predicted Time) / Predicted Time
 * Only counts answered questions (excludes skipped).
 * Returns null if all questions were skipped (invalid data).
 */
function calculatePFI(result: TaskResult): number | null {
  const answered = result.responses.filter((r) => !r.skipped);
  if (answered.length === 0) return null;

  const totalPredicted = result.predictionSeconds * answered.length;
  const totalActual = answered.reduce((sum, r) => sum + r.timeTaken, 0);

  if (totalPredicted === 0) return null;
  return (totalActual - totalPredicted) / totalPredicted;
}

export default function TaskComplete({ result, onNext, isLast, cmsContent }: Props) {
  const pfi = calculatePFI(result);
  const answered = result.responses.filter((r) => !r.skipped);
  const correct = answered.filter((r) => r.isCorrect).length;
  const skipped = result.responses.filter((r) => r.skipped).length;
  const totalTime = result.responses.reduce((sum, r) => sum + r.timeTaken, 0);

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3">
        
        {/* Main Header Block */}
        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {pfi !== null && pfi > 0 ? "🤔" : "✅"}
              </div>
              <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: cmsContent?.title || `${result.taskName} Complete!` }} />
            </div>
          </div>
        </div>

        {/* Results Block */}
        <div className="bg-white rounded-[8px] border p-6 space-y-6" style={{ borderColor: "#dadce0" }}>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f8f9fa] border rounded p-4 text-center" style={{ borderColor: "#dadce0" }}>
              <p className="text-xl font-medium text-[#1a73e8]">
                {correct}/{result.responses.length}
              </p>
              <p className="text-xs text-[#5f6368] mt-1" dangerouslySetInnerHTML={{ __html: cmsContent?.stat_correct_label || "Correct" }} />
            </div>
            <div className="bg-[#f8f9fa] border rounded p-4 text-center" style={{ borderColor: "#dadce0" }}>
              <p className="text-xl font-medium text-[#f29900]">{skipped}</p>
              <p className="text-xs text-[#5f6368] mt-1" dangerouslySetInnerHTML={{ __html: cmsContent?.stat_skipped_label || "Skipped" }} />
            </div>
            <div className="bg-[#f8f9fa] border rounded p-4 text-center" style={{ borderColor: "#dadce0" }}>
              <p className="text-xl font-medium text-[#188038]">
                {result.predictionSeconds}s
              </p>
              <p className="text-xs text-[#5f6368] mt-1" dangerouslySetInnerHTML={{ __html: (cmsContent?.stat_predicted_label || "Predicted / question").replace('s', '') }} />
            </div>
            <div className="bg-[#f8f9fa] border rounded p-4 text-center" style={{ borderColor: "#dadce0" }}>
              <p className="text-xl font-medium text-[#673ab7]">
                {totalTime}s
              </p>
              <p className="text-xs text-[#5f6368] mt-1" dangerouslySetInnerHTML={{ __html: (cmsContent?.stat_actual_label || "Actual total time").replace('s', '') }} />
            </div>
          </div>

          {/* PFI */}
          <div
            className={`rounded border p-5 text-center ${
              pfi === null
                ? "bg-[#fce8e6] border-[#f28b82]"
                : pfi > 0.5
                ? "bg-[#fef7e0] border-[#fde293]"
                : "bg-[#e6f4ea] border-[#81c995]"
            }`}
          >
            <p className="text-sm text-[#202124] mb-2 font-medium" dangerouslySetInnerHTML={{ __html: cmsContent?.pfi_label || "Planning Fallacy Index (PFI)" }} />
            {pfi === null ? (
              <p className="text-lg font-medium text-[#d93025]" dangerouslySetInnerHTML={{ __html: cmsContent?.pfi_invalid_text || "N/A (invalid data — all skipped)" }} />
            ) : (
              <>
                <p className="text-3xl font-medium text-[#202124]">
                  {pfi.toFixed(2)}
                </p>
                <p className="text-xs text-[#5f6368] mt-2" dangerouslySetInnerHTML={{ __html: pfi > 0
                    ? (cmsContent?.pfi_underestimate_text || "You underestimated the time needed")
                    : (cmsContent?.pfi_overestimate_text || "You overestimated the time needed") }} />
              </>
            )}
          </div>

          {/* Question breakdown */}
          <div className="space-y-3 pt-2">
            <h2 className="text-base font-medium text-[#202124]" dangerouslySetInnerHTML={{ __html: cmsContent?.breakdown_label || "Question breakdown:" }} />
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {result.responses.map((r, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center px-4 py-2.5 rounded text-sm border ${
                    r.skipped
                      ? "bg-[#fce8e6] border-[#f28b82] text-[#d93025]"
                      : r.isCorrect
                      ? "bg-[#e6f4ea] border-[#81c995] text-[#188038]"
                      : "bg-[#fef7e0] border-[#fde293] text-[#f29900]"
                  }`}
                >
                  <span className="font-medium">
                    {cmsContent?.breakdown_q_prefix || "Q"}{i + 1}: {r.letters}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: r.skipped
                      ? (cmsContent?.breakdown_skipped_text || "Skipped")
                      : r.isCorrect
                      ? (cmsContent?.breakdown_correct_template || "✓ {ans} ({timer}s)").replace("{ans}", r.userAnswer).replace("{timer}", r.timeTaken.toString())
                      : (cmsContent?.breakdown_incorrect_template || "✗ ({timer}s, {tries} tries)").replace("{timer}", r.timeTaken.toString()).replace("{tries}", r.attempts.toString())
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Block */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onNext}
            className="px-6 py-2 rounded-[4px] font-medium text-sm transition-colors bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
          >
            <span dangerouslySetInnerHTML={{ __html: cmsContent?.button_text || (isLast ? "View Results" : "Continue to Next Task") }} />
          </button>
        </div>
      </div>
    </div>
  );
}
