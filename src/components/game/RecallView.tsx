import React, { useState } from "react";
import { Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Locus {
  id: string;
  name?: string;
  isFurniture?: boolean;
}

interface RecallViewProps {
  items: string[];
  loci: Locus[];
  associations: Record<string, string>;
  onFinish: (answers: Record<string, string>) => void;
}

export const RecallView: React.FC<RecallViewProps> = ({
  items,
  loci,
  associations,
  onFinish,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState<string | null>(null);

  const allAnswered = Object.keys(answers).length >= Math.min(items.length, loci.length);

  const handleSelect = (locId: string, item: string) => {
    setAnswers((prev) => ({ ...prev, [locId]: item }));
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-amber-50 to-white">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full mb-4">
          <Eye size={20} />
          <span className="font-bold">回憶階段</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">回想每個位置的詞彙</h2>
        <p className="text-slate-500">點擊位置，選擇你記住的詞彙</p>
      </div>

      <div className="flex gap-12 mb-8 max-w-4xl w-full">
        {/* Loci with answers */}
        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">記憶位置</h3>
          <div className="space-y-3">
            {loci.slice(0, items.length).map((loc, idx) => {
              const answer = answers[loc.id];
              return (
                <div
                  key={loc.id}
                  onClick={() => setShowHint(showHint === loc.id ? null : loc.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    answer
                      ? "border-amber-400 bg-amber-50"
                      : showHint === loc.id
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      #{idx + 1} {loc.name || `位置 ${idx + 1}`}
                    </span>
                    {answer && (
                      <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {answer}
                      </span>
                    )}
                  </div>

                  {/* Item selection dropdown */}
                  {showHint === loc.id && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((item) => {
                          const isSelected = answers[loc.id] === item;
                          const isUsedElsewhere = Object.entries(answers).some(
                            ([k, v]) => k !== loc.id && v === item
                          );
                          return (
                            <button
                              key={item}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isUsedElsewhere) {
                                  handleSelect(loc.id, item);
                                  setShowHint(null);
                                }
                              }}
                              disabled={isUsedElsewhere}
                              className={`p-2 rounded-lg text-xs font-medium transition-all ${
                                isSelected
                                  ? "bg-amber-500 text-white"
                                  : isUsedElsewhere
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-100 text-slate-700 hover:bg-amber-200"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="w-48 bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">進度</h3>
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-600 mb-2">
              {Object.keys(answers).length}/{Math.min(items.length, loci.length)}
            </div>
            <p className="text-slate-500 text-sm">已回答</p>
          </div>
          <div className="mt-6 space-y-2">
            {loci.slice(0, items.length).map((loc, idx) => (
              <div
                key={loc.id}
                className={`h-2 rounded-full transition-all ${
                  answers[loc.id] ? "bg-amber-400" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        onClick={() => onFinish(answers)}
        disabled={!allAnswered}
        className="px-8 py-3 text-lg"
        icon={CheckCircle}
      >
        提交答案
      </Button>
      {!allAnswered && (
        <p className="text-slate-400 text-sm mt-3">請為每個位置選擇一個詞彙</p>
      )}
    </div>
  );
};
