import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface BlankPageConfirmModalProps {
  pageNumber: number;
  studentName: string;
  hasExistingTranscript: boolean;
  hasFindings: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BlankPageConfirmModal: React.FC<BlankPageConfirmModalProps> = ({
  pageNumber,
  studentName,
  hasExistingTranscript,
  hasFindings,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="text-sm font-bold">Confirm Blank Page Marking</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">
            Are you sure you want to mark Page {pageNumber} for {studentName} as a blank page?
          </p>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md space-y-1.5 text-amber-900 leading-relaxed">
            {hasExistingTranscript && (
              <p>
                • <strong>Transcript Exclusion:</strong> Existing transcribed text for Page {pageNumber} will be excluded from the effective transcript.
              </p>
            )}
            {hasFindings && (
              <p>
                • <strong>Findings Preservation:</strong> Existing teacher corrections and feedback will NOT be deleted. They will be preserved and flagged for review to prevent misaligned text anchors.
              </p>
            )}
            <p>
              • <strong>Downstream OCR:</strong> Future OCR passes will skip this page entirely.
            </p>
          </div>

          <p className="text-slate-500 text-[11px]">
            You can uncheck this box at any time to re-enable OCR for this page.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-colors"
          >
            Confirm & Mark Blank
          </button>
        </div>
      </div>
    </div>
  );
};
