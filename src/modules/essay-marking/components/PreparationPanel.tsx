import React, { useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import {
  AssignmentConfig,
  PrimaryGrade,
  PRIMARY_GRADES,
  OVERALL_GRADES,
  getRubricForGrade,
  parseGradeFromClassName,
} from '../types';
import { PdfTemplateRegionEditor } from './PdfTemplateRegionEditor';

interface PreparationPanelProps {
  assignment: AssignmentConfig;
  onChangeAssignment: (updated: Partial<AssignmentConfig>) => void;
  onConfirmRequirements: () => void;
  onNext: () => void;
  selectedClassId?: string;
}

export const PreparationPanel: React.FC<PreparationPanelProps> = ({
  assignment,
  onChangeAssignment,
  onConfirmRequirements,
  onNext,
  selectedClassId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trustedGradeFromClass = parseGradeFromClassName(selectedClassId);
  const currentGrade = assignment.grade || trustedGradeFromClass || null;

  // Sync trusted grade to assignment if class was selected and grade not yet set
  useEffect(() => {
    if (!assignment.grade && trustedGradeFromClass) {
      onChangeAssignment({
        grade: trustedGradeFromClass,
        rubric: getRubricForGrade(trustedGradeFromClass),
      });
    }
  }, [trustedGradeFromClass, assignment.grade, onChangeAssignment]);

  const activeRubric = currentGrade ? getRubricForGrade(currentGrade) : [];
  const totalRubricScore = activeRubric.reduce(
    (sum, dim) => sum + dim.maxScore,
    0
  );

  const handleSelectGrade = (newGrade: PrimaryGrade) => {
    onChangeAssignment({
      grade: newGrade,
      rubric: getRubricForGrade(newGrade),
      isConfirmed: false,
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
      alert('請先另存為 PDF 再上載。');
      e.target.value = '';
      return;
    }

    let previewUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    // Default title from file name (removing last extension only)
    const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
    let nextTitle = assignment.title;
    let nextIsTitleCustomized = assignment.isTitleCustomized || false;

    if (assignment.isTitleCustomized && assignment.title.trim()) {
      const confirmUpdate = window.confirm(
        `您已手動修改過作業標題「${assignment.title}」。\n\n是否以新檔名「${defaultTitle}」覆蓋現有標題？`
      );
      if (confirmUpdate) {
        nextTitle = defaultTitle;
        nextIsTitleCustomized = false;
      }
    } else {
      nextTitle = defaultTitle;
      nextIsTitleCustomized = false;
    }

    const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;

    onChangeAssignment({
      title: nextTitle,
      isTitleCustomized: nextIsTitleCustomized,
      worksheetFileName: file.name,
      worksheetFile: file,
      worksheetPreviewUrl: previewUrl,
      templateFingerprint: fingerprint,
      templateRegions: [], // Reset old regions on new file selection
      isConfirmed: false,
    });

    e.target.value = '';
  };

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
                  placeholder="e.g. Writing 1 - Character Profile"
                  onChange={(e) =>
                    onChangeAssignment({
                      title: e.target.value,
                      isTitleCustomized: true,
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

            {/* Grade Selection & Rubric Configuration */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              {/* Target Grade Selector */}
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Target Grade Level
                      </span>
                      {currentGrade && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                          {currentGrade}
                        </span>
                      )}
                      {trustedGradeFromClass && (
                        <span className="text-[11px] text-slate-500">
                          (from class: {selectedClassId})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentGrade
                        ? currentGrade === 'P.1' || currentGrade === 'P.2' || currentGrade === 'P.3'
                          ? 'P.1–P.3 uses 2 fixed dimensions (Total 100 pts).'
                          : 'P.4–P.6 uses 3 fixed dimensions (Total 100 pts).'
                        : 'Select an explicit primary grade level (P.1–P.6) to load rubric dimensions.'}
                    </p>
                  </div>

                  {/* Explicit P.1 to P.6 choices */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRIMARY_GRADES.map((g) => {
                      const isSelected = currentGrade === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleSelectGrade(g)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all min-h-[32px] ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-500 ring-offset-1'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Two Columns: Left = Rubric Dimensions, Right = Overall Grade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Rubric Dimensions (Max Score) */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-800">
                        Rubric Dimensions (Max Score)
                      </span>
                      <span className="text-xs font-bold text-blue-700">
                        Total Points: {currentGrade ? totalRubricScore : 0}
                      </span>
                    </div>

                    {currentGrade ? (
                      <div className="space-y-2">
                        {activeRubric.map((dim) => (
                          <div
                            key={dim.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center justify-between text-xs"
                          >
                            <span className="font-medium text-slate-800">
                              {dim.name}
                            </span>
                            <span className="font-bold text-slate-900 text-xs px-2.5 py-0.5 bg-slate-50 border border-slate-200 rounded-md">
                              {dim.maxScore} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 px-3 bg-white border border-dashed border-slate-300 rounded-md text-center text-xs text-slate-500">
                        Please choose a grade (P.1–P.6) above to display rubric dimensions.
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 text-[11px] text-slate-400 border-t border-slate-200">
                    Fixed points per dimension. Arbitrary score modification is disabled.
                  </div>
                </div>

                {/* Right Column: Overall Grade */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-800">
                        Overall Grade
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        Scale Summary
                      </span>
                    </div>

                    {/* Six Grade Badges */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                      {OVERALL_GRADES.map((tier) => (
                        <div
                          key={tier}
                          className="py-1.5 px-2 bg-white border border-slate-200 rounded-md text-center text-xs font-bold text-slate-800 shadow-2xs select-none"
                        >
                          {tier}
                        </div>
                      ))}
                    </div>

                    {/* Required Notices */}
                    <div className="space-y-2 mt-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Overall grade will be shown alongside the numerical score.
                      </p>
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 leading-snug">
                        Score-to-grade mapping is not configured yet.
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 text-[11px] text-slate-400 border-t border-slate-200">
                    Assignment grading settings summary (not student rating input).
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmation Button */}
            <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {!currentGrade
                  ? 'Please select a grade (P.1–P.6) to configure rubric.'
                  : assignment.isConfirmed
                  ? 'Requirements are confirmed.'
                  : 'Confirm requirements before applying AI marking.'}
              </span>

              <button
                type="button"
                disabled={!currentGrade}
                onClick={onConfirmRequirements}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                  !currentGrade
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : assignment.isConfirmed
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
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs min-h-[540px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">
                  Original Worksheet Preview & Region Setup
                </h2>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                {assignment.worksheetFileName ? 'File Attached' : 'No File'}
              </span>
            </div>

            {/* Preview & Editor Body */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-[460px]">
              {assignment.worksheetFile &&
              (assignment.worksheetFileName?.endsWith('.pdf') ||
                assignment.worksheetFile.type === 'application/pdf') ? (
                <div className="w-full flex-1">
                  <PdfTemplateRegionEditor
                    file={assignment.worksheetFile}
                    previewUrl={assignment.worksheetPreviewUrl}
                    regions={assignment.templateRegions || []}
                    onChangeRegions={(newRegions) =>
                      onChangeAssignment({
                        templateRegions: newRegions,
                        isConfirmed: false,
                      })
                    }
                    fingerprint={assignment.templateFingerprint || assignment.worksheetFileName || ''}
                  />
                </div>
              ) : assignment.worksheetFileName?.endsWith('.docx') ||
                assignment.worksheetFileName?.endsWith('.doc') ? (
                <div className="max-w-md p-6 bg-white border border-amber-300 rounded-lg text-center shadow-xs">
                  <FileText className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <div className="font-semibold text-slate-800 text-sm">
                    {assignment.worksheetFileName}
                  </div>
                  <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 font-semibold leading-relaxed">
                    請先另存為 PDF 再上載。
                    <div className="text-[11px] text-amber-700 font-normal mt-1">
                      本系統不提供 Word 真實版面預覽或自動轉換。如需框選學生身份及作答區域，請先在 Word 另存為 PDF 後重新上載。
                    </div>
                  </div>
                </div>
              ) : assignment.worksheetPreviewUrl ? (
                <div className="max-h-[500px] overflow-auto p-2">
                  <img
                    src={assignment.worksheetPreviewUrl}
                    alt="Original worksheet preview"
                    className="max-h-[480px] w-auto object-contain rounded shadow-xs"
                  />
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No document preview available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Upload an original worksheet PDF on the left to preview page layout and mark identity and writing regions.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-500 leading-relaxed">
              <strong>Region Guide:</strong> Draw Class, Student Name, and Class Number boxes to enable automated AI identity recognition in the matching step.
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
