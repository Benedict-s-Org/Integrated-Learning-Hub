import { useState } from "react";

interface Props {
  groupId: "self" | "other";
  onStart: () => void;
}

export default function Welcome({ groupId, onStart }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🧠</div>
          <h1 className="text-3xl font-bold text-gray-900">
            Cognitive Task Experiment
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Things Are Harder Than They Seem: Self vs. Other Predictions
          </p>
        </div>

        <div className="bg-blue-50 rounded-xl p-5 space-y-3 text-sm text-gray-700">
          <h2 className="font-semibold text-gray-900 text-lg">
            📋 Study Information
          </h2>
          <p>
            You will complete two sets of <strong>anagram puzzles</strong> —
            rearranging scrambled letters to form English words.
          </p>
          <p>
            Before each set, you will be asked to{" "}
            <strong>predict how many seconds</strong> it will take you to
            complete each puzzle.
          </p>
          <p>
            <strong>Your group:</strong>{" "}
            {groupId === "self"
              ? 'You will predict for "yourself"'
              : 'You will predict for "other students"'}
          </p>
          <p>
            Each set has <strong>10 puzzles</strong>. You have up to{" "}
            <strong>5 attempts</strong> per puzzle. If you can't solve it, you
            can skip.
          </p>
        </div>

        <div className="bg-amber-50 rounded-xl p-5 space-y-2 text-sm text-gray-700">
          <h2 className="font-semibold text-gray-900 text-lg">
            ⚠️ Important Notes
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Each timer starts when you see the puzzle</li>
            <li>Type your answer and press Enter or click Submit</li>
            <li>You can skip any puzzle (max 5 attempts)</li>
            <li>Your data will be used for research purposes only</li>
          </ul>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            I understand the study and agree to participate
          </span>
        </label>

        <button
          onClick={onStart}
          disabled={!agreed}
          className={`w-full py-3 rounded-xl font-semibold text-lg transition-all ${
            agreed
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {agreed ? "Start Experiment →" : "Please agree to continue"}
        </button>
      </div>
    </div>
  );
}
