import React from 'react';
import { HelpCircle, Activity, RotateCcw } from 'lucide-react';

interface WorkbenchHeaderProps {
  title: string;
  stepTitle: string;
  stepDescription: string;
  onOpenStatusModal: () => void;
  onOpenHelpModal: () => void;
  onResetSession: () => void;
  extraActions?: React.ReactNode;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  title,
  stepTitle,
  stepDescription,
  onOpenStatusModal,
  onOpenHelpModal,
  onResetSession,
  extraActions,
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
          title="Reset the current marking session"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
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
