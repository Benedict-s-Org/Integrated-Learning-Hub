import React, { useState, useRef, useEffect } from 'react';
import {
  StudentRosterItem,
  ScanPage,
  MatchingPreviewResult,
  AppliedMatching,
} from '../types';
import { isMatchingDirty } from '../utils/matchingLogic';
import { MagnifierLens, MagnifierState } from './MagnifierLens';
import { ScanPreviewModal } from './ScanPreviewModal';
import { AlertCircle } from 'lucide-react';

interface StudentMatchingPanelProps {
  pages: ScanPage[];
  classes: string[];
  selectedClassId: string;
  students: StudentRosterItem[];
  studentPageCounts: number[];
  selectedStudentIndices: Set<number>;
  appliedMatching: AppliedMatching | null;
  matchingPreview: MatchingPreviewResult;
  viewMode: 'large' | 'medium' | 'list';
  onSelectClass: (classId: string) => void;
  onViewModeChange: (mode: 'large' | 'medium' | 'list') => void;
  onPageCountChange: (index: number, count: number) => void;
  onToggleSelectStudent: (index: number) => void;
  onToggleSelectAll: (selectAll: boolean) => void;
  onApplyBulkCounts: (count: number) => void;
  onApplyMatching: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const StudentMatchingPanel: React.FC<StudentMatchingPanelProps> = ({
  pages,
  classes,
  selectedClassId,
  students,
  studentPageCounts,
  selectedStudentIndices,
  appliedMatching,
  matchingPreview,
  viewMode,
  onSelectClass,
  onViewModeChange,
  onPageCountChange,
  onToggleSelectAll,
  onToggleSelectStudent,
  onApplyBulkCounts,
  onApplyMatching,
  onPrev,
  onNext,
}) => {
  const [bulkInput, setBulkInput] = useState<string>('1');
  const [previewModalPage, setPreviewModalPage] = useState<ScanPage | null>(null);
  const [previewModalMatchIndex, setPreviewModalMatchIndex] = useState<number | null>(null);

  const [magnifier, setMagnifier] = useState<MagnifierState>({
    visible: false,
    x: 0,
    y: 0,
    imgSrc: '',
    bgWidth: 0,
    bgHeight: 0,
    bgX: 0,
    bgY: 0,
  });

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllSelected =
    students.length > 0 && selectedStudentIndices.size === students.length;
  const isIndeterminate =
    selectedStudentIndices.size > 0 &&
    selectedStudentIndices.size < students.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const isDirty = isMatchingDirty(
    appliedMatching,
    selectedClassId,
    studentPageCounts
  );

  const handleApplyBulk = () => {
    const val = parseInt(bulkInput, 10);
    if (!isNaN(val) && val >= 0) {
      onApplyBulkCounts(val);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.pointerType === 'touch') return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const zoom = 2.8;
    const w = 280;
    const h = 190;

    let lensX = e.clientX + 20;
    if (lensX + w > window.innerWidth - 12) {
      lensX = e.clientX - w - 20;
    }
    lensX = Math.max(8, Math.min(lensX, window.innerWidth - w - 8));
    const lensY = Math.max(8, Math.min(e.clientY - 60, window.innerHeight - h - 60));

    setMagnifier({
      visible: true,
      x: lensX,
      y: lensY,
      imgSrc: img.src,
      bgWidth: rect.width * zoom,
      bgHeight: rect.height * zoom,
      bgX: w / 2 - x * zoom,
      bgY: h / 2 - y * zoom,
    });
  };

  const handlePointerLeave = () => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  };

  const canApplyMatching =
    selectedClassId &&
    pages.length > 0 &&
    matchingPreview.extra === 0 &&
    matchingPreview.missing === 0 &&
    isDirty;

  return (
    <div className="space-y-4">
      {/* Top Banner Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span>
            Scans: <strong>{pages.length}</strong> pages
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Assigned: <strong>{matchingPreview.assigned}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Unmatched: <strong>{matchingPreview.extra}</strong>
          </span>
          {matchingPreview.missing > 0 && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-rose-600 font-semibold">
                Missing: {matchingPreview.missing} pages
              </span>
            </>
          )}
        </div>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            !isDirty
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {!isDirty ? '✓ Matching Applied' : 'Preview · Not Applied'}
        </span>
      </div>

      {/* Main Split Layout: Gallery on Left, Roster on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* Left: Scan Gallery & Controls */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md text-xs font-medium">
              {(['large', 'medium', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`px-3 py-1 rounded capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500">
              Hover to magnify (Medium) • Click or Space to enlarge
            </span>
          </div>

          {!selectedClassId && (
            <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-100 rounded-md">
              <p className="text-sm font-medium text-slate-700">Select a class on the right</p>
              <p className="text-xs text-slate-500 mt-1">
                Student roster will be assigned in student-number order.
              </p>
            </div>
          )}

          {pages.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No previewable scan pages added yet. Return to Add Scans step.
            </div>
          ) : viewMode === 'list' ? (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2 px-3 w-16">Preview</th>
                    <th className="py-2 px-3">Order / Source</th>
                    <th className="py-2 px-3">Matched Student</th>
                    <th className="py-2 px-3">Essay Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pages.map((p, idx) => {
                    const match = matchingPreview.map[idx];
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-1.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalPage(p);
                              setPreviewModalMatchIndex(idx);
                            }}
                            className="w-10 h-14 bg-slate-100 border border-slate-200 rounded overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                          >
                            <img
                              src={p.previewUrl}
                              alt={`Scan ${idx + 1}`}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="font-semibold text-slate-800">
                            Scan {idx + 1}
                          </div>
                          <div className="text-slate-400 text-[11px] truncate max-w-[180px]">
                            {p.fileName} (p.{p.sourcePageNumber})
                          </div>
                        </td>
                        <td className="py-1.5 px-3">
                          {match ? (
                            <span className="font-semibold text-blue-700">
                              No. {String(match.classNumber).padStart(2, '0')} {match.studentName}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Unmatched</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {match ? `${match.part} / ${match.total}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={`grid gap-3.5 ${
                viewMode === 'large'
                  ? 'grid-cols-1 max-w-xl mx-auto'
                  : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {pages.map((p, idx) => {
                const match = matchingPreview.map[idx];
                return (
                  <article
                    key={p.id}
                    className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs hover:border-blue-400 transition-all flex flex-col"
                  >
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={`Enlarge scan page ${idx + 1}`}
                      onClick={() => {
                        setPreviewModalPage(p);
                        setPreviewModalMatchIndex(idx);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreviewModalPage(p);
                          setPreviewModalMatchIndex(idx);
                        }
                      }}
                      className="bg-slate-100 p-2 flex items-center justify-center cursor-zoom-in relative min-h-[160px] max-h-[300px] overflow-hidden"
                    >
                      <img
                        src={p.previewUrl}
                        alt={`Scan ${idx + 1}`}
                        onPointerMove={
                          viewMode === 'medium' ? handlePointerMove : undefined
                        }
                        onPointerLeave={
                          viewMode === 'medium' ? handlePointerLeave : undefined
                        }
                        className="max-h-[280px] w-auto object-contain rounded shadow-2xs"
                      />
                    </div>

                    <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-1">
                        {match ? (
                          <>
                            <strong className="block text-blue-700 truncate font-semibold">
                              No. {String(match.classNumber).padStart(2, '0')} {match.studentName}
                            </strong>
                            <span className="text-slate-500 text-[11px]">
                              Essay page {match.part} / {match.total}
                            </span>
                          </>
                        ) : (
                          <>
                            <strong className="block text-amber-600 truncate font-semibold">
                              Unmatched
                            </strong>
                            <span className="text-slate-400 text-[11px]">
                              Awaiting assignment
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-slate-400 font-medium shrink-0">
                        Scan {idx + 1}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Class Selection & Student Roster */}
        <aside className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs sticky top-14 space-y-3">
          <div>
            <label
              htmlFor="classSelect"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Select Class
            </label>
            <select
              id="classSelect"
              value={selectedClassId}
              onChange={(e) => onSelectClass(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white min-h-[32px]"
            >
              <option value="">Choose a class</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {selectedClassId ? (
            <>
              {/* Roster Controls */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                {/* Header Row */}
                <div className="bg-slate-50 p-2 border-b border-slate-200 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      id="selectAllStudents"
                      checked={isAllSelected}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      aria-label="Select all students in this class"
                    />
                    <span>Student Name</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="1"
                      className="w-12 text-center py-0.5 px-1 border border-slate-300 rounded text-xs bg-white"
                      aria-label="Bulk page count input"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulk}
                      disabled={selectedStudentIndices.size === 0}
                      className={`px-2 py-0.5 text-xs font-semibold rounded min-h-[26px] transition-colors ${
                        selectedStudentIndices.size > 0
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Student Scroll List */}
                <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No active students found in class {selectedClassId}.
                    </div>
                  ) : (
                    students.map((student, i) => {
                      const count = studentPageCounts[i] ?? 1;
                      const isSelected = selectedStudentIndices.has(i);

                      return (
                        <div
                          key={student.id}
                          className={`p-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                            count === 0
                              ? 'bg-slate-50/80 text-slate-400'
                              : 'hover:bg-blue-50/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelectStudent(i)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                              aria-label={`Select ${student.displayName}`}
                            />
                            <div className="truncate">
                              <span className="font-bold text-slate-700 mr-1">
                                {String(student.classNumber).padStart(2, '0')}
                              </span>
                              <span className="font-medium text-slate-800">
                                {student.displayName}
                              </span>
                              {count === 0 && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  0 pages · skipped
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={count}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  onPageCountChange(i, Math.max(0, Math.min(100, val)));
                                }
                              }}
                              className="w-12 text-center py-0.5 px-1 border border-slate-300 rounded text-xs bg-white font-semibold"
                              aria-label={`Page count for ${student.displayName}`}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between items-center">
                <span>
                  <strong>{selectedStudentIndices.size}</strong> of {students.length} selected
                </span>
                <span className="text-slate-400">0 skips student</span>
              </div>

              {/* Matching Status Notice */}
              {matchingPreview.missing > 0 ? (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                  <span>
                    Missing {matchingPreview.missing} pages. Reduce page counts or add more scans.
                  </span>
                </div>
              ) : matchingPreview.extra > 0 ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {matchingPreview.extra} unmatched scans. Adjust student page counts to match.
                  </span>
                </div>
              ) : pages.length > 0 ? (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700">
                  ✓ Scans match required page count exactly.
                </div>
              ) : null}

              {/* Apply Matching Button */}
              <button
                type="button"
                onClick={onApplyMatching}
                disabled={!canApplyMatching}
                className={`w-full py-1.5 px-3 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                  canApplyMatching
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                Apply Matching
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={!appliedMatching || isDirty}
                className={`w-full py-1.5 px-3 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                  appliedMatching && !isDirty
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
                }`}
              >
                Next: Verify Transcript →
              </button>
            </>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Select a class above to populate students
            </div>
          )}
        </aside>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Add Scans
        </button>

        <button
          type="button"
          disabled={!appliedMatching || isDirty}
          onClick={onNext}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md min-h-[34px] transition-colors ${
            appliedMatching && !isDirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>Verify Transcript →</span>
        </button>
      </div>

      {/* Magnifier Lens */}
      <MagnifierLens state={magnifier} />

      {/* Enlarged Scan Modal */}
      <ScanPreviewModal
        page={previewModalPage}
        matchInfo={
          previewModalMatchIndex !== null
            ? matchingPreview.map[previewModalMatchIndex] ?? null
            : null
        }
        onClose={() => {
          setPreviewModalPage(null);
          setPreviewModalMatchIndex(null);
        }}
      />
    </div>
  );
};
