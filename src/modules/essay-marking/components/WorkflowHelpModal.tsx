import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface WorkflowHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowHelpModal: React.FC<WorkflowHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Essay Marking Workbench Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-600 leading-relaxed mb-6 max-h-[60vh] overflow-y-auto">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              1. Preparation
            </h3>
            <p>
              Upload the original writing worksheet or assignment template (.docx, .pdf, or image). Set the assignment title, word count, prompts, and rubric dimensions.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              2. Add Scans
            </h3>
            <p>
              Select or drop student handwritten scan images or multi-page PDFs. Scans are processed and previewed entirely in local browser memory without uploading to external servers.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              3. Match Students
            </h3>
            <p>
              Select your class to populate the authorized student roster. Adjust individual or bulk page counts (0 skips a student without consuming a scan). Ensure scan pages match student counts exactly, then click <strong>Apply Matching</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              4. Verify Transcript
            </h3>
            <p>
              Compare the original scan against the student text. Enter or edit the transcript, ensuring student spelling and grammar mistakes are preserved faithfully for fair rubric scoring. Confirm with <strong>Verify Transcript</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              5. Review Marking
            </h3>
            <p>
              Add specific language notes and adjust rubric scores (0–4 per dimension). Enter student feedback commentary, then click <strong>Approve Scores & Feedback</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              6. Report & Export
            </h3>
            <p>
              Preview the teacher-approved feedback report. Print or download as a text report for records.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
