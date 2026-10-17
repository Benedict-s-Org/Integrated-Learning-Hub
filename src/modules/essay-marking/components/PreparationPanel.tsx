import React, { useRef } from 'react';
import { Upload, FileText, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { AssignmentConfig } from '../types';

interface PreparationPanelProps {
  assignment: AssignmentConfig;
  onChangeAssignment: (updated: Partial<AssignmentConfig>) => void;
  onConfirmRequirements: () => void;
  onNext: () => void;
}

export const PreparationPanel: React.FC<PreparationPanelProps> = ({
  assignment,
  onChangeAssignment,
  onConfirmRequirements,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let previewUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    onChangeAssignment({
      worksheetFileName: file.name,
      worksheetFile: file,
      worksheetPreviewUrl: previewUrl,
      isConfirmed: false,
    });

    e.target.value = '';
  };

  const handleRubricScoreChange = (dimensionId: string, maxScore: number) => {
    const updated = assignment.rubric.map((dim) =>
      dim.id === dimensionId ? { ...dim, maxScore: Math.max(1, maxScore) } : dim
    );
    onChangeAssignment({ rubric: updated, isConfirmed: false });
  };

  const totalRubricScore = assignment.rubric.reduce(
    (sum, dim) => sum + dim.maxScore,
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Assignment Configuration */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-semibold text-slate-800">
                Original Worksheet & Task
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                Preparation
              </span>
            </div>

            {/* Drop / Select Zone */}
            <div
              className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40 rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-blue-600 mb-2" />
              <div className="text-sm font-semibold text-slate-800">
                Upload Original Worksheet (.docx, .pdf, image)
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Used to define assignment scope and distinguish preprinted instructions.
              </div>
              <button
                type="button"
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md shadow-2xs hover:bg-blue-50"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx,.pdf,image/*"
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>

            {/* Uploaded File Info */}
            {assignment.worksheetFileName ? (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">
                      {assignment.worksheetFileName}
                    </span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {assignment.worksheetFile?.size
                        ? `${(assignment.worksheetFile.size / 1024).toFixed(1)} KB`
                        : 'Uploaded worksheet'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeAssignment({
                      worksheetFileName: null,
                      worksheetFile: null,
                      worksheetPreviewUrl: null,
                      isConfirmed: false,
                    });
                  }}
                  className="text-slate-400 hover:text-rose-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : null}

            {/* Assignment Title & Response Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label
                  htmlFor="assignmentTitle"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Assignment Title
                </label>
                <input
                  id="assignmentTitle"
                  type="text"
                  value={assignment.title}
                  placeholder="e.g. P3 Writing 01 · A Day at the Park"
                  onChange={(e) =>
                    onChangeAssignment({
                      title: e.target.value,
                      isConfirmed: false,
                    })
                  }
                  className="w-full text-sm px-3 py-1.5 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white min-h-[34px]"
                />
              </div>

              <div>
                <label
                  htmlFor="responseFormat"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Response Format
                </label>
                <select
                  id="responseFormat"
                  value={assignment.responseFormat}
                  onChange={(e) =>
                    onChangeAssignment({
                      responseFormat: e.target.value as 'worksheet' | 'separate_paper',
                      isConfirmed: false,
                    })
                  }
                  className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white min-h-[34px]"
                >
                  <option value="worksheet">
                    Write directly on the worksheet
                  </option>
                  <option value="separate_paper">
                    Write on separate lined paper / book
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Writing Requirements & Scope */}
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              Writing Scope & Instructions
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Define the prompts, word limit, and criteria. The model will not invent additional requirements.
            </p>

            <textarea
              rows={4}
              value={assignment.scopePrompt}
              placeholder="e.g. Write about a day at the park. Write 60–80 words. Include who you went with, what you did, and how you felt."
              onChange={(e) =>
                onChangeAssignment({
                  scopePrompt: e.target.value,
                  isConfirmed: false,
                })
              }
              className="w-full text-sm p-3 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed resize-y"
            />

            {/* Rubric Configuration */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700">
                  Rubric Dimensions (Max Score)
                </span>
                <span className="text-xs font-bold text-blue-700">
                  Total Points: {totalRubricScore}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {assignment.rubric.map((dim) => (
                  <div
                    key={dim.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-700">
                      {dim.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={dim.maxScore}
                        onChange={(e) =>
                          handleRubricScoreChange(dim.id, parseInt(e.target.value) || 1)
                        }
                        className="w-12 text-center py-0.5 px-1 border border-slate-300 rounded bg-white text-xs font-semibold"
                      />
                      <span className="text-slate-400">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation Button */}
            <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {assignment.isConfirmed
                  ? 'Requirements are confirmed.'
                  : 'Confirm requirements before applying AI marking.'}
              </span>

              <button
                type="button"
                onClick={onConfirmRequirements}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                  assignment.isConfirmed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {assignment.isConfirmed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>✓ Requirements Confirmed</span>
                  </>
                ) : (
                  <span>Confirm Requirements</span>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Original Document Preview */}
        <div>
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs min-h-[460px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-semibold text-slate-800">
                Original Print Preview
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                {assignment.worksheetFileName ? 'File Attached' : 'No File'}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center border border-slate-100 bg-slate-50/70 rounded-md p-4 overflow-hidden">
              {assignment.worksheetPreviewUrl ? (
                <img
                  src={assignment.worksheetPreviewUrl}
                  alt="Original worksheet preview"
                  className="max-h-[500px] w-auto object-contain rounded shadow-xs"
                />
              ) : assignment.worksheetFileName?.endsWith('.docx') ||
                assignment.worksheetFileName?.endsWith('.doc') ? (
                <div className="max-w-md p-6 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <div className="font-semibold text-slate-800 text-sm">
                    {assignment.worksheetFileName}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Word document metadata retained. Layout rendering and automatic Word-to-scan template alignment are not yet implemented in this phase. The extracted text scope above will be provided to the model.
                  </div>
                </div>
              ) : assignment.worksheetFileName?.endsWith('.pdf') ? (
                <div className="max-w-md p-6 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                  <FileText className="w-12 h-12 text-rose-600 mx-auto mb-3" />
                  <div className="font-semibold text-slate-800 text-sm">
                    {assignment.worksheetFileName}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    PDF worksheet uploaded. PDF parsing and page rendering are available during scan intake.
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No document preview available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Upload an original worksheet image or PDF on the left to verify the printed template before intake.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500 leading-relaxed">
              <strong>Notice:</strong> Printed instructions provide context and help separate preprinted lines from student-authored writing. Word-to-scan alignment is not yet active.
            </div>
          </section>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div></div>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[34px] transition-colors"
        >
          <span>Add Student Scans →</span>
        </button>
      </div>
    </div>
  );
};
