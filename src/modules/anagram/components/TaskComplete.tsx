import type { TaskResult } from "../types/experiment";

interface Props {
  result: TaskResult;
  onNext: () => void;
  isLast: boolean;
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

export default function TaskComplete({ result, onNext, isLast }: Props) {
  const pfi = calculatePFI(result);
  const answered = result.responses.filter((r) => !r.skipped);
  const correct = answered.filter((r) => r.isCorrect).length;
  const skipped = result.responses.filter((r) => r.skipped).length;
  const totalTime = result.responses.reduce((sum, r) => sum + r.timeTaken, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">
            {pfi !== null && pfi > 0 ? "🤔" : "✅"}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {result.taskName} Complete!
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {correct}/{result.responses.length}
            </p>
            <p className="text-xs text-gray-500">Correct</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{skipped}</p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {result.predictionSeconds}s
            </p>
            <p className="text-xs text-gray-500">Predicted / question</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">
              {totalTime}s
            </p>
            <p className="text-xs text-gray-500">Actual total time</p>
          </div>
        </div>

        {/* PFI */}
        <div
          className={`rounded-xl p-5 text-center ${
            pfi === null
              ? "bg-red-50 border-2 border-red-200"
              : pfi > 0.5
              ? "bg-amber-50"
              : "bg-emerald-50"
          }`}
        >
          <p className="text-sm text-gray-500 mb-1">
            Planning Fallacy Index (PFI)
          </p>
          {pfi === null ? (
            <p className="text-xl font-bold text-red-600">
              N/A (invalid data — all skipped)
            </p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {pfi.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {pfi > 0
                  ? "You underestimated the time needed"
                  : "You overestimated the time needed"}
              </p>
            </>
          )}
        </div>

        {/* Question breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">
            Question breakdown:
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.responses.map((r, i) => (
              <div
                key={i}
                className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${
                  r.skipped
                    ? "bg-red-50 text-red-600"
                    : r.isCorrect
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span>
                  Q{i + 1}: {r.letters}
                </span>
                <span>
                  {r.skipped
                    ? "Skipped"
                    : r.isCorrect
                    ? `✓ ${r.userAnswer} (${r.timeTaken}s)`
                    : `✗ (${r.timeTaken}s, ${r.attempts} tries)`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl font-semibold text-lg bg-violet-600 text-white hover:bg-violet-700 shadow-lg transition-all"
        >
          {isLast ? "View Results →" : "Continue to Next Task →"}
        </button>
      </div>
    </div>
  );
}
