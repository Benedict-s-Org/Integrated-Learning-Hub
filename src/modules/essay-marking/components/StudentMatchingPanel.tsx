import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StudentRosterItem,
  ScanPage,
  MatchingPreviewResult,
  AppliedMatching,
  MatchingMode,
  PageIdentityRecognition,
  TemplateRegion,
  StudentMatchMapItem,
  StudentTranscriptState,
  StudentMarkingState,
} from '../types';
import { isMatchingDirty } from '../utils/matchingLogic';
import { MagnifierLens, MagnifierState } from './MagnifierLens';
import { ScanPreviewModal } from './ScanPreviewModal';
import { AdjustScanRegionsModal } from './AdjustScanRegionsModal';
import { CustomOcrRegionEditorModal } from './CustomOcrRegionEditorModal';
import { BlankPageConfirmModal } from './BlankPageConfirmModal';
import {
  evaluatePageReadiness,
  evaluateStudentMatchingReadiness,
  deriveStudentPageOrdersFromMatching,
  isEntireScriptBlank,
} from '../utils/continuationPageLogic';
import {
  AlertCircle,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ListOrdered,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  PenTool,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';

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

  // Identity Recognition Props
  matchingMode?: MatchingMode;
  onChangeMatchingMode?: (mode: MatchingMode) => void;
  recognitionResults?: Record<string, PageIdentityRecognition>;
  isRecognizing?: boolean;
  recognizeProgress?: { current: number; total: number };
  onStartRecognition?: () => void;
  onCancelRecognition?: () => void;
  onRetryRecognition?: () => void;
  onManualAssignStudent?: (scanPageId: string, studentId: string | null) => void;
  templateRegions?: TemplateRegion[];
  onUpdatePageCustomRegions?: (pageId: string, customRegions: TemplateRegion[]) => void;

  // Continuation pages and blank pages
  onTogglePageBlank?: (pageId: string, isBlank: boolean) => void;
  onReorderStudentPages?: (studentId: string, fromIndex: number, toIndex: number) => void;
  onAssignContinuationPage?: (studentId: string, scanPageId: string) => void;
  onUnassignPage?: (studentId: string, scanPageId: string) => void;
  transcripts?: Record<string, StudentTranscriptState>;
  markings?: Record<string, StudentMarkingState>;
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
  matchingMode = 'recognition',
  onChangeMatchingMode,
  recognitionResults = {},
  isRecognizing = false,
  recognizeProgress = { current: 0, total: 0 },
  onStartRecognition,
  onCancelRecognition,
  onRetryRecognition,
  onManualAssignStudent,
  templateRegions = [],
  onUpdatePageCustomRegions,
  onTogglePageBlank,
  onReorderStudentPages,
  onAssignContinuationPage,
  onUnassignPage,
  transcripts = {},
  markings = {},
}) => {
  const [bulkInput, setBulkInput] = useState<string>('1');
  const [previewModalPage, setPreviewModalPage] = useState<ScanPage | null>(null);
  const [previewModalMatchIndex, setPreviewModalMatchIndex] = useState<number | null>(null);
  const [activeAdjustPage, setActiveAdjustPage] = useState<ScanPage | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Continuation Regions Editor & Blank Page Confirmation
  const [customRegionEditorPage, setCustomRegionEditorPage] = useState<{
    page: ScanPage;
    part: number;
    studentName?: string;
    classNumber?: number;
  } | null>(null);

  const [blankConfirmTarget, setBlankConfirmTarget] = useState<{
    page: ScanPage;
    targetBlank: boolean;
    pageNumber: number;
    studentName: string;
    hasExistingTranscript: boolean;
    hasFindings: boolean;
  } | null>(null);

  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const handleToggleBlank = (
    page: ScanPage,
    targetBlank: boolean,
    matchItem?: StudentMatchMapItem | null
  ) => {
    if (targetBlank) {
      const studentId = matchItem?.studentId;
      const existingTranscript = studentId ? transcripts[studentId] : null;
      const existingMarking = studentId ? markings[studentId] : null;
      const hasExistingText = Boolean(
        existingTranscript?.rawOcrText || existingTranscript?.editedText
      );
      const hasFindings = Boolean(
        existingMarking?.findings && existingMarking.findings.length > 0
      );

      if (hasExistingText || hasFindings) {
        setBlankConfirmTarget({
          page,
          targetBlank: true,
          pageNumber: matchItem?.part ?? 1,
          studentName: matchItem?.studentName || 'Student',
          hasExistingTranscript: hasExistingText,
          hasFindings,
        });
        return;
      }
    }

    onTogglePageBlank?.(page.id, targetBlank);
  };

  const effectiveStudentPageOrders = useMemo(() => {
    if (appliedMatching?.studentPageOrders) {
      return appliedMatching.studentPageOrders;
    }
    return deriveStudentPageOrdersFromMatching(appliedMatching, pages);
  }, [appliedMatching, pages]);

  const readinessCheck = useMemo(() => {
    return evaluateStudentMatchingReadiness(students, pages, appliedMatching);
  }, [students, pages, appliedMatching]);

  const assignedPageIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(effectiveStudentPageOrders).forEach((ids) => {
      ids.forEach((id) => set.add(id));
    });
    return set;
  }, [effectiveStudentPageOrders]);

  const unassignedPages = useMemo(() => {
    return pages.filter((p) => !assignedPageIds.has(p.id));
  }, [pages, assignedPageIds]);

  const getPageMatchInfo = (page: ScanPage, pageIndex: number): StudentMatchMapItem | null => {
    for (const [studentId, pageIds] of Object.entries(effectiveStudentPageOrders)) {
      const idx = pageIds.indexOf(page.id);
      if (idx !== -1) {
        const student = students.find((s) => s.id === studentId);
        return {
          pageIndex,
          studentId,
          studentName: student?.displayName || 'Unknown',
          classNumber: student?.classNumber || 0,
          part: idx + 1,
          total: pageIds.length,
        };
      }
    }

    if (matchingPreview.map[pageIndex]) {
      return matchingPreview.map[pageIndex];
    }

    if (matchingMode === 'recognition') {
      const rec = recognitionResults[page.id];
      const studentId =
        rec?.manualStudentId ||
        (rec?.status === 'matched' ? rec.matchedStudentId : null);
      if (studentId) {
        const student = students.find((s) => s.id === studentId);
        return {
          pageIndex,
          studentId,
          studentName: student?.displayName || 'Unknown',
          classNumber: student?.classNumber || 0,
          part: 1,
          total: 1,
        };
      }
    }

    return null;
  };

  const safePageIndex =
    pages.length > 0 ? Math.min(Math.max(0, selectedPageIndex), pages.length - 1) : 0;
  const currentPage = pages[safePageIndex] ?? null;

  useEffect(() => {
    if (viewMode !== 'large') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) return;

      if (e.key === 'ArrowLeft') {
        setSelectedPageIndex((prev) => Math.max(0, prev - 1));
        setZoomLevel(1);
      } else if (e.key === 'ArrowRight') {
        setSelectedPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
        setZoomLevel(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, pages.length]);

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

  // Recognition counts summary
  const recognizedPagesList = pages.map((p) => recognitionResults[p.id]);
  const matchedCount = recognizedPagesList.filter(
    (r) => r?.status === 'matched' || r?.manualConfirmed
  ).length;
  const reviewCount = recognizedPagesList.filter(
    (r) => r?.status === 'needs_review' && !r?.manualConfirmed
  ).length;
  const conflictCount = recognizedPagesList.filter(
    (r) => r?.status === 'conflict' && !r?.manualConfirmed
  ).length;
  const unmatchedCount = recognizedPagesList.filter(
    (r) => (!r || r.status === 'unmatched') && !r?.manualConfirmed
  ).length;

  const hasFailedPages = recognizedPagesList.some(
    (r) => r && (r.status === 'unmatched' || r.status === 'conflict' || r.status === 'needs_review')
  );

  const canApplyMatching =
    selectedClassId &&
    pages.length > 0 &&
    (matchingMode === 'recognition'
      ? matchedCount > 0 && isDirty
      : matchingPreview.extra === 0 && matchingPreview.missing === 0 && isDirty);

  return (
    <div className="space-y-4">
      {/* Top Controls: Mode Switcher & Top Status Banner */}
      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Matching Mode:</span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => onChangeMatchingMode?.('recognition')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  matchingMode === 'recognition'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Identity Recognition (Local VL)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeMatchingMode?.('sequential')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  matchingMode === 'sequential'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Sequential Allocation</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                !isDirty
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {!isDirty ? '✓ Matching Applied' : 'Preview · Not Applied'}
            </span>
          </div>
        </div>

        {/* Action Controls for Identity Recognition Mode */}
        {matchingMode === 'recognition' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!selectedClassId || pages.length === 0 || isRecognizing}
                onClick={onStartRecognition}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold shadow-2xs transition-colors ${
                  isRecognizing
                    ? 'bg-blue-100 text-blue-700 cursor-wait'
                    : !selectedClassId || pages.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRecognizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>
                      Processing page {recognizeProgress.current} of {recognizeProgress.total}...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Recognise Student Details</span>
                  </>
                )}
              </button>

              {isRecognizing && (
                <button
                  type="button"
                  onClick={onCancelRecognition}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100"
                >
                  Cancel Recognition
                </button>
              )}

              {!isRecognizing && hasFailedPages && onRetryRecognition && (
                <button
                  type="button"
                  onClick={onRetryRecognition}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                  title="Retry failed or unreadable pages"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Retry Unresolved Pages</span>
                </button>
              )}
            </div>

            {/* Recognition Summary Pills */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                Total: {pages.length}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Matched: {matchedCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                Review: {reviewCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                Conflict: {conflictCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                Unmatched: {unmatchedCount}
              </span>
            </div>
          </div>
        ) : (
          /* Sequential Mode Header Status */
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
        )}
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
              {viewMode === 'large'
                ? '單頁大圖檢視 • 支援縮放及手動配對'
                : viewMode === 'medium'
                ? '懸停局部放大 • 點擊卡片切換至單頁大圖'
                : '列表檢視 • 點擊預覽圖切換至單頁大圖'}
            </span>
          </div>

          {!selectedClassId && (
            <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-100 rounded-md">
              <p className="text-sm font-medium text-slate-700">Select a class on the right</p>
              <p className="text-xs text-slate-500 mt-1">
                Student roster is required to match scan identities.
              </p>
            </div>
          )}

          {pages.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No previewable scan pages added yet. Return to Add Scans step.
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2 px-3 w-16">Preview</th>
                    <th className="py-2 px-3">Scan Page</th>
                    <th className="py-2 px-3">Student Assignment</th>
                    <th className="py-2 px-3">Page / Role</th>
                    <th className="py-2 px-3">Blank Page</th>
                    <th className="py-2 px-3">OCR Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pages.map((page, index) => {
                    const match = getPageMatchInfo(page, index);
                    const rec = recognitionResults[page.id];
                    const effectiveStudentId =
                      match?.studentId ||
                      rec?.manualStudentId ||
                      (rec?.status === 'matched' ? rec.matchedStudentId : null);
                    const isContinuation = (match?.part ?? 1) >= 3;

                    return (
                      <tr
                        key={page.id}
                        onClick={() => setSelectedPageIndex(index)}
                        className={`cursor-pointer transition-colors ${
                          safePageIndex === index ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <img
                            src={page.previewUrl}
                            alt={`Page ${index + 1}`}
                            className="w-12 h-16 object-contain rounded border border-slate-200 cursor-pointer shadow-2xs bg-white hover:ring-2 hover:ring-blue-400 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPageIndex(index);
                              onViewModeChange('large');
                            }}
                            title="Click to view in Large Mode"
                          />
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          <div>Page #{index + 1}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {page.fileName}
                          </div>
                        </td>

                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          {matchingMode === 'recognition' ? (
                            <div className="space-y-1">
                              <select
                                value={effectiveStudentId || ''}
                                onChange={(e) =>
                                  onManualAssignStudent?.(page.id, e.target.value || null)
                                }
                                className="text-xs p-1 border border-slate-300 rounded bg-white max-w-[160px]"
                              >
                                <option value="">— Unassigned —</option>
                                {students.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    #{s.classNumber} {s.displayName}
                                  </option>
                                ))}
                              </select>
                              {rec && (
                                <div className="text-[10px] text-slate-400">
                                  Rec: {rec.rawStudentName || rec.rawClassNumber || 'unmatched'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              {match ? (
                                <span className="font-semibold text-slate-800">
                                  #{match.classNumber} {match.studentName}
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">Unassigned</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2 px-3 font-medium text-slate-600">
                          {match ? (
                            isContinuation ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Page {match.part} (Continuation)
                              </span>
                            ) : (
                              <span>Part {match.part} of {match.total}</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(page.isBlank)}
                              onChange={(e) => handleToggleBlank(page, e.target.checked, match)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className={page.isBlank ? 'font-bold text-slate-900' : 'text-slate-500'}>
                              {page.isBlank ? 'Blank' : 'Active'}
                            </span>
                          </label>
                        </td>

                        <td className="py-2 px-3">
                          {page.isBlank ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Blank (OCR skipped)
                            </span>
                          ) : isContinuation ? (
                            page.customRegions && page.customRegions.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ {page.customRegions.length} region(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                ⚠️ Needs OCR regions
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px]">Pages 1–2 OCR</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPageIndex(index);
                                onViewModeChange('large');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                              title="View in Large Mode"
                            >
                              <Eye className="w-3 h-3 text-blue-600" />
                              <span>Large</span>
                            </button>

                            {isContinuation && !page.isBlank ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomRegionEditorPage({
                                    page,
                                    part: match?.part ?? 3,
                                    studentName: match?.studentName,
                                    classNumber: match?.classNumber,
                                  })
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                  page.customRegions && page.customRegions.length > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }`}
                                title="Define OCR regions for continuation page"
                              >
                                <PenTool className="w-3 h-3" />
                                <span>{page.customRegions && page.customRegions.length > 0 ? `Regions (${page.customRegions.length})` : 'Set OCR *'}</span>
                              </button>
                            ) : !page.isBlank ? (
                              <button
                                type="button"
                                onClick={() => setActiveAdjustPage(page)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                title="Adjust crop regions for this scan"
                              >
                                <Sliders className="w-3 h-3 text-slate-500" />
                                <span>Adjust</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'large' ? (
            /* Large View: True Single-Page Large View */
            <div className="flex flex-col space-y-3">
              {/* Pagination and Zoom Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                {/* Page Navigation Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPageIndex((prev) => Math.max(0, prev - 1));
                      setZoomLevel(1);
                    }}
                    disabled={safePageIndex <= 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                    title="Previous Page (上一頁)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>上一頁</span>
                  </button>

                  <div className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-md shadow-2xs min-w-[100px] text-center select-none">
                    第 {safePageIndex + 1} / {pages.length} 頁
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
                      setZoomLevel(1);
                    }}
                    disabled={safePageIndex >= pages.length - 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                    title="Next Page (下一頁)"
                  >
                    <span>下一頁</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Page Jump Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px]">跳轉：</span>
                  <select
                    value={safePageIndex}
                    onChange={(e) => {
                      setSelectedPageIndex(Number(e.target.value));
                      setZoomLevel(1);
                    }}
                    className="text-xs p-1 bg-white border border-slate-200 rounded font-medium text-slate-700 max-w-[150px]"
                  >
                    {pages.map((p, idx) => (
                      <option key={p.id} value={idx}>
                        第 {idx + 1} 頁 {p.fileName ? `(${p.fileName.slice(0, 14)}...)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    disabled={zoomLevel <= 0.5}
                    className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition-colors"
                    title="縮小 (Zoom Out)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 py-0.5 font-bold text-slate-700 text-[11px] min-w-[42px] text-center select-none">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    disabled={zoomLevel >= 3}
                    className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition-colors"
                    title="放大 (Zoom In)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors"
                    title="適合頁面 (Fit Page)"
                  >
                    <Maximize2 className="w-3 h-3 text-slate-500" />
                    <span>適合頁面</span>
                  </button>
                </div>
              </div>

              {/* Current Page Identity & Pairing Details Banner */}
              {currentPage && (() => {
                const match = getPageMatchInfo(currentPage, safePageIndex);
                const rec = recognitionResults[currentPage.id];
                const effectiveStudentId =
                  match?.studentId ||
                  rec?.manualStudentId ||
                  (rec?.status === 'matched' ? rec.matchedStudentId : null);
                const isContinuation = (match?.part ?? 1) >= 3;

                return (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          Page #{safePageIndex + 1}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          {currentPage.fileName}
                        </span>
                      </div>

                      {matchingMode === 'recognition' ? (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                              rec?.manualConfirmed
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : rec?.status === 'matched'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec?.status === 'needs_review'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : rec?.status === 'conflict'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {rec?.manualConfirmed
                              ? '✓ Manually Assigned'
                              : rec?.status === 'matched'
                              ? '✓ Matched'
                              : rec?.status === 'needs_review'
                              ? '⚠️ Needs Review'
                              : rec?.status === 'conflict'
                              ? '🚫 Conflict'
                              : 'Unmatched'}
                          </span>

                          {rec ? (
                            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 text-[11px]">
                              <div>
                                <span className="text-slate-400">Class: </span>
                                <strong className="text-slate-700">{rec.rawClass || 'unreadable'}</strong>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div>
                                <span className="text-slate-400">Name: </span>
                                <strong className="text-slate-700">{rec.rawStudentName || 'unreadable'}</strong>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div>
                                <span className="text-slate-400">No: </span>
                                <strong className="text-slate-700">{rec.rawClassNumber || 'unreadable'}</strong>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Pending recognition
                            </span>
                          )}

                          {rec?.statusReason && !rec.manualConfirmed && (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium max-w-[220px] truncate" title={rec.statusReason}>
                              {rec.statusReason}
                            </span>
                          )}
                        </>
                      ) : (
                        /* Sequential Mode Info */
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {match ? `#${match.classNumber} ${match.studentName}` : 'Unassigned'}
                          </span>
                          <span className="text-slate-400">•</span>
                          {match ? (
                            isContinuation ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Page {match.part} (Continuation)
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                Part {match.part} of {match.total}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">No mapping</span>
                          )}
                        </div>
                      )}

                      {/* Blank Page Checkbox in Large View */}
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2.5 py-1.5 rounded-md border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={Boolean(currentPage.isBlank)}
                          onChange={(e) => handleToggleBlank(currentPage, e.target.checked, match)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Blank Page (Skip OCR)</span>
                      </label>
                    </div>

                    {/* Page Actions: Manual Student Assignment & Crop Region Adjustment */}
                    <div className="flex items-center gap-2">
                      {matchingMode === 'recognition' && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Assign:
                          </label>
                          <select
                            value={effectiveStudentId || ''}
                            onChange={(e) =>
                              onManualAssignStudent?.(currentPage.id, e.target.value || null)
                            }
                            className="text-xs p-1.5 border border-slate-300 rounded bg-white font-medium min-w-[170px]"
                          >
                            <option value="">— Unassigned —</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                #{s.classNumber} {s.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {currentPage.isBlank ? (
                        <span className="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-md border border-slate-200">
                          Blank page — OCR skipped
                        </span>
                      ) : isContinuation ? (
                        <button
                          type="button"
                          onClick={() =>
                            setCustomRegionEditorPage({
                              page: currentPage,
                              part: match?.part ?? 3,
                              studentName: match?.studentName,
                              classNumber: match?.classNumber,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors shadow-2xs ${
                            currentPage.customRegions && currentPage.customRegions.length > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse'
                          }`}
                          title="Define custom OCR regions for this continuation page"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>
                            {currentPage.customRegions && currentPage.customRegions.length > 0
                              ? `Set OCR Regions (${currentPage.customRegions.length})`
                              : 'Set OCR Regions *'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveAdjustPage(currentPage)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Adjust crop regions for this scan"
                        >
                          <Sliders className="w-3.5 h-3.5 text-slate-500" />
                          <span>Adjust</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Large Page Preview Canvas */}
              {currentPage && (
                <div
                  className="w-full h-[620px] lg:h-[700px] bg-slate-900/5 rounded-lg border border-slate-200 overflow-auto p-4 flex items-center justify-center relative select-none"
                  onWheel={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      if (e.deltaY < 0) {
                        setZoomLevel((z) => Math.min(3, +(z + 0.2).toFixed(2)));
                      } else {
                        setZoomLevel((z) => Math.max(0.5, +(z - 0.2).toFixed(2)));
                      }
                    }
                  }}
                >
                  <div
                    style={{
                      width: zoomLevel > 1 ? `${zoomLevel * 100}%` : '100%',
                      height: zoomLevel > 1 ? `${zoomLevel * 100}%` : '100%',
                      minWidth: '100%',
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={currentPage.previewUrl}
                      alt={`Page ${safePageIndex + 1}`}
                      style={{
                        width: zoomLevel > 1 ? `${zoomLevel * 100}%` : 'auto',
                        maxHeight: zoomLevel <= 1 ? `${zoomLevel * 100}%` : 'none',
                        maxWidth: zoomLevel <= 1 ? '100%' : 'none',
                        objectFit: 'contain',
                      }}
                      className="rounded shadow-md bg-white border border-slate-200 cursor-zoom-in transition-all duration-100"
                      onDoubleClick={() => setZoomLevel((z) => (z === 1 ? 1.75 : 1))}
                      title="雙擊放大/還原 (Double click to zoom, Ctrl+Wheel to scale)"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Medium View: Responsive Multi-Page Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {pages.map((page, index) => {
                const match = getPageMatchInfo(page, index);
                const rec = recognitionResults[page.id];
                const effectiveStudentId =
                  match?.studentId ||
                  rec?.manualStudentId ||
                  (rec?.status === 'matched' ? rec.matchedStudentId : null);
                const isContinuation = (match?.part ?? 1) >= 3;

                return (
                  <div
                    key={page.id}
                    onClick={() => {
                      setSelectedPageIndex(index);
                      onViewModeChange('large');
                    }}
                    className={`flex flex-col bg-slate-50 border rounded-lg overflow-hidden shadow-2xs transition-all cursor-pointer group ${
                      safePageIndex === index
                        ? 'border-blue-500 ring-2 ring-blue-400/50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border-b border-slate-200 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">Page #{index + 1}</span>
                        {isContinuation && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            P{match?.part} (Cont.)
                          </span>
                        )}
                      </div>

                      {page.isBlank ? (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          OCR Skipped
                        </span>
                      ) : isContinuation ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomRegionEditorPage({
                              page,
                              part: match?.part ?? 3,
                              studentName: match?.studentName,
                              classNumber: match?.classNumber,
                            });
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            page.customRegions && page.customRegions.length > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse'
                          }`}
                          title="Set custom OCR regions"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>
                            {page.customRegions && page.customRegions.length > 0
                              ? `Regions (${page.customRegions.length})`
                              : 'Set OCR *'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAdjustPage(page);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                          title="Adjust crop regions"
                        >
                          Adjust
                        </button>
                      )}
                    </div>

                    {/* Image Preview with Magnifier */}
                    <div className="h-56 w-full flex items-center justify-center bg-slate-100/70 p-2 relative overflow-hidden">
                      <img
                        src={page.previewUrl}
                        alt={`Page ${index + 1}`}
                        onPointerMove={handlePointerMove}
                        onPointerLeave={handlePointerLeave}
                        className="max-h-full max-w-full w-auto h-auto object-contain rounded shadow-2xs bg-white"
                      />
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none flex items-end justify-end p-1.5">
                        <span className="text-[10px] font-semibold text-blue-700 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity">
                          點擊單頁大圖
                        </span>
                      </div>
                    </div>

                    {/* Identity Details & Manual Assignment */}
                    <div
                      className="p-2.5 bg-white border-t border-slate-200 text-xs flex-1 flex flex-col justify-between space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {matchingMode === 'recognition' ? (
                        <>
                          <div>
                            {/* Status Badge */}
                            <div className="mb-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  rec?.manualConfirmed
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : rec?.status === 'matched'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : rec?.status === 'needs_review'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : rec?.status === 'conflict'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {rec?.manualConfirmed
                                  ? '✓ Manually Confirmed'
                                  : rec?.status === 'matched'
                                  ? '✓ Matched'
                                  : rec?.status === 'needs_review'
                                  ? '⚠️ Needs Review'
                                  : rec?.status === 'conflict'
                                  ? '🚫 Conflict'
                                  : 'Unmatched'}
                              </span>
                            </div>

                            {/* Recognized Raw Text */}
                            {rec ? (
                              <div className="text-[11px] text-slate-600 space-y-0.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                                <div>
                                  <span className="text-slate-400">Class: </span>
                                  <strong>{rec.rawClass || 'null'}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Name: </span>
                                  <strong>{rec.rawStudentName || 'null'}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">No: </span>
                                  <strong>{rec.rawClassNumber || 'null'}</strong>
                                </div>
                                {rec.statusReason && !rec.manualConfirmed && (
                                  <div className="text-[10px] text-rose-600 font-medium mt-1 leading-tight">
                                    {rec.statusReason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 py-1">
                                Pending recognition
                              </div>
                            )}
                          </div>

                          {/* Manual Override Select */}
                          <div className="pt-1 border-t border-slate-100">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                              Assign Student:
                            </label>
                            <select
                              value={effectiveStudentId || ''}
                              onChange={(e) =>
                                onManualAssignStudent?.(page.id, e.target.value || null)
                              }
                              className="w-full text-xs p-1 border border-slate-300 rounded bg-white font-medium"
                            >
                              <option value="">— Unassigned —</option>
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                  #{s.classNumber} {s.displayName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        /* Sequential Mode Grid Body */
                        <>
                          <div className="font-semibold text-slate-800">
                            {match ? (
                              <>
                                #{match.classNumber} {match.studentName}
                              </>
                            ) : (
                              <span className="text-amber-600">Unassigned</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {match ? `Part ${match.part} of ${match.total}` : 'No student mapped'}
                          </div>
                        </>
                      )}

                      {/* Blank Page Checkbox Row */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                        <label
                          className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(page.isBlank)}
                            onChange={(e) => handleToggleBlank(page, e.target.checked, match)}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Blank page</span>
                        </label>
                        {isContinuation && !page.isBlank && (
                          <span className={`text-[10px] font-semibold ${page.customRegions?.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {page.customRegions?.length ? `✓ Ready` : '⚠️ Regions needed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Sidebar: Class Roster & Apply Matching */}
        <aside className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-4">
          <div>
            <label
              htmlFor="classSelector"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Target Class Roster
            </label>
            <select
              id="classSelector"
              value={selectedClassId}
              onChange={(e) => onSelectClass(e.target.value)}
              className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Choose Class —</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {selectedClassId ? (
            <>
              {/* Roster Header */}
              <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {matchingMode === 'sequential' && (
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => onToggleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        aria-label="Select all students"
                      />
                    )}
                    <span className="font-bold text-slate-800">Class Roster</span>
                    <span className="text-[11px] text-slate-500">({students.length} students)</span>
                  </div>

                  {matchingMode === 'sequential' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        className="w-10 text-center py-0.5 px-1 border border-slate-300 rounded text-xs bg-white"
                        aria-label="Bulk count"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulk}
                        disabled={selectedStudentIndices.size === 0}
                        className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                {/* Students List */}
                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No active students found in class {selectedClassId}.
                    </div>
                  ) : (
                    students.map((student, i) => {
                      const count = studentPageCounts[i] ?? 0;
                      const isSelected = selectedStudentIndices.has(i);
                      const isExpanded = expandedStudentId === student.id;
                      const assignedPageIdsForStudent =
                        effectiveStudentPageOrders[student.id] || [];
                      const isAllBlank =
                        assignedPageIdsForStudent.length > 0 &&
                        isEntireScriptBlank(pages, assignedPageIdsForStudent);

                      return (
                        <div key={student.id} className="transition-colors border-b border-slate-100 last:border-b-0">
                          <div
                            className={`p-2 flex items-center justify-between gap-2 text-xs cursor-pointer ${
                              count === 0 ? 'bg-slate-50/70 text-slate-400' : 'hover:bg-blue-50/20'
                            }`}
                            onClick={() =>
                              setExpandedStudentId((prev) =>
                                prev === student.id ? null : student.id
                              )
                            }
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-1">
                              {matchingMode === 'sequential' && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => onToggleSelectStudent(i)}
                                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                                />
                              )}
                              <button
                                type="button"
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                                title={isExpanded ? 'Collapse' : 'Expand student pages'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <div className="truncate">
                                <span className="font-bold text-slate-700 mr-1.5">
                                  #{String(student.classNumber).padStart(2, '0')}
                                </span>
                                <span className="font-medium text-slate-800">
                                  {student.displayName}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {isAllBlank && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  All Blank
                                </span>
                              )}
                              {matchingMode === 'recognition' ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                    count > 0
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-slate-100 text-slate-400 border-slate-200'
                                  }`}
                                >
                                  {count} {count === 1 ? 'page' : 'pages'}
                                </span>
                              ) : (
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
                                />
                              )}
                            </div>
                          </div>

                          {/* Expanded Student Page Order & Actions */}
                          {isExpanded && (
                            <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-100 text-xs space-y-1.5">
                              {assignedPageIdsForStudent.length === 0 ? (
                                <div className="text-[11px] text-slate-400 italic py-0.5">
                                  No scan pages assigned yet.
                                </div>
                              ) : (
                                assignedPageIdsForStudent.map((pageId, pIdx) => {
                                  const assignedPage = pages.find((p) => p.id === pageId);
                                  const pageNumber = pIdx + 1;
                                  const scanIndex = pages.findIndex((p) => p.id === pageId) + 1;
                                  const isCont = pageNumber >= 3;

                                  return (
                                    <div
                                      key={pageId}
                                      className="flex items-center justify-between gap-1 p-1.5 rounded bg-white border border-slate-200 shadow-2xs"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="font-bold text-slate-700">
                                          P{pageNumber}
                                        </span>
                                        <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                                          (Scan #{scanIndex})
                                        </span>
                                        {assignedPage?.isBlank ? (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                            Blank
                                          </span>
                                        ) : isCont ? (
                                          assignedPage?.customRegions && assignedPage.customRegions.length > 0 ? (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                              ✓ Regions
                                            </span>
                                          ) : (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 animate-pulse">
                                              ⚠️ Needs Setup
                                            </span>
                                          )
                                        ) : null}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={pIdx === 0}
                                          onClick={() =>
                                            onReorderStudentPages?.(student.id, pIdx, pIdx - 1)
                                          }
                                          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20"
                                          title="Move page up in student script"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pIdx === assignedPageIdsForStudent.length - 1}
                                          onClick={() =>
                                            onReorderStudentPages?.(student.id, pIdx, pIdx + 1)
                                          }
                                          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20"
                                          title="Move page down in student script"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onUnassignPage?.(student.id, pageId)}
                                          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                          title="Unassign page from student"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}

                              {/* Assign Continuation Page Dropdown */}
                              {unassignedPages.length > 0 && (
                                <div className="pt-1">
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        onAssignContinuationPage?.(student.id, e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="w-full text-[11px] p-1 border border-slate-300 rounded bg-white text-slate-700"
                                  >
                                    <option value="">+ Assign scan page...</option>
                                    {unassignedPages.map((up) => {
                                      const uIdx = pages.findIndex((p) => p.id === up.id) + 1;
                                      return (
                                        <option key={up.id} value={up.id}>
                                          Scan #{uIdx} ({up.fileName?.slice(0, 16) || 'page'})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Status and Diagnostics */}
              {matchingMode === 'recognition' ? (
                <>
                  {unmatchedCount > 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
                      <div className="flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{unmatchedCount + reviewCount + conflictCount} unresolved page(s)</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-snug">
                        You can still apply matching for confirmed students. Unresolved pages will remain unassigned.
                      </p>
                    </div>
                  ) : matchedCount === pages.length && pages.length > 0 ? (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>All {pages.length} pages matched to students!</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
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
                </>
              )}

              {/* Apply Matching Button */}
              <button
                type="button"
                onClick={onApplyMatching}
                disabled={!canApplyMatching}
                className={`w-full py-2 px-3 text-xs font-bold rounded-md transition-colors min-h-[36px] ${
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
                disabled={!appliedMatching || isDirty || !readinessCheck.isReady}
                title={
                  !readinessCheck.isReady
                    ? 'Please configure custom OCR regions for non-blank continuation pages before proceeding.'
                    : undefined
                }
                className={`w-full py-2 px-3 text-xs font-semibold rounded-md transition-colors min-h-[36px] ${
                  appliedMatching && !isDirty && readinessCheck.isReady
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
                }`}
              >
                Next: Verify Transcript →
              </button>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Select a class above to load students
            </div>
          )}
        </aside>
      </div>

      {/* Continuation Page Setup Incomplete Alert Banner */}
      {appliedMatching && !readinessCheck.isReady && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Continuation Page Setup Required ({readinessCheck.incompleteContinuationPages.length} incomplete)</span>
          </div>
          <p className="text-amber-700">
            Before proceeding to transcript verification, non-blank continuation pages (Page 3+) must have custom OCR regions defined:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            {readinessCheck.incompleteContinuationPages.map((item) => (
              <li key={item.pageId}>
                <strong>{item.studentName}</strong> — Page {item.part} ({item.pageFileName || item.pageId}): Set OCR regions or mark as Blank page
              </li>
            ))}
          </ul>
        </div>
      )}

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
          disabled={!appliedMatching || isDirty || !readinessCheck.isReady}
          title={
            !readinessCheck.isReady
              ? 'Please configure custom OCR regions for non-blank continuation pages before proceeding.'
              : undefined
          }
          onClick={onNext}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md min-h-[34px] transition-colors ${
            appliedMatching && !isDirty && readinessCheck.isReady
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

      {/* Adjust Scan Regions Modal */}
      {activeAdjustPage && (
        <AdjustScanRegionsModal
          page={activeAdjustPage}
          templateRegions={templateRegions}
          onSaveRegions={(pageId, customRegions) => {
            onUpdatePageCustomRegions?.(pageId, customRegions);
            setActiveAdjustPage(null);
          }}
          onClose={() => setActiveAdjustPage(null)}
        />
      )}

      {/* Custom OCR Region Editor Modal for Continuation Pages */}
      {customRegionEditorPage && (
        <CustomOcrRegionEditorModal
          page={customRegionEditorPage.page}
          part={customRegionEditorPage.part}
          studentName={customRegionEditorPage.studentName}
          classNumber={customRegionEditorPage.classNumber}
          onSaveRegions={(pageId, customRegions) => {
            onUpdatePageCustomRegions?.(pageId, customRegions);
            setCustomRegionEditorPage(null);
          }}
          onClose={() => setCustomRegionEditorPage(null)}
        />
      )}

      {/* Blank Page Confirmation Modal */}
      {blankConfirmTarget && (
        <BlankPageConfirmModal
          pageNumber={blankConfirmTarget.pageNumber}
          studentName={blankConfirmTarget.studentName}
          hasExistingTranscript={blankConfirmTarget.hasExistingTranscript}
          hasFindings={blankConfirmTarget.hasFindings}
          onConfirm={() => {
            onTogglePageBlank?.(blankConfirmTarget.page.id, true);
            setBlankConfirmTarget(null);
          }}
          onCancel={() => setBlankConfirmTarget(null)}
        />
      )}
    </div>
  );
};
