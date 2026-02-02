import React from "react";
import { Trophy, Coins, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ResultViewProps {
  score: number;
  total: number;
  coinsEarned: number;
  onConfirm: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  score,
  total,
  coinsEarned,
  onConfirm,
}) => {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPerfect = score === total && total > 0;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-emerald-50 to-white">
      <div className="text-center mb-8">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
            isPerfect ? "bg-amber-400 text-amber-900" : "bg-emerald-500 text-white"
          }`}
        >
          <Trophy size={20} />
          <span className="font-bold">{isPerfect ? "完美！" : "訓練完成"}</span>
        </div>
        
        {isPerfect && (
          <div className="text-6xl mb-4">🎉</div>
        )}
        
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          {isPerfect ? "太棒了！" : "做得好！"}
        </h2>
        <p className="text-slate-500">你的記憶宮殿訓練已完成</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 max-w-sm w-full mb-8">
        {/* Score */}
        <div className="text-center mb-6">
          <div className="text-6xl font-bold text-emerald-600 mb-2">
            {score}/{total}
          </div>
          <div className="text-slate-500">正確答案</div>
          <div className="mt-4 bg-slate-100 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isPerfect ? "bg-amber-400" : "bg-emerald-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="text-sm text-slate-400 mt-2">{percentage}% 正確率</div>
        </div>

        {/* Coins earned */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-center gap-3">
            <div className="bg-amber-100 p-3 rounded-full">
              <Coins className="text-amber-600" size={28} />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">+{coinsEarned}</div>
              <div className="text-sm text-slate-500">金幣獲得</div>
            </div>
          </div>
          {isPerfect && (
            <div className="mt-3 text-center text-sm text-amber-600 font-medium">
              包含 +50 完美獎勵！
            </div>
          )}
        </div>
      </div>

      <Button
        variant="primary"
        onClick={onConfirm}
        className="px-8 py-3 text-lg"
        icon={RotateCcw}
      >
        返回佈置模式
      </Button>
    </div>
  );
};
