import React from 'react';
import { HelpCircle, Activity, RotateCcw, Sparkles, Server, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { MarkingModelHealthStatus } from '../services/essayServiceTypes';

interface WorkbenchHeaderProps {
  title: string;
  stepTitle: string;
  stepDescription: string;
  onOpenStatusModal: () => void;
  onOpenHelpModal: () => void;
  onResetSession: () => void;
  extraActions?: React.ReactNode;
  showMarkingTools?: boolean;
  onCheck18086Status?: () => void;
  isChecking18086?: boolean;
  markingModelHealth?: MarkingModelHealthStatus | null;
  onOpenBatchModal?: () => void;
  isBatchRunning?: boolean;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  title,
  stepTitle,
  stepDescription,
  onOpenStatusModal,
  onOpenHelpModal,
  onResetSession,
  extraActions,
  showMarkingTools = false,
  onCheck18086Status,
  isChecking18086 = false,
  markingModelHealth = null,
  onOpenBatchModal,
  isBatchRunning = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-3 border-b border-slate-200">
      <div>
        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          Teacher Workspace / {title || 'Untitled Assignment'}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          {stepTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          {stepDescription}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {extraActions}

        {showMarkingTools && (
          <>
            <button
              type="button"
              onClick={onOpenBatchModal}
              disabled={isBatchRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 min-h-[32px] transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="一次啟動目前作業內合資格學生的批次 AI 批改"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Batch AI Marking</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onCheck18086Status}
                disabled={isChecking18086}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[32px] transition-colors shadow-2xs disabled:opacity-60"
                title="經 18089 Bridge 查詢 18086 模型端點的健康狀況及實際 Model ID"
              >
                {isChecking18086 ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : (
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Check 18086 status</span>
              </button>

              {markingModelHealth && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border min-h-[32px] ${
                    markingModelHealth.status === 'ready'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : markingModelHealth.status === 'bridge_unreachable'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                  title={`Checked at: ${markingModelHealth.checkedAt ? new Date(markingModelHealth.checkedAt).toLocaleTimeString() : 'now'}\n${markingModelHealth.details || ''}`}
                >
                  {markingModelHealth.status === 'ready' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Ready: {markingModelHealth.modelId || '18086'}</span>
                    </>
                  ) : markingModelHealth.status === 'bridge_unreachable' ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Bridge unreachable (18089)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Model unavailable (18086)</span>
                    </>
                  )}
                </span>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onOpenStatusModal}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 min-h-[32px] transition-colors"
          title="Inspect OCR & AI model service availability"
        >
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span>Services</span>
        </button>

        <button
          type="button"
          onClick={onResetSession}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 min-h-[32px] transition-colors"
          title="Clear saved session and reset all workbench progress"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear saved session</span>
        </button>

        <button
          type="button"
          onClick={onOpenHelpModal}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[32px] transition-colors"
          title="View workflow guide"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>Guide</span>
        </button>
      </div>
    </div>
  );
};
