import React from 'react';
import { BatchMarkingQueueProgress } from '../utils/markingBatchQueue';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pause,
  Play,
  X,
  Square,
} from 'lucide-react';

interface BatchMarkingProgressBannerProps {
  progress: BatchMarkingQueueProgress;
  onRequestStop: () => void;
  onResumeBatch?: () => void;
  onDismissBanner?: () => void;
}

export const BatchMarkingProgressBanner: React.FC<BatchMarkingProgressBannerProps> = ({
  progress,
  onRequestStop,
  onResumeBatch,
  onDismissBanner,
}) => {
  if (progress.status === 'idle') return null;

  const isRunning = progress.status === 'running';
  const isStopping = progress.status === 'stopping';
  const isPaused = progress.status === 'paused';
  const isCompleted = progress.status === 'completed';

  const processedCount = progress.completedItems + progress.failedItems;
  const targetCount = progress.totalItems;
  const percent = targetCount > 0 ? Math.round((processedCount / targetCount) * 100) : 0;

  return (
    <div className={`p-3 rounded-lg border text-xs mb-3 shadow-xs transition-all ${
      isRunning || isStopping
        ? 'bg-blue-50/90 border-blue-200 text-blue-950'
        : isPaused
        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
        : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Status & Description */}
        <div className="flex items-start sm:items-center gap-2.5">
          {isRunning ? (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5 sm:mt-0" />
          ) : isStopping ? (
            <Pause className="w-4 h-4 text-amber-600 animate-pulse shrink-0 mt-0.5 sm:mt-0" />
          ) : isPaused ? (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          )}

          <div>
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              <span>
                {isRunning
                  ? '批次 AI 批改進行中 (Batch Marking in Progress)'
                  : isStopping
                  ? '即將停止：正在完成目前這份作文...'
                  : isPaused
                  ? '批次已暫停 (Batch Paused)'
                  : '批次批改已完成 (Batch Marking Finished)'}
              </span>

              {isRunning && progress.activeStudentName && (
                <span className="font-normal text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded text-[11px]">
                  目前學生：<strong>{progress.activeStudentName}</strong> ({progress.activePageCount || 1} 頁)
                </span>
              )}
            </div>

            <div className="text-[11px] opacity-80 mt-0.5">
              {isPaused && progress.pauseReason
                ? progress.pauseReason
                : isRunning
                ? '全批次依序處理，同時最多一個模型請求。請保持此分頁開啟，中途可自由檢視其他學生。'
                : isCompleted
                ? `共處理 ${progress.completedItems} 份作文，跳過 ${progress.skippedItems} 份。批改結果已全部安全保存。`
                : '上次批次未全部完成。'}
            </div>
          </div>
        </div>

        {/* Right: Counter Stats & Control Buttons */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          {/* Counters */}
          <div className="flex items-center gap-2 text-[11px] font-mono bg-white/70 px-2.5 py-1 rounded border border-slate-200">
            <span className="text-emerald-700" title="已完成">✓ {progress.completedItems}</span>
            {progress.failedItems > 0 && (
              <span className="text-rose-600" title="失敗">✕ {progress.failedItems}</span>
            )}
            <span className="text-slate-400" title="跳過">↷ {progress.skippedItems}</span>
            <span className="text-blue-700 font-semibold" title="待處理">⋯ {progress.pendingItems}</span>
          </div>

          {/* Action buttons */}
          {isRunning && (
            <button
              type="button"
              onClick={onRequestStop}
              disabled={progress.stopRequested}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded hover:bg-rose-50 transition-colors shadow-2xs disabled:opacity-50"
              title="完成目前正在批改的學生後停止，不會中途廢棄當前結果"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{progress.stopRequested ? '停止中...' : '完成目前一份後停止'}</span>
            </button>
          )}

          {isPaused && onResumeBatch && (
            <button
              type="button"
              onClick={onResumeBatch}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>繼續未完成項目 ({progress.pendingItems})</span>
            </button>
          )}

          {(isCompleted || isPaused) && onDismissBanner && (
            <button
              type="button"
              onClick={onDismissBanner}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="關閉進度提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(isRunning || isStopping) && (
        <div className="w-full bg-blue-200/50 rounded-full h-1.5 mt-2.5 overflow-hidden">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};
