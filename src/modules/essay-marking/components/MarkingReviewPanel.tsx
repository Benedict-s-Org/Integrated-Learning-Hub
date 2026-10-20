import React, { useState, useEffect, useMemo } from 'react';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  MarkingFinding,
  FindingFeedbackType,
  RubricDimension,
  FindingDecision,
  ScanPage,
  StudentTranscriptState,
  LineWithBbox,
} from '../types';
import {
  CheckCircle2,
  Plus,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  ZoomIn,
  FileText,
  X,
  Info,
} from 'lucide-react';
import { essayServices } from '../services/essayServiceRegistry';
import { ServiceAvailabilityStatus, MarkingModelHealthStatus } from '../services/essayServiceTypes';
import { InlineMarkingView, SelectedWordTarget } from './InlineMarkingView';
import { MagnifierLens, MagnifierState } from './MagnifierLens';
import { ScanPreviewModal } from './ScanPreviewModal';
import { resolveScanPageImageUrl, getFallbackScanImageUrl } from '../utils/scanImageResolver';
import { BatchMarkingQueueProgress } from '../utils/markingBatchQueue';
import { BatchMarkingProgressBanner } from './BatchMarkingProgressBanner';

interface MarkingReviewPanelProps {
  pages?: ScanPage[];
  transcripts?: Record<string, StudentTranscriptState>;
  students: StudentRosterItem[];
  appliedMatching: AppliedMatching;
  activeStudentIndex: number;
  rubric: RubricDimension[];
  markings: Record<string, StudentMarkingState>;
  isRequirementsConfirmed: boolean;
  isTranscriptVerified: boolean;
  onSelectStudent: (index: number) => void;
  onUpdateScores: (studentId: string, scores: Record<string, number>) => void;
  onUpdateFeedback: (studentId: string, feedback: string) => void;
  onAddFinding: (studentId: string, finding: Omit<MarkingFinding, 'id' | 'decision'>) => void;
  onFindingDecision: (studentId: string, findingId: string, decision: FindingDecision, customText?: string) => void;
  onDeleteFinding: (studentId: string, findingId: string) => void;
  onEditFinding?: (studentId: string, findingId: string, updatedFinding: Partial<MarkingFinding>) => void;
  onApproveMarking: (studentId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onRunAiMarking?: (studentId: string) => Promise<void>;
  isAiMarkingLoading?: boolean;
  aiMarkingError?: string | null;
  onUpdateTranscriptText?: (studentId: string, text: string, linesWithBboxes?: LineWithBbox[]) => void;
  onUpdateFindings?: (studentId: string, findings: MarkingFinding[]) => void;
  isBatchRunning?: boolean;
  markingModelHealth?: MarkingModelHealthStatus | null;
  batchProgress?: BatchMarkingQueueProgress | null;
  onRequestStopBatch?: () => void;
  onResumeBatch?: () => void;
  onDismissBatchBanner?: () => void;
}

export const MarkingReviewPanel: React.FC<MarkingReviewPanelProps> = ({
  pages = [],
  transcripts = {},
  students,
  appliedMatching,
  activeStudentIndex,
  rubric,
  markings,
  isRequirementsConfirmed,
  isTranscriptVerified,
  onSelectStudent,
  onUpdateScores,
  onUpdateFeedback,
  onAddFinding,
  onFindingDecision,
  onDeleteFinding,
  onEditFinding,
  onApproveMarking,
  onPrev,
  onNext,
  onRunAiMarking,
  isAiMarkingLoading = false,
  aiMarkingError = null,
  onUpdateTranscriptText,
  onUpdateFindings,
  isBatchRunning = false,
  markingModelHealth = null,
  batchProgress = null,
  onRequestStopBatch,
  onResumeBatch,
  onDismissBatchBanner,
}) => {
  const [showAddFindingModal, setShowAddFindingModal] = useState(false);
  const [newFindingType, setNewFindingType] = useState('Tense');
  const [newFindingFeedbackType, setNewFindingFeedbackType] = useState<FindingFeedbackType>('correction');
  const [newFindingOriginal, setNewFindingOriginal] = useState('');
  const [newFindingReplacement, setNewFindingReplacement] = useState('');
  const [newFindingExplanation, setNewFindingExplanation] = useState('');
  const [newFindingLineIndex, setNewFindingLineIndex] = useState<number | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  // Coordinate mapping & selection state
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [selectedWordTarget, setSelectedWordTarget] = useState<SelectedWordTarget | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedOccurrenceIndex, setSelectedOccurrenceIndex] = useState<number | null>(null);

  // Operation A: Correct OCR transcript modal state
  const [showCorrectOcrModal, setShowCorrectOcrModal] = useState<boolean>(false);
  const [correctOcrLineIdx, setCorrectOcrLineIdx] = useState<number>(0);
  const [correctOcrLineText, setCorrectOcrLineText] = useState<string>('');

  const [isRubricOpen, setIsRubricOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceAvailabilityStatus | null>(null);

  // Scan viewer state (Left Column)
  const [selectedScanPagePart, setSelectedScanPagePart] = useState<number>(1);
  const [previewModalPage, setPreviewModalPage] = useState<ScanPage | null>(null);

  const [magnifier, setMagnifier] = useState<MagnifierState>({
    visible: false,
    x: 0,
    y: 0,
    imgSrc: '',
    bgWidth: 0,
    bgHeight: 0,
    bgX: 0,
    bgY: 0,
    zoomLevel: 3.0,
  });

  useEffect(() => {
    let isMounted = true;
    essayServices
      .getAvailabilityService()
      .checkStatus()
      .then((status) => {
        if (isMounted) setServiceStatus(status);
      })
      .catch(() => {
        if (isMounted) {
          setServiceStatus({
            ocr: { status: 'not_configured', providerName: 'Bridge OCR', details: 'Unreachable' },
            visualVerification: { status: 'error', providerName: 'Vision', details: 'Unreachable' },
            marking: { status: 'error', providerName: 'Local Qwen', details: 'Bridge unreachable' },
            backgroundRunner: { status: 'available', providerName: 'Bridge', details: 'Unreachable' },
            transcription: { status: 'error', providerName: 'Qwen', details: 'Unreachable' },
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeStudent = students[activeStudentIndex];
  const activeStudentId = activeStudent?.id || '';

  // Reset scan page part, line selection and magnifier when active student changes
  useEffect(() => {
    setSelectedScanPagePart(1);
    setSelectedLineIndex(null);
    setSelectedWordTarget(null);
    setSelectedText('');
    setShowCorrectOcrModal(false);
    setShowAddFindingModal(false);
    setMagnifier((prev) => ({ ...prev, visible: false, imgSrc: '' }));
  }, [activeStudentId]);

  // Reset line selection when page part changes
  useEffect(() => {
    setSelectedLineIndex(null);
    setSelectedWordTarget(null);
    setSelectedText('');
  }, [selectedScanPagePart]);

  // Find all scan pages assigned to this active student, ordered by part
  const studentPagesWithIndices: { page: ScanPage; part: number; total: number }[] = [];
  if (appliedMatching && Array.isArray(appliedMatching.map)) {
    appliedMatching.map.forEach((item, pageIndex) => {
      if (item && item.studentIndex === activeStudentIndex && pages[pageIndex]) {
        studentPagesWithIndices.push({
          page: pages[pageIndex],
          part: item.part,
          total: item.total,
        });
      }
    });
  }
  studentPagesWithIndices.sort((a, b) => a.part - b.part);

  const activePageItem =
    studentPagesWithIndices.find((p) => p.part === selectedScanPagePart) ||
    studentPagesWithIndices[0];

  const [currentImgSrc, setCurrentImgSrc] = useState<string>('');
  const [imgLoadError, setImgLoadError] = useState<boolean>(false);

  useEffect(() => {
    if (activePageItem?.page) {
      const initialUrl = resolveScanPageImageUrl(activePageItem.page, activePageItem.part);
      setCurrentImgSrc(initialUrl);
      setImgLoadError(false);
    } else {
      setCurrentImgSrc('');
      setImgLoadError(false);
    }
  }, [activePageItem?.page?.id, activePageItem?.page?.previewUrl, activePageItem?.part, activeStudentIndex]);

  const handleImageError = () => {
    const fallback = getFallbackScanImageUrl(activePageItem?.page, activePageItem?.part);
    if (fallback && currentImgSrc !== fallback) {
      setCurrentImgSrc(fallback);
    } else {
      setImgLoadError(true);
    }
  };

  const defaultScores: Record<string, number> = {};
  rubric.forEach((r) => {
    defaultScores[r.id] = 3;
  });

  const currentMarking = markings[activeStudentId] || {
    studentId: activeStudentId,
    findings: [],
    scores: defaultScores,
    feedbackComment: '',
    isApproved: false,
  };

  const currentTranscript = transcripts[activeStudentId] || {
    studentId: activeStudentId,
    rawOcrText: null,
    editedText: '',
    isManuallyEntered: true,
    uncertainRegions: [],
    isVerified: false,
  };

  const transcriptText = currentTranscript.editedText || currentTranscript.rawOcrText || '';

  // Extract lines with normalized bboxes for the active page
  const currentLinesWithBboxes = currentTranscript.linesWithBboxes || [];

  const activePageLinesWithIndices = useMemo(() => {
    const list: Array<{ line: LineWithBbox; globalIndex: number }> = [];
    currentLinesWithBboxes.forEach((line, globalIndex) => {
      const matchesPage = line.scanPageId
        ? line.scanPageId === activePageItem?.page.id
        : line.pageNumber
        ? line.pageNumber === activePageItem?.part
        : true;
      if (matchesPage) {
        list.push({ line, globalIndex });
      }
    });
    return list;
  }, [currentLinesWithBboxes, activePageItem?.page.id, activePageItem?.part]);

  const hasWordBboxes = useMemo(() => {
    return activePageLinesWithIndices.some(
      ({ line }) => Array.isArray(line.words) && line.words.length > 0
    );
  }, [activePageLinesWithIndices]);

  const handleSelectWord = (target: SelectedWordTarget | null) => {
    setSelectedWordTarget(target);
    setSelectedOccurrenceIndex(null);
    if (target) {
      setSelectedLineIndex(target.lineIndex);
      setSelectedText(target.text);
      setNewFindingOriginal(target.text);
      setNewFindingLineIndex(target.lineIndex);
      checkOverlap(target.text, target.lineIndex);
    } else {
      setSelectedLineIndex(null);
      setSelectedText('');
      setOverlapWarning(null);
    }
  };

  const handleSelectLine = (lineIndex: number | null) => {
    setSelectedLineIndex(lineIndex);
    setSelectedWordTarget(null);
    setSelectedOccurrenceIndex(null);
    if (lineIndex === null) {
      setSelectedText('');
    }
  };

  const handleTextSelection = (text: string, lineIndex: number, occurrenceIndex: number = 0) => {
    setSelectedText(text);
    setSelectedLineIndex(lineIndex);
    setSelectedOccurrenceIndex(occurrenceIndex);
    setSelectedWordTarget(null);
    setNewFindingOriginal(text);
    setNewFindingLineIndex(lineIndex);
    checkOverlap(text, lineIndex);
  };

  const handleClearSelection = () => {
    setSelectedLineIndex(null);
    setSelectedWordTarget(null);
    setSelectedOccurrenceIndex(null);
    setSelectedText('');
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
  };

  // Operation A: Correct OCR Transcript
  const handleOpenCorrectOcrModal = (targetLine?: number) => {
    const lineIdx = targetLine ?? selectedLineIndex ?? 0;
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineContent = lines[lineIdx] ?? '';
    setCorrectOcrLineIdx(lineIdx);
    setCorrectOcrLineText(lineContent);
    setShowCorrectOcrModal(true);
  };

  const handleSaveCorrectOcr = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const oldLineText = lines[correctOcrLineIdx] ?? '';
    const newLineText = correctOcrLineText;

    lines[correctOcrLineIdx] = newLineText;
    const newTranscript = lines.join('\n');

    const updatedLinesWithBboxes = currentLinesWithBboxes.map((l, i) =>
      i === correctOcrLineIdx ? { ...l, text: newLineText } : l
    );

    // Identify findings affected by this OCR correction
    let hasAffectedFindings = false;
    const updatedFindings = currentMarking.findings.map((f) => {
      const wasOnThisLine = f.lineIndex === correctOcrLineIdx || oldLineText.includes(f.originalText);
      if (wasOnThisLine) {
        if (!newLineText.includes(f.originalText)) {
          hasAffectedFindings = true;
          return {
            ...f,
            decision: 'needs_review' as FindingDecision,
            reviewReason: `謄本第 ${correctOcrLineIdx + 1} 行文字已由「${oldLineText}」修正為「${newLineText}」，原始詞句「${f.originalText}」已不在此行中，請重新確認。`,
          };
        }
      }
      return f;
    });

    if (onUpdateTranscriptText) {
      onUpdateTranscriptText(activeStudentId, newTranscript, updatedLinesWithBboxes);
    }

    if (hasAffectedFindings) {
      if (onUpdateFindings) {
        onUpdateFindings(activeStudentId, updatedFindings);
      } else {
        updatedFindings.forEach((f) => {
          if (f.decision === 'needs_review') {
            onFindingDecision(activeStudentId, f.id, 'needs_review');
          }
        });
      }
    }

    setShowCorrectOcrModal(false);
    setSelectedText('');
  };

  // Operation B: Add Finding with pre-fill & overlap check
  const checkOverlap = (original: string, lineIdx: number | null) => {
    if (!original.trim() || lineIdx === null) {
      setOverlapWarning(null);
      return;
    }
    const overlapping = currentMarking.findings.find((f) => {
      if (f.decision === 'rejected') return false;
      if (typeof f.lineIndex === 'number' && f.lineIndex === lineIdx) {
        return f.originalText.includes(original) || original.includes(f.originalText);
      }
      return false;
    });

    if (overlapping) {
      setOverlapWarning(
        `此字詞與現有批改建議「${overlapping.originalText} → ${overlapping.teacherCustomText || overlapping.replacementText}」重疊。請修改現有項目或選取其他字詞。`
      );
    } else {
      setOverlapWarning(null);
    }
  };

  const handleOpenAddFindingModal = () => {
    const targetLine = selectedLineIndex;
    const prefillOriginal = selectedText || '';
    setNewFindingFeedbackType('correction');
    setNewFindingOriginal(prefillOriginal);
    setNewFindingReplacement('');
    setNewFindingExplanation('');
    setNewFindingLineIndex(targetLine);
    checkOverlap(prefillOriginal, targetLine);
    setShowAddFindingModal(true);
  };

  const handleScoreChange = (dimId: string, val: number, maxScore: number) => {
    const clamped = Math.max(0, Math.min(maxScore, val));
    const nextScores = { ...currentMarking.scores, [dimId]: clamped };
    onUpdateScores(activeStudentId, nextScores);
  };

  const totalScore = rubric.reduce(
    (acc, dim) => acc + (currentMarking.scores[dim.id] ?? 0),
    0
  );
  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingOriginal.trim() || !newFindingReplacement.trim() || overlapWarning) return;

    onAddFinding(activeStudentId, {
      type: newFindingType,
      feedbackType: newFindingFeedbackType,
      originalText: newFindingOriginal.trim(),
      replacementText: newFindingReplacement.trim(),
      explanation: newFindingExplanation.trim(),
      lineIndex: newFindingLineIndex ?? undefined,
      occurrenceIndex: selectedOccurrenceIndex ?? undefined,
      isManual: true,
      source: 'teacher',
    });

    setNewFindingFeedbackType('correction');
    setNewFindingOriginal('');
    setNewFindingReplacement('');
    setNewFindingExplanation('');
    setNewFindingLineIndex(null);
    setSelectedOccurrenceIndex(null);
    setOverlapWarning(null);
    setShowAddFindingModal(false);
    setSelectedText('');
  };

  // Pointer hover magnification for the active scan image
  const handleScanPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.pointerType === 'touch') return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH || rect.width <= 0 || rect.height <= 0) return;

    const containerAspect = rect.width / rect.height;
    const imageAspect = naturalW / naturalH;

    let renderedW = rect.width;
    let renderedH = rect.height;
    let letterboxLeft = 0;
    let letterboxTop = 0;

    if (imageAspect > containerAspect) {
      renderedH = rect.width / imageAspect;
      letterboxTop = (rect.height - renderedH) / 2;
    } else {
      renderedW = rect.height * imageAspect;
      letterboxLeft = (rect.width - renderedW) / 2;
    }

    const pointerImgX = e.clientX - rect.left - letterboxLeft;
    const pointerImgY = e.clientY - rect.top - letterboxTop;

    if (pointerImgX < 0 || pointerImgX > renderedW || pointerImgY < 0 || pointerImgY > renderedH) {
      setMagnifier((prev) => ({ ...prev, visible: false }));
      return;
    }

    const clampedX = Math.max(0, Math.min(renderedW, pointerImgX));
    const clampedY = Math.max(0, Math.min(renderedH, pointerImgY));

    const zoom = 3.0;
    const lensWidth = 280;
    const lensHeight = 220;

    let lensX = e.clientX + 24;
    let lensY = e.clientY - lensHeight / 2;

    if (lensX + lensWidth > window.innerWidth - 12) {
      lensX = e.clientX - lensWidth - 24;
    }
    if (lensY < 12) lensY = 12;
    if (lensY + lensHeight > window.innerHeight - 12) {
      lensY = window.innerHeight - lensHeight - 12;
    }

    const bgWidth = renderedW * zoom;
    const bgHeight = renderedH * zoom;
    const bgX = -(clampedX * zoom - lensWidth / 2);
    const bgY = -(clampedY * zoom - lensHeight / 2);

    setMagnifier({
      visible: true,
      x: lensX,
      y: lensY,
      imgSrc: currentImgSrc || img.src,
      bgWidth,
      bgHeight,
      bgX,
      bgY,
      zoomLevel: zoom,
    });
  };

  const handleScanPointerLeave = () => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  };

  const activeMatchInfo =
    appliedMatching?.map?.find(
      (m) => m?.studentIndex === activeStudentIndex && m?.part === (activePageItem?.part ?? 1)
    ) || null;

  return (
    <div className="space-y-4">
      {/* Requirement & Verification Warnings */}
      {!isRequirementsConfirmed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Writing requirements are unconfirmed. Please return to Preparation to confirm assignment scope.
          </span>
        </div>
      )}

      {!isTranscriptVerified && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            The transcript for {activeStudent?.displayName} has not been confirmed yet. Verifying transcript first in Step 4 prevents misinterpreting handwriting ambiguity as student language errors.
          </span>
        </div>
      )}

      {/* Batch AI Marking Progress Banner */}
      {batchProgress && batchProgress.status !== 'idle' && (
        <BatchMarkingProgressBanner
          progress={batchProgress}
          onRequestStop={onRequestStopBatch || (() => {})}
          onResumeBatch={onResumeBatch}
          onDismissBanner={onDismissBatchBanner}
        />
      )}

      {/* Desktop 3-Column Layout:
          Left ~55% (Scan Viewer),
          Middle ~35% (Inline Full-Text Marking + Collapsible Rubric/Feedback),
          Right ~10% (Student Queue) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,35fr)_minmax(140px,10fr)] xl:grid-cols-[minmax(0,55fr)_minmax(0,35fr)_minmax(160px,10fr)] gap-4 items-start">
        {/* ========================================================= */}
        {/* Column 1: Student Handwritten Original Script (~55%)     */}
        {/* ========================================================= */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Handwritten Original Script</span>
                <span className="text-xs font-normal text-slate-500">
                  ({activeStudent?.displayName})
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                {studentPagesWithIndices.length} {studentPagesWithIndices.length === 1 ? 'page' : 'pages'} assigned
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activePageItem && (
                <button
                  type="button"
                  onClick={() => setPreviewModalPage(activePageItem.page)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                  <span>Enlarge Scan</span>
                </button>
              )}
            </div>
          </div>

          {/* Page Tabs for Multi-page Essays */}
          {studentPagesWithIndices.length > 1 && (
            <div className="flex items-center gap-1.5 mb-3 border-b border-slate-100 pb-2 overflow-x-auto">
              {studentPagesWithIndices.map((item) => (
                <button
                  key={item.page.id}
                  type="button"
                  onClick={() => setSelectedScanPagePart(item.part)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors shrink-0 ${
                    item.part === (activePageItem?.part ?? 1)
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Page {item.part} of {item.total}
                </button>
              ))}
            </div>
          )}

          {/* Scan image container: Fit-width with natural vertical scrolling */}
          <div className="flex-1 bg-slate-100/50 border border-slate-200 rounded-md overflow-y-auto overflow-x-hidden max-h-[calc(100vh-270px)] min-h-[520px] relative select-none">
            {activePageItem ? (
              imgLoadError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-white rounded-md border border-dashed border-amber-300 max-w-sm mx-auto my-8 shadow-2xs">
                  <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">未能載入學生原稿掃描檔</p>
                  <p className="text-xs text-slate-500 mt-1">
                    原稿檔案：{activePageItem.page.fileName || '未知檔案'} (第 {activePageItem.part} 頁)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setImgLoadError(false);
                      const fallback = getFallbackScanImageUrl(activePageItem.page, activePageItem.part);
                      setCurrentImgSrc(fallback);
                    }}
                    className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition-colors"
                  >
                    重試載入
                  </button>
                </div>
              ) : (
                <div className="relative w-full">
                  <img
                    src={currentImgSrc}
                    alt={`Student essay scan page ${activePageItem.part}`}
                    onError={handleImageError}
                    onPointerMove={handleScanPointerMove}
                    onPointerLeave={handleScanPointerLeave}
                    className="w-full h-auto block rounded shadow-2xs"
                  />

                  {/* Overlay for Bounding Boxes */}
                  <div className="absolute inset-0 pointer-events-none">
                    {activePageLinesWithIndices.length > 0 &&
                      activePageLinesWithIndices.filter(({ line }) => line.bbox).length === 0 && (
                        <div className="absolute top-3 left-3 bg-slate-900/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded shadow pointer-events-none flex items-center gap-1.5 z-20">
                          <Info className="w-3.5 h-3.5 text-slate-300" />
                          <span>Line positions not available for this page</span>
                        </div>
                      )}

                    {/* Word-Level Bounding Boxes (when page has words) */}
                    {hasWordBboxes
                      ? activePageLinesWithIndices.map(({ line, globalIndex }) => {
                          if (!Array.isArray(line.words) || line.words.length === 0) return null;
                          return line.words.map((w) => {
                            if (!w.bbox) return null;
                            const [wx1, wy1, wx2, wy2] = w.bbox;
                            const isWordSelected =
                              selectedWordTarget?.lineIndex === globalIndex &&
                              selectedWordTarget?.wordIndex === w.wordIndex;

                            const left = Math.max(0, wx1 / 10);
                            const top = Math.max(0, wy1 / 10);
                            const width = Math.max(0.6, (wx2 - wx1) / 10);
                            const height = Math.max(0.6, (wy2 - wy1) / 10);

                            return (
                              <div
                                key={`scan-word-${globalIndex}-${w.wordIndex}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectWord(
                                    isWordSelected
                                      ? null
                                      : {
                                          lineIndex: globalIndex,
                                          wordIndex: w.wordIndex,
                                          text: w.text,
                                          bbox: w.bbox,
                                        }
                                  );
                                }}
                                style={{
                                  position: 'absolute',
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                }}
                                className={`pointer-events-auto cursor-pointer rounded transition-all duration-150 ${
                                  isWordSelected
                                    ? 'bg-purple-500/35 border-2 border-purple-600 shadow-md ring-2 ring-purple-400 z-30'
                                    : 'border border-transparent hover:border-purple-400 hover:bg-purple-500/20 z-10'
                                }`}
                                title={`L${globalIndex + 1} W${w.wordIndex + 1}: "${w.text}"`}
                              >
                                {isWordSelected && (
                                  <span className="absolute -top-4 left-0 px-1 py-0.2 rounded text-[9px] font-bold font-sans bg-purple-600 text-white shadow-xs z-30 whitespace-nowrap pointer-events-none">
                                    {w.text}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })
                      : activePageLinesWithIndices.map(({ line, globalIndex }) => {
                          if (!line.bbox) return null;
                          const [x1, y1, x2, y2] = line.bbox;
                          const isHighlighted = selectedLineIndex === globalIndex;
                          const paddedLeft = Math.max(0, (x1 - 10) / 10);
                          const paddedRight = Math.min(100, (x2 + 10) / 10);
                          const paddedWidth = paddedRight - paddedLeft;

                          return (
                            <div
                              key={`scan-line-${globalIndex}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectLine(isHighlighted ? null : globalIndex);
                              }}
                              style={{
                                position: 'absolute',
                                left: `${paddedLeft}%`,
                                top: `${y1 / 10}%`,
                                width: `${paddedWidth}%`,
                                height: `${(y2 - y1) / 10}%`,
                              }}
                              className={`pointer-events-auto cursor-pointer rounded transition-all duration-150 ${
                                isHighlighted
                                  ? 'bg-purple-500/30 border-2 border-purple-600 shadow-md ring-2 ring-purple-300 z-20'
                                  : 'border border-purple-400/40 hover:border-purple-600 hover:bg-purple-500/15 z-10'
                              }`}
                              title={`Line ${globalIndex + 1}: ${line.text}`}
                            >
                              <span
                                className={`absolute -top-3.5 left-0 px-1 py-0.2 rounded text-[9px] font-bold font-mono transition-opacity ${
                                  isHighlighted
                                    ? 'bg-purple-600 text-white opacity-100 z-30 shadow-xs'
                                    : 'bg-slate-800 text-white opacity-0 hover:opacity-100'
                                }`}
                              >
                                L{globalIndex + 1}
                              </span>
                            </div>
                          );
                        })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewModalPage(activePageItem.page)}
                    title="Enlarge scan for full-screen inspection"
                    className="sticky bottom-3 float-right mr-3 -mt-9 px-2 py-1 bg-slate-900/70 hover:bg-slate-900 text-white rounded text-xs flex items-center gap-1 shadow transition-colors pointer-events-auto z-30"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Enlarge</span>
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-slate-400 py-16 text-xs">
                No scan image assigned to {activeStudent?.displayName}.
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-500 text-center font-medium">
            點擊原稿行框可定位中間文字，滾輪可上下捲動全頁原稿。中間文字稿可直接滑鼠選取字詞進行修正或新增批改。
          </div>
        </section>

        {/* ========================================================= */}
        {/* Column 2: Full-Text Inline Marking & Feedback (~35%)       */}
        {/* ========================================================= */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[560px]">
          {/* Header & AI Marking Toolbar */}
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 mb-3 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>Direct Full-Text Marking</span>
                <span className="text-xs font-normal text-slate-500">
                  ({activeStudent?.displayName})
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                {currentMarking.findings.length} findings • Original script line layout
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddFindingModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Finding</span>
              </button>
            </div>
          </div>

          {/* AI Marking Status & Action Alert */}
          {isAiMarkingLoading ? (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-center justify-between mb-3 animate-pulse">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <div>
                  <strong className="font-semibold">AI Marking in progress:</strong>{' '}
                  {markingModelHealth?.modelId || 'Local LLM'} is evaluating the transcript on port {markingModelHealth?.port || 18086}...
                </div>
              </div>
            </div>
          ) : aiMarkingError ? (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 flex items-center justify-between mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">AI Marking Notice:</strong> {aiMarkingError}
                </div>
              </div>
              {onRunAiMarking && (
                <button
                  type="button"
                  onClick={() => onRunAiMarking(activeStudentId)}
                  disabled={isBatchRunning}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 rounded hover:bg-rose-50 transition-colors shrink-0 ml-2 disabled:opacity-50"
                  title={isBatchRunning ? '批次批改運行中，請稍候' : '重試'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ) : (markingModelHealth?.status === 'ready' || serviceStatus?.marking?.status === 'available') ? (
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center justify-between mb-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">
                    AI Marking Active ({markingModelHealth?.modelId || serviceStatus?.marking?.modelId || 'Port 18086'}):
                  </strong>{' '}
                  {(() => {
                    const reqCount = currentMarking.findings.filter((f) => (f.feedbackType || 'correction') === 'correction').length;
                    const impCount = currentMarking.findings.filter((f) => f.feedbackType === 'improvement').length;
                    const claCount = currentMarking.findings.filter((f) => f.feedbackType === 'clarity').length;
                    if (currentMarking.findings.length === 0) {
                      return 'Ready to evaluate grammar, spelling, and vocabulary.';
                    }
                    return `${reqCount} required corrections • ${impCount} improvements • ${claCount} clarity suggestions available.`;
                  })()}
                </div>
              </div>
              {onRunAiMarking && (
                <button
                  type="button"
                  onClick={() => onRunAiMarking(activeStudentId)}
                  disabled={isAiMarkingLoading || isBatchRunning}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded hover:bg-emerald-100 transition-colors shrink-0 ml-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isBatchRunning ? '批次批改運行中，請稍候' : undefined}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isBatchRunning
                      ? 'Batch Marking...'
                      : currentMarking.findings.length > 0
                      ? 'Re-run AI Marking'
                      : 'Run AI Marking'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">AI Marking Status:</strong>{' '}
                {markingModelHealth?.status === 'bridge_unreachable'
                  ? 'Essay Marking Bridge (18089) is unreachable. Ensure the bridge is running.'
                  : markingModelHealth?.details || serviceStatus?.marking?.details || 'Local marking model on port 18086 is offline. Manual teacher findings can be added above.'}
              </div>
            </div>
          )}

          {/* Active Line / Word Selection Action Toolbar */}
          {(selectedLineIndex !== null || selectedWordTarget !== null || selectedText) && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-md mb-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-purple-900 font-medium">
                <span className="font-bold bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded text-[11px] font-mono">
                  L{(selectedWordTarget?.lineIndex ?? selectedLineIndex ?? 0) + 1}
                  {selectedWordTarget && ` : W${selectedWordTarget.wordIndex + 1}`}
                  {typeof selectedOccurrenceIndex === 'number' && selectedOccurrenceIndex > 0 && ` (#${selectedOccurrenceIndex + 1})`}
                </span>
                <span>
                  {selectedWordTarget ? (
                    <>已選取單詞：「<strong className="text-purple-950 font-serif">{selectedWordTarget.text}</strong>」（第 {selectedWordTarget.lineIndex + 1} 行第 {selectedWordTarget.wordIndex + 1} 個字）</>
                  ) : selectedText ? (
                    <>已選取文字：「<strong className="text-purple-950 font-serif">{selectedText}</strong>」{typeof selectedOccurrenceIndex === 'number' && selectedOccurrenceIndex > 0 ? `（第 ${selectedOccurrenceIndex + 1} 處）` : ''}</>
                  ) : (
                    <>已選取原稿第 <strong>{(selectedLineIndex ?? 0) + 1}</strong> 行</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenCorrectOcrModal(selectedWordTarget?.lineIndex ?? selectedLineIndex ?? 0)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-800 bg-white border border-purple-300 rounded hover:bg-purple-100 transition-colors shadow-2xs"
                  title="原稿正確，但 OCR 抄錯。更新核對後文字，不算作學生錯誤。"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>A. 修正辨識文字</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddFindingModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded hover:bg-emerald-100 transition-colors shadow-2xs"
                  title="原稿本身有錯，但 AI 漏報。標記學生錯誤，並在正上方加上綠色修正。"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>B. 新增批改</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="取消選取"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Full-Text Inline Marking Canvas */}
          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col">
            <InlineMarkingView
              transcript={transcriptText}
              findings={currentMarking.findings}
              studentId={activeStudentId}
              studentName={activeStudent?.displayName}
              selectedLineIndex={selectedLineIndex}
              selectedWordTarget={selectedWordTarget}
              selectedText={selectedText}
              selectedOccurrenceIndex={selectedOccurrenceIndex}
              onSelectLine={handleSelectLine}
              onSelectWord={handleSelectWord}
              onTextSelection={handleTextSelection}
              onFindingDecision={onFindingDecision}
              onDeleteFinding={onDeleteFinding}
              onEditFinding={onEditFinding}
              onUpdateFindings={onUpdateFindings}
            />
          </div>

          {/* Expandable/Collapsible Rubric Scores & Feedback Panel */}
          <div className="mt-4 border border-slate-200 rounded-lg bg-white shadow-xs overflow-hidden">
            <div
              onClick={() => setIsRubricOpen((prev) => !prev)}
              className="flex flex-wrap items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border-b border-slate-200 select-none gap-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-slate-800">
                  Rubric Scores & Feedback
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                  Total: {totalScore} / {maxPossibleScore} pts
                </span>
                {currentMarking.isApproved ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Approved
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Pending Approval
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApproveMarking(activeStudentId);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors shadow-2xs ${
                    currentMarking.isApproved
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {currentMarking.isApproved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>✓ Approved</span>
                    </>
                  ) : (
                    <span>Approve Marking</span>
                  )}
                </button>

                <span className="text-xs text-slate-500 font-medium select-none">
                  {isRubricOpen ? 'Collapse ▲' : 'Expand ▼'}
                </span>
              </div>
            </div>

            {/* Collapsible Content */}
            {isRubricOpen && (
              <div className="p-4 space-y-4 animate-in fade-in duration-150">
                {/* Rubric Dimension Score Inputs */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Rubric Dimensions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {rubric.map((dim) => {
                      const currentScore = currentMarking.scores[dim.id] ?? 0;
                      return (
                        <div
                          key={dim.id}
                          className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-50 border border-slate-200 text-xs"
                        >
                          <label
                            htmlFor={`dim-${dim.id}`}
                            className="font-medium text-slate-700 truncate pr-1"
                          >
                            {dim.name}
                          </label>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              id={`dim-${dim.id}`}
                              type="number"
                              min="0"
                              max={dim.maxScore}
                              value={currentScore}
                              onChange={(e) =>
                                handleScoreChange(
                                  dim.id,
                                  parseInt(e.target.value, 10) || 0,
                                  dim.maxScore
                                )
                              }
                              className="w-12 text-center py-0.5 px-1 border border-slate-300 rounded bg-white text-xs font-semibold"
                            />
                            <span className="text-slate-400">/ {dim.maxScore}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Commentary */}
                <div>
                  <label
                    htmlFor="studentFeedback"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Teacher Written Feedback Commentary
                  </label>
                  <textarea
                    id="studentFeedback"
                    rows={4}
                    value={currentMarking.feedbackComment}
                    onChange={(e) =>
                      onUpdateFeedback(activeStudentId, e.target.value)
                    }
                    placeholder="Provide constructive feedback highlighting strengths and next writing steps..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed resize-y"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    {currentMarking.isApproved
                      ? 'Approved by teacher.'
                      : 'Pending teacher approval.'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onApproveMarking(activeStudentId)}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      currentMarking.isApproved
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                    }`}
                  >
                    {currentMarking.isApproved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>✓ Teacher Approved</span>
                      </>
                    ) : (
                      <span>Save & Approve Marking</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* Column 3: Student Queue (~10%, min 140px)                */}
        {/* ========================================================= */}
        <aside className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs sticky top-14 min-w-[140px] overflow-hidden">
          <div className="pb-2 border-b border-slate-100 mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate">
              Student Queue
            </h3>
            <span className="text-[11px] text-slate-400 truncate block">
              {appliedMatching?.classId} • {(appliedMatching?.assignedStudentIndices || []).length} essays
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[calc(100vh-240px)] overflow-y-auto">
            {(appliedMatching?.assignedStudentIndices || []).map((studentIdx) => {
              const student = students[studentIdx];
              if (!student) return null;
              const isSelected = studentIdx === activeStudentIndex;
              const marking = markings[student.id];
              const isApproved = marking?.isApproved;
              const activeFindings = (marking?.findings || []).filter((f) => f.decision !== 'rejected');
              const reqCount = activeFindings.filter((f) => (f.feedbackType || 'correction') === 'correction').length;
              const refCount = activeFindings.filter((f) => f.feedbackType === 'improvement' || f.feedbackType === 'clarity').length;

              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onSelectStudent(studentIdx)}
                  title={`${String(student.classNumber).padStart(2, '0')} · ${student.displayName}`}
                  className={`w-full text-left p-2 rounded-md transition-colors my-0.5 text-xs ${
                    isSelected
                      ? 'bg-blue-50 text-blue-800 font-semibold border border-blue-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {String(student.classNumber).padStart(2, '0')} · {student.displayName}
                    </span>
                    {isApproved && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <span
                    className={`block text-[10px] mt-0.5 truncate ${
                      isApproved
                        ? 'text-emerald-600'
                        : reqCount > 0
                        ? 'text-blue-600 font-medium'
                        : refCount > 0
                        ? 'text-purple-600 font-medium'
                        : marking?.feedbackComment
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {isApproved
                      ? '✓ Approved'
                      : reqCount > 0
                      ? `${reqCount} corr${refCount > 0 ? ` · ${refCount} opt` : ''}`
                      : refCount > 0
                      ? `${refCount} opt suggestions`
                      : marking?.feedbackComment
                      ? 'Draft review'
                      : 'Pending review'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Operation B: Add Finding Modal */}
      {showAddFindingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>新增批改 (Add Finding)</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddFindingModal(false);
                  setOverlapWarning(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-2.5 rounded-md text-xs space-y-1 border ${
                newFindingFeedbackType === 'improvement'
                  ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                  : newFindingFeedbackType === 'clarity'
                  ? 'bg-sky-50/80 border-sky-200 text-sky-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
            >
              <p className="font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {newFindingFeedbackType === 'improvement'
                    ? '可選潤色建議（紫字）：保留學生文意，供參考'
                    : newFindingFeedbackType === 'clarity'
                    ? '文理連貫建議（藍字）：釐清指代或銜接，供參考'
                    : '原稿本身有錯，AI 漏報：標記錯字並更正 (Red/Green)'}
                </span>
              </p>
              <p className="text-[11px] leading-relaxed">
                {newFindingFeedbackType === 'improvement'
                  ? '原文維持正常基線與字色，紫字建議顯示於上方括號 (suggestion) 中，不強制採納、不扣分。'
                  : newFindingFeedbackType === 'clarity'
                  ? '原文維持正常基線，藍字建議顯示於上方括號中；若文意不確定可填寫 Clarification needed。'
                  : '在正文中以紅字＋刪除線標記最小錯字範圍，綠字修正顯示於正上方。'}
              </p>
            </div>

            {overlapWarning && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-md text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{overlapWarning}</span>
              </div>
            )}

            <form onSubmit={handleCreateFinding} className="space-y-3 text-xs">
              {/* Feedback Type Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  批改反饋類型 (Feedback Type)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewFindingFeedbackType('correction')}
                    className={`py-1.5 px-2 rounded border text-center transition-colors font-semibold text-xs ${
                      newFindingFeedbackType === 'correction'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    1. 必要修正 (Red/Green)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFindingFeedbackType('improvement')}
                    className={`py-1.5 px-2 rounded border text-center transition-colors font-semibold text-xs ${
                      newFindingFeedbackType === 'improvement'
                        ? 'bg-purple-50 border-purple-300 text-purple-800 ring-1 ring-purple-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    2. 潤色建議 (Purple)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFindingFeedbackType('clarity')}
                    className={`py-1.5 px-2 rounded border text-center transition-colors font-semibold text-xs ${
                      newFindingFeedbackType === 'clarity'
                        ? 'bg-sky-50 border-sky-300 text-sky-800 ring-1 ring-sky-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    3. 文理連貫 (Blue)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  分類標籤 (Category)
                </label>
                <select
                  value={newFindingType}
                  onChange={(e) => setNewFindingType(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                >
                  <option value="Tense">Tense</option>
                  <option value="Grammar">Grammar</option>
                  <option value="Spelling">Spelling</option>
                  <option value="Punctuation">Punctuation</option>
                  <option value="Capitalization">Capitalization</option>
                  <option value="Vocabulary">Vocabulary</option>
                  <option value="Coherence">Coherence</option>
                  <option value="Clarity">Clarity</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    學生原文錯字 (Original Text)
                  </label>
                  {typeof newFindingLineIndex === 'number' && (
                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-mono font-semibold">
                      第 {newFindingLineIndex + 1} 行
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="例如：mess"
                  value={newFindingOriginal}
                  onChange={(e) => {
                    setNewFindingOriginal(e.target.value);
                    checkOverlap(e.target.value, newFindingLineIndex);
                  }}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-serif text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  建議修正 (Suggested Replacement — 顯示於綠字上方)
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：messes"
                  value={newFindingReplacement}
                  onChange={(e) => setNewFindingReplacement(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white font-sans text-sm text-emerald-800 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  教師解釋／語法規則 (Explanation — 選填)
                </label>
                <input
                  type="text"
                  placeholder="例如：主詞為第三人稱單數，動詞需加 -es"
                  value={newFindingExplanation}
                  onChange={(e) => setNewFindingExplanation(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFindingModal(false);
                    setOverlapWarning(null);
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={Boolean(overlapWarning)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-semibold text-xs shadow-2xs"
                >
                  儲存批改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operation A: Correct OCR Modal */}
      {showCorrectOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  修正辨識文字 (Correct OCR) — 第 {correctOcrLineIdx + 1} 行
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectOcrModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-blue-900 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>原稿正確，但 OCR 抄錯</span>
              </p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                此操作僅更新核對後文字，<strong>不算作學生錯誤</strong>，不產生紅字刪除線或綠字修正。保存後將同步更新至 Step 4 核對後謄本，並維持來源行與原稿座標的關聯。
              </p>
            </div>

            <form onSubmit={handleSaveCorrectOcr} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  核對後文字 (修正此行文字以完全符合學生原稿手寫字)：
                </label>
                <textarea
                  rows={3}
                  required
                  value={correctOcrLineText}
                  onChange={(e) => setCorrectOcrLineText(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-serif text-sm bg-white text-slate-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  placeholder="輸入符合手寫原稿的正確文字..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCorrectOcrModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs shadow-2xs"
                >
                  儲存文字修正
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan Preview Modal for Enlarge View */}
      {previewModalPage && (
        <ScanPreviewModal
          page={previewModalPage}
          matchInfo={activeMatchInfo}
          imageUrl={currentImgSrc}
          onClose={() => setPreviewModalPage(null)}
        />
      )}

      {/* Handwriting Lens Magnifier */}
      <MagnifierLens state={magnifier} />

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Transcripts
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[34px] transition-colors"
        >
          <span>Export Report →</span>
        </button>
      </div>
    </div>
  );
};
