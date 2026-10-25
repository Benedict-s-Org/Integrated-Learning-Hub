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
  StructuredAssessmentComments,
  StagedAiProposal,
  PrimaryGrade,
  AssignmentConfig,
  AssignmentTranscriptionSettings,
  StagedCandidateTranscript,
} from '../types';
import {
  CheckCircle2,
  Plus,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  RefreshCw,
  ZoomIn,
  FileText,
  X,
  Info,
  MousePointer,
  ChevronRight,
  Check,
  RotateCcw,
} from 'lucide-react';
import { essayServices } from '../services/essayServiceRegistry';
import { ServiceAvailabilityStatus, MarkingModelHealthStatus } from '../services/essayServiceTypes';
import { InlineMarkingView, SelectedWordTarget } from './InlineMarkingView';
import { MagnifierLens, MagnifierState } from './MagnifierLens';
import { ScanPreviewModal } from './ScanPreviewModal';
import { resolveScanPageImageUrl, getFallbackScanImageUrl } from '../utils/scanImageResolver';
import { BatchMarkingQueueProgress } from '../utils/markingBatchQueue';
import { BatchMarkingProgressBanner } from './BatchMarkingProgressBanner';
import { AiMarkingFreshness } from '../utils/backgroundMarkingQueue';
import {
  remapFindingsThroughEdit,
  remapFindingsThroughEdits,
  computeTranscriptEdits,
  TranscriptEditOperation,
  findAllOccurrences,
  buildTranscriptParagraphStructure,
} from '../utils/markingTextAlignment';
import { TranscriptionToolbar } from './TranscriptionToolbar';
import { StagedCandidateBox } from './StagedCandidateBox';
import { TranscriptionSettingsModal } from './TranscriptionSettingsModal';
import { useEssayTranscription } from '../hooks/useEssayTranscription';

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
  onRunAiMarking?: (studentId: string) => Promise<void> | void;
  onRerunAiMarkingAndGoNext?: (studentId: string) => void;
  isAiMarkingLoading?: boolean;
  aiMarkingError?: string | null;
  onUpdateTranscriptText?: (
    studentId: string,
    text: string,
    linesWithBboxes?: LineWithBbox[]
  ) => { committedText: string; revision: number } | void;
  onUpdateFindings?: (studentId: string, findings: MarkingFinding[]) => void;
  isBatchRunning?: boolean;
  markingModelHealth?: MarkingModelHealthStatus | null;
  batchProgress?: BatchMarkingQueueProgress | null;
  onRequestStopBatch?: () => void;
  onResumeBatch?: () => void;
  onDismissBatchBanner?: () => void;
  freshnessMap?: Record<string, AiMarkingFreshness>;
  assignmentGrade?: PrimaryGrade | null;
  onAcceptStagedAiProposal?: (
    studentId: string,
    options: {
      applyScores?: boolean;
      applyComments?: boolean;
      applyFindings?: boolean;
    }
  ) => void;
  onDismissStagedAiProposal?: (studentId: string) => void;
  onUpdateAssessmentComments?: (
    studentId: string,
    comments: StructuredAssessmentComments
  ) => void;
  assignment?: AssignmentConfig;
  onVerifyTranscript?: (studentId: string) => void;
  onUpdateAssignmentSettings?: (settings: AssignmentTranscriptionSettings) => void;
  stagedCandidates?: Record<string, StagedCandidateTranscript>;
  onSetStagedCandidates?: React.Dispatch<React.SetStateAction<Record<string, StagedCandidateTranscript>>>;
  onCandidateProduced?: (studentId: string, candidate: StagedCandidateTranscript) => void;
  onApplyCandidateTranscript?: (studentId: string, candidate: StagedCandidateTranscript) => void;
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
  onRerunAiMarkingAndGoNext,
  freshnessMap = {},
  assignmentGrade,
  onAcceptStagedAiProposal,
  onDismissStagedAiProposal,
  onUpdateAssessmentComments,
  assignment,
  onVerifyTranscript,
  onUpdateAssignmentSettings,
  stagedCandidates,
  onSetStagedCandidates,
  onCandidateProduced,
  onApplyCandidateTranscript,
}) => {
  const [internalStagedCandidates, setInternalStagedCandidates] = useState<Record<string, StagedCandidateTranscript>>({});
  const stagedCandidatesMap = stagedCandidates ?? internalStagedCandidates;
  const setStagedCandidatesMap = onSetStagedCandidates ?? setInternalStagedCandidates;

  const transcription = useEssayTranscription({
    students,
    pages,
    appliedMatching,
    activeStudentIndex,
    transcripts,
    assignment: assignment || {
      id: 'default',
      title: 'Writing Assignment',
      grade: assignmentGrade || 'P4',
      scopePrompt: '',
      rubric,
      isConfirmed: isRequirementsConfirmed,
      responseFormat: 'worksheet',
    },
    onUpdateTranscriptText: onUpdateTranscriptText || (() => {}),
    onVerifyTranscript,
    onUpdateAssignmentSettings,
    stagedCandidates: stagedCandidatesMap,
    onSetStagedCandidates: setStagedCandidatesMap,
    onCandidateProduced,
    onApplyCandidateTranscript,
  });
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
  const [correctOcrWordText, setCorrectOcrWordText] = useState<string>('');
  const [correctOcrWordIndex, setCorrectOcrWordIndex] = useState<number | null>(null);

  // In-place selection context menu & selected-source correction editor
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    kind: 'plain' | 'finding' | 'selection';
    sourceText: string;
    lineIndex: number | null;
    findingId: string | null;
    selectionRange?: { startLine: number; startOffset: number; endLine: number; endOffset: number; revision: number };
  } | null>(null);
  const [correctionEditor, setCorrectionEditor] = useState<{
    sourceText: string;
    range: { startLine: number; startOffset: number; endLine: number; endOffset: number; revision: number };
    involvedFindingIds: string[];
  } | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{
    startLine: number;
    startOffset: number;
    endLine: number;
    endOffset: number;
  } | null>(null);

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
        const part = item.part ?? (item as any).partIndex ?? 1;
        const total = item.total ?? (item as any).totalParts ?? 1;
        studentPagesWithIndices.push({
          page: pages[pageIndex],
          part,
          total,
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

  const [isReviewProposalModalOpen, setIsReviewProposalModalOpen] = useState(false);
  const [applyProposalScores, setApplyProposalScores] = useState(true);
  const [applyProposalComments, setApplyProposalComments] = useState(true);
  const [applyProposalFindings, setApplyProposalFindings] = useState(true);

  const currentMarking = markings[activeStudentId] || {
    studentId: activeStudentId,
    findings: [],
    scores: {},
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

  const transcriptText =
    typeof currentTranscript.editedText === 'string'
      ? currentTranscript.editedText
      : (currentTranscript.rawOcrText ?? '');

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
      const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
      const lineStr = lines[target.lineIndex] ?? '';
      const start = lineStr.indexOf(target.text);
      if (start >= 0) {
        setSelectedRange({
          startLine: target.lineIndex,
          startOffset: start,
          endLine: target.lineIndex,
          endOffset: start + target.text.length,
        });
      } else {
        setSelectedRange(null);
      }
      checkOverlap(target.text, target.lineIndex);
    } else {
      setSelectedLineIndex(null);
      setSelectedText('');
      setSelectedRange(null);
      setOverlapWarning(null);
    }
  };

  const handleSelectLine = (lineIndex: number | null) => {
    setSelectedLineIndex(lineIndex);
    setSelectedWordTarget(null);
    setSelectedOccurrenceIndex(null);
    if (lineIndex === null) {
      setSelectedText('');
      setSelectedRange(null);
    }
  };

  const handleTextSelection = (
    text: string,
    lineIndex: number,
    occurrenceIndex: number = 0,
    exactRange?: { startOffset: number; endOffset: number }
  ) => {
    setSelectedText(text);
    setSelectedLineIndex(lineIndex);
    setSelectedOccurrenceIndex(occurrenceIndex);
    setSelectedWordTarget(null);
    setNewFindingOriginal(text);
    setNewFindingLineIndex(lineIndex);
    if (exactRange) {
      setSelectedRange({
        startLine: lineIndex,
        startOffset: exactRange.startOffset,
        endLine: lineIndex,
        endOffset: exactRange.endOffset,
      });
    } else {
      const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
      const lineStr = lines[lineIndex] ?? '';
      const start = lineStr.indexOf(text);
      if (start >= 0) {
        setSelectedRange({
          startLine: lineIndex,
          startOffset: start,
          endLine: lineIndex,
          endOffset: start + text.length,
        });
      } else {
        setSelectedRange(null);
      }
    }
    checkOverlap(text, lineIndex);
  };

  const handleClearSelection = () => {
    setSelectedLineIndex(null);
    setSelectedWordTarget(null);
    setSelectedOccurrenceIndex(null);
    setSelectedText('');
    setSelectedRange(null);
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
  };

  // Operation A: Correct OCR Transcript
  const handleOpenCorrectOcrModal = (targetLine?: number, targetWord?: string, wordIndex?: number) => {
    const lineIdx = targetLine ?? selectedLineIndex ?? 0;
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineContent = lines[lineIdx] ?? '';
    setCorrectOcrLineIdx(lineIdx);
    setCorrectOcrLineText(lineContent);
    setCorrectOcrWordText(targetWord ?? selectedWordTarget?.text ?? '');
    setCorrectOcrWordIndex(wordIndex ?? selectedWordTarget?.wordIndex ?? null);
    setShowCorrectOcrModal(true);
  };

  const handleWordClick = (target: { lineIndex: number; wordIndex: number; text: string }) => {
    handleOpenCorrectOcrModal(target.lineIndex, target.text, target.wordIndex);
  };

  const handleOpenAddFindingForPhrase = (
    phrase: string,
    lineIndex: number,
    range?: { startOffset: number; endOffset: number },
    occurrenceIndex?: number
  ) => {
    setNewFindingFeedbackType('correction');
    setNewFindingOriginal(phrase);
    setNewFindingReplacement('');
    setNewFindingExplanation('');
    setNewFindingLineIndex(lineIndex);
    if (range) {
      setSelectedRange({
        startLine: lineIndex,
        startOffset: range.startOffset,
        endLine: lineIndex,
        endOffset: range.endOffset,
      });
    }
    if (typeof occurrenceIndex === 'number') {
      setSelectedOccurrenceIndex(occurrenceIndex);
    }
    checkOverlap(phrase, lineIndex, range);
    setShowAddFindingModal(true);
    setContextMenu(null);
  };

  const handleWordContextMenu = (
    target: { lineIndex: number; wordIndex: number; text: string; startOffset?: number; endOffset?: number },
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    if (selectedText && selectedText.trim() && selectedLineIndex === target.lineIndex) {
      const lineStr = lines[selectedLineIndex ?? 0] ?? '';
      const startOffset = selectedRange ? selectedRange.startOffset : Math.max(0, lineStr.indexOf(selectedText));
      const endOffset = selectedRange ? selectedRange.endOffset : (startOffset + selectedText.length);
      const occurrences = findAllOccurrences(lineStr, selectedText);
      let occIdx = selectedOccurrenceIndex ?? 0;
      if (typeof selectedOccurrenceIndex !== 'number' && occurrences.length > 0) {
        const matchIdx = occurrences.indexOf(startOffset);
        occIdx = matchIdx !== -1 ? matchIdx : 0;
      }
      handleOpenAddFindingForPhrase(
        selectedText,
        selectedLineIndex ?? 0,
        { startOffset, endOffset },
        occIdx
      );
    } else {
      const lineStr = lines[target.lineIndex] ?? '';
      const occurrences = findAllOccurrences(lineStr, target.text);
      let startOffset = typeof target.startOffset === 'number' ? target.startOffset : Math.max(0, lineStr.indexOf(target.text));
      let endOffset = typeof target.endOffset === 'number' ? target.endOffset : (startOffset + target.text.length);
      let occIdx = 0;
      if (occurrences.length > 0) {
        const matchIdx = occurrences.indexOf(startOffset);
        if (matchIdx !== -1) {
          occIdx = matchIdx;
        } else if (target.wordIndex < occurrences.length) {
          occIdx = target.wordIndex;
          startOffset = occurrences[occIdx];
          endOffset = startOffset + target.text.length;
        }
      }
      handleOpenAddFindingForPhrase(
        target.text,
        target.lineIndex,
        { startOffset, endOffset },
        occIdx
      );
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (selectedText && selectedText.trim()) {
      e.preventDefault();
      const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
      const lineStr = lines[selectedLineIndex ?? 0] ?? '';
      const startOffset = selectedRange ? selectedRange.startOffset : Math.max(0, lineStr.indexOf(selectedText));
      const endOffset = selectedRange ? selectedRange.endOffset : (startOffset + selectedText.length);
      handleOpenAddFindingForPhrase(
        selectedText,
        selectedLineIndex ?? 0,
        { startOffset, endOffset },
        selectedOccurrenceIndex ?? undefined
      );
    }
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

  const computeLineEditOperation = (lineIndex: number, oldText: string, newText: string): TranscriptEditOperation => {
    const lines = oldText.replace(/\r\n/g, '\n').split('\n');
    let offset = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) offset += lines[i].length + 1;
    return { start: offset, end: offset + (lines[lineIndex]?.length ?? 0), inserted: newText };
  };

  const applyRemapFindings = (newTranscript: string, edit: TranscriptEditOperation) => {
    const remap = remapFindingsThroughEdit(transcriptText, newTranscript, currentMarking.findings, edit);
    const outcomeById = new Map(remap.map((o) => [o.findingId, o]));
    let hasChanges = false;
    const updatedFindings = currentMarking.findings.map((f) => {
      const outcome = outcomeById.get(f.id);
      if (!outcome) return f;
      if (outcome.status === 'mapped' && outcome.mapped) {
        hasChanges = true;
        return {
          ...f,
          lineIndex: outcome.mapped.lineIndex,
          occurrenceIndex: outcome.mapped.occurrenceIndex,
          paragraphIndex: outcome.mapped.paragraphIndex,
          startIndex: outcome.mapped.startIndex,
          endIndex: outcome.mapped.endIndex,
          anchorReview: false,
          anchorReviewReason: undefined,
        };
      }
      hasChanges = true;
      return { ...f, anchorReview: true, anchorReviewReason: outcome.anchorReviewReason };
    });
    if (hasChanges && onUpdateFindings) {
      onUpdateFindings(activeStudentId, updatedFindings);
    }
  };

  const handleTranscriptTextEdit = (lineIndex: number, newLineText: string) => {
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    if ((lines[lineIndex] ?? '') === newLineText) return;
    const oldTranscript = transcriptText;
    lines[lineIndex] = newLineText;
    const newTranscript = lines.join('\n');
    const updatedLinesWithBboxes = currentLinesWithBboxes.map((l, i) =>
      i === lineIndex ? { ...l, text: newLineText } : l
    );
    const edit = computeLineEditOperation(lineIndex, oldTranscript, newLineText);
    if (onUpdateTranscriptText) {
      onUpdateTranscriptText(activeStudentId, newTranscript, updatedLinesWithBboxes);
    }
    applyRemapFindings(newTranscript, edit);
  };

  const handleSaveWholeTranscript = (newTranscriptText: string, baseRevision?: number) => {
    const oldText = transcriptText.replace(/\r\n/g, '\n');
    const newText = newTranscriptText.replace(/\r\n/g, '\n');
    if (oldText === newText) return;

    const currentRev = currentTranscript.revision ?? 0;
    if (typeof baseRevision === 'number' && baseRevision < currentRev) {
      console.warn('Transcript has been updated since draft was started. Base revision:', baseRevision, 'Current:', currentRev);
    }

    const edits = computeTranscriptEdits(oldText, newText);

    // Preserve newlines and rebuild lines model
    const newLines = newText.split('\n');
    const updatedLinesWithBboxes: LineWithBbox[] = newLines.map((text, i) => {
      const existing = currentLinesWithBboxes[i];
      if (existing) {
        return { ...existing, text };
      }
      return {
        text,
        pageNumber: activePageItem?.part || 1,
        scanPageId: activePageItem?.page?.id,
        box: [0, 0, 100, 100] as [number, number, number, number],
      };
    });

    if (onUpdateTranscriptText) {
      onUpdateTranscriptText(activeStudentId, newText, updatedLinesWithBboxes);
    }

    const remap = remapFindingsThroughEdits(oldText, newText, currentMarking.findings, edits);
    const outcomeById = new Map(remap.map((o) => [o.findingId, o]));
    let hasChanges = false;
    const updatedFindings = currentMarking.findings.map((f) => {
      const outcome = outcomeById.get(f.id);
      if (!outcome) return f;
      if (outcome.status === 'mapped' && outcome.mapped) {
        hasChanges = true;
        return {
          ...f,
          lineIndex: outcome.mapped.lineIndex,
          occurrenceIndex: outcome.mapped.occurrenceIndex,
          paragraphIndex: outcome.mapped.paragraphIndex,
          startIndex: outcome.mapped.startIndex,
          endIndex: outcome.mapped.endIndex,
          anchorReview: false,
          anchorReviewReason: undefined,
        };
      }
      hasChanges = true;
      return { ...f, anchorReview: true, anchorReviewReason: outcome.anchorReviewReason };
    });
    if (hasChanges && onUpdateFindings) {
      onUpdateFindings(activeStudentId, updatedFindings);
    }
  };

  const handleSelectionContextMenu = (
    payload: {
      sourceText: string;
      startLine: number;
      startOffset: number;
      endLine: number;
      endOffset: number;
      involvedFindingIds: string[];
    },
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineStr = lines[payload.startLine] ?? '';
    const occurrences = findAllOccurrences(lineStr, payload.sourceText);
    let occIdx = 0;
    if (occurrences.length > 0) {
      const matchIdx = occurrences.indexOf(payload.startOffset);
      if (matchIdx !== -1) {
        occIdx = matchIdx;
      } else {
        let minDiff = Infinity;
        occurrences.forEach((o, i) => {
          const diff = Math.abs(o - payload.startOffset);
          if (diff < minDiff) {
            minDiff = diff;
            occIdx = i;
          }
        });
      }
    }
    handleOpenAddFindingForPhrase(
      payload.sourceText,
      payload.startLine,
      { startOffset: payload.startOffset, endOffset: payload.endOffset },
      occIdx
    );
  };

  const handleFindingContextMenu = (findingId: string, e: React.MouseEvent) => {
    const f = currentMarking.findings.find((x) => x.id === findingId);
    const lineIndex = f?.lineIndex ?? 0;
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineStr = lines[lineIndex] ?? '';
    const startOffset =
      f && typeof f.startIndex === 'number' && f.startIndex >= 0
        ? f.startIndex
        : f
        ? Math.max(0, lineStr.indexOf(f.originalText))
        : 0;
    const endOffset =
      f && typeof f.endIndex === 'number' && f.endIndex > startOffset
        ? f.endIndex
        : startOffset + (f?.originalText.length ?? 0);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      kind: 'finding',
      sourceText: f?.originalText ?? '',
      lineIndex: f?.lineIndex ?? null,
      findingId,
      selectionRange: {
        startLine: lineIndex,
        startOffset,
        endLine: lineIndex,
        endOffset,
        revision: currentTranscript.revision ?? 0,
      },
    });
  };

  const openCorrectionEditorForSelection = () => {
    if (!contextMenu?.selectionRange) return;
    setCorrectionEditor({
      sourceText: contextMenu.sourceText,
      range: contextMenu.selectionRange,
      involvedFindingIds: contextMenu.findingId ? [contextMenu.findingId] : [],
    });
    setCorrectionText(contextMenu.sourceText);
    setContextMenu(null);
  };

  const applySelectedCorrection = () => {
    if (!correctionEditor) return;
    const { range, sourceText } = correctionEditor;
    const currentLines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineIdx = range.startLine;
    const oldLine = currentLines[lineIdx] ?? '';

    let startOffset = range.startOffset;
    let endOffset = range.endOffset;

    if (oldLine.slice(startOffset, endOffset) !== sourceText) {
      const idx = oldLine.indexOf(sourceText);
      if (idx !== -1) {
        startOffset = idx;
        endOffset = idx + sourceText.length;
      } else {
        // Range changed and sourceText not found on this line; abort
        setCorrectionEditor(null);
        return;
      }
    }

    const newLine = oldLine.slice(0, startOffset) + correctionText + oldLine.slice(endOffset);
    handleTranscriptTextEdit(lineIdx, newLine);
    setCorrectionEditor(null);
  };


  const checkOverlap = (
    original: string,
    lineIdx: number | null,
    range?: { startOffset: number; endOffset: number }
  ) => {
    if (!original.trim() || lineIdx === null) {
      setOverlapWarning(null);
      return;
    }
    const lines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const lineStr = lines[lineIdx] ?? '';

    const overlapping = currentMarking.findings.find((f) => {
      if (f.decision === 'rejected') return false;
      if (typeof f.lineIndex === 'number' && f.lineIndex === lineIdx) {
        if (range) {
          let fStart = typeof f.startIndex === 'number' ? f.startIndex : -1;
          let fEnd = typeof f.endIndex === 'number' ? f.endIndex : -1;

          if (fStart === -1 && f.originalText) {
            const occs = findAllOccurrences(lineStr, f.originalText);
            const occIdx = typeof f.occurrenceIndex === 'number' ? f.occurrenceIndex : 0;
            if (occs[occIdx] !== undefined) {
              fStart = occs[occIdx];
              fEnd = fStart + f.originalText.length;
            }
          }

          if (fStart !== -1 && fEnd !== -1) {
            return range.startOffset < fEnd && range.endOffset > fStart;
          }
        }
        return false;
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

  const handleCloseAddFindingModal = () => {
    setShowAddFindingModal(false);
    setOverlapWarning(null);
    setSelectedRange(null);
    setSelectedLineIndex(null);
    setSelectedOccurrenceIndex(null);
    setSelectedWordTarget(null);
    setSelectedText('');
    setNewFindingOriginal('');
    setNewFindingReplacement('');
    setNewFindingExplanation('');
    setNewFindingLineIndex(null);
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
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
    checkOverlap(
      prefillOriginal,
      targetLine,
      selectedRange ? { startOffset: selectedRange.startOffset, endOffset: selectedRange.endOffset } : undefined
    );
    setShowAddFindingModal(true);
  };

  const handleScoreChange = (dimId: string, val: number, maxScore: number) => {
    const clamped = Math.max(0, Math.min(maxScore, val));
    const nextScores = { ...currentMarking.scores, [dimId]: clamped };
    onUpdateScores(activeStudentId, nextScores);
  };

  const hasScores = Object.keys(currentMarking.scores || {}).length > 0;
  const totalScore =
    currentMarking.totalScore ??
    (hasScores
      ? rubric.reduce((acc, dim) => acc + (currentMarking.scores[dim.id] ?? 0), 0)
      : 0);
  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingOriginal.trim() || !newFindingReplacement.trim() || overlapWarning) return;

    const rawLines = transcriptText.replace(/\r\n/g, '\n').split('\n');
    const structure = buildTranscriptParagraphStructure(rawLines);
    let paraIdx: number | undefined;
    if (typeof newFindingLineIndex === 'number') {
      structure.paragraphs.forEach((para, pIdx) => {
        if (para.some((l) => l.rawLineIndex === newFindingLineIndex)) {
          paraIdx = pIdx;
        }
      });
    }

    const startOff = selectedRange ? selectedRange.startOffset : undefined;
    const endOff = selectedRange ? selectedRange.endOffset : undefined;

    onAddFinding(activeStudentId, {
      type: newFindingType,
      feedbackType: newFindingFeedbackType,
      originalText: newFindingOriginal.trim(),
      replacementText: newFindingReplacement.trim(),
      explanation: newFindingExplanation.trim(),
      lineIndex: newFindingLineIndex ?? undefined,
      paragraphIndex: paraIdx,
      occurrenceIndex: selectedOccurrenceIndex ?? undefined,
      startIndex: startOff,
      endIndex: endOff,
      charStart: startOff,
      charEnd: endOff,
      isManual: true,
      source: 'teacher',
    });

    handleCloseAddFindingModal();
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

      {/* Restored OCR Toolbar for Unified Step 4 */}
      <TranscriptionToolbar
        provider={transcription.selectedProvider}
        onSelectProvider={transcription.setSelectedProvider}
        onOpenSettings={() => transcription.setIsSettingsModalOpen(true)}
        onTranscribeAllPending={transcription.handleStartBatchQueue}
        pendingCount={transcription.pendingOcrCount}
        isBatchRunning={transcription.isBatchRunning}
        batchProgress={transcription.batchProgress}
        onPauseBatch={transcription.handlePauseBatchQueue}
        onResumeBatch={transcription.handleResumeBatchQueue}
        onRetryFailed={transcription.handleRetryFailedBatchQueue}
        hasWritingAreas={transcription.hasWritingAreas}
        pageCount={transcription.studentPagesWithIndices.length}
        pageStage={transcription.pageStage}
        isDryRun={transcription.isDryRun}
        isMathpixConfigured={transcription.isMathpixConfigured}
        qwenStatus={transcription.qwenStatus}
        hasMathpixOutput={Boolean(transcription.activeCandidate?.mathpixTranscript)}
        onRetryQwenVerify={() => transcription.executeRetryQwenVerification(activeStudentId)}
        isTranscribingActive={transcription.isTranscribingSingle}
      />

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
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    item.part === (activePageItem?.part ?? 1)
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Page {item.part} of {item.total}</span>
                  {item.page.isBlank && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-800">
                      Blank
                    </span>
                  )}
                  {item.part >= 3 && !item.page.isBlank && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">
                      Cont.
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activePageItem?.page.isBlank && (
            <div className="mb-2 p-2 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-500" />
              <span>Page {activePageItem.part} is marked blank and excluded from OCR & AI marking.</span>
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Direct Full-Text Marking</span>
                  <span className="text-xs font-normal text-slate-500">
                    ({activeStudent?.displayName})
                  </span>
                </h2>
                {/* Transcript Verification Stage Badge */}
                {isTranscriptVerified ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    已核對 (Verified) ✓
                  </span>
                ) : transcriptText.trim().length > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    未核對 (Unverified · Provisional)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    無謄本 (No Transcript)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {currentMarking.findings.length} findings • Original script line layout
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onVerifyTranscript?.(activeStudentId)}
                disabled={!transcriptText.trim()}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors shadow-2xs ${
                  isTranscriptVerified
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : !transcriptText.trim()
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title={
                  !transcriptText.trim()
                    ? '請先輸入或辨識謄本文字後再確認核對'
                    : isTranscriptVerified
                    ? '謄本已核對完成（點擊可再次確認）'
                    : '確認謄本內容無誤'
                }
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isTranscriptVerified ? '已確認核對 ✓' : '確認核對謄本'}</span>
              </button>

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

          {/* Transcription Notice Banner */}
          {transcription.notice && (
            <div
              className={`p-2.5 rounded-md text-xs mb-3 flex items-start gap-2 border animate-in fade-in duration-100 ${
                transcription.notice.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : transcription.notice.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : transcription.notice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{transcription.notice.text}</div>
              <button
                type="button"
                onClick={() => transcription.setNotice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Current Student OCR Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>
                  {transcription.selectedProvider === 'mathpix_only'
                    ? 'Mathpix OCR Only'
                    : 'Mathpix OCR + Qwen VL Verify'}
                  :
                </strong>{' '}
                {transcription.studentPagesWithIndices.length}{' '}
                {transcription.studentPagesWithIndices.length === 1 ? 'page' : 'pages'} to process.
                {transcription.isDryRun && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-300">
                    DRY RUN
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {transcription.activeCandidate?.ocrMode === 'mathpix_qwen_verify' &&
                transcription.activeCandidate?.qwenVerificationStatus === 'failed' && (
                  <button
                    type="button"
                    onClick={() => transcription.executeRetryQwenVerification(activeStudentId)}
                    disabled={transcription.isRetryingQwen || transcription.isTranscribingSingle || isBatchRunning}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-50 shadow-2xs"
                    title="Retry Qwen verification using stored Mathpix output without calling Mathpix again"
                  >
                    {transcription.isRetryingQwen ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                    ) : (
                      <RotateCcw className="w-3 h-3 text-amber-700" />
                    )}
                    <span>Retry Qwen Verify</span>
                  </button>
                )}

              {activePageItem && (
                <button
                  type="button"
                  onClick={() => transcription.executeRetrySinglePage(activeStudentId, activePageItem)}
                  disabled={transcription.isTranscribingSingle || isBatchRunning || !!transcription.perPageLoading[activePageItem.page.id]}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {transcription.perPageLoading[activePageItem.page.id] ? (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                  ) : (
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                  )}
                  <span>Retry Page {activePageItem.part}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => transcription.handleInitiateSingleEssayTranscribe(activeStudentId)}
                disabled={transcription.isTranscribingSingle || isBatchRunning || transcription.studentPagesWithIndices.length === 0}
                aria-label={`Start ${transcription.selectedProvider === 'local_qwen_vl' ? 'Qwen VL OCR' : transcription.selectedProvider === 'mathpix_only' ? 'Mathpix OCR' : 'Mathpix + Qwen'} (${transcription.studentPagesWithIndices.length}) - Transcribe This Essay`}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-2xs"
              >
                {transcription.isTranscribingSingle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {transcription.pageStage === 'vl_running'
                        ? (transcription.selectedProvider === 'local_qwen_vl' ? 'Running Qwen VL OCR...' : 'Verifying with Qwen VL...')
                        : 'Running Mathpix OCR...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Start {transcription.selectedProvider === 'local_qwen_vl' ? 'Qwen VL OCR' : transcription.selectedProvider === 'mathpix_only' ? 'Mathpix OCR' : 'Mathpix + Qwen'} (
                      {transcription.studentPagesWithIndices.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Staged Candidate Review Box */}
          {transcription.activeCandidate && (
            <div className="mb-3">
              <StagedCandidateBox
                candidate={transcription.activeCandidate}
                studentId={activeStudentId}
                isStale={transcription.isCandidateStale}
                staleReason={transcription.activeCandidateStaleReason || transcription.activeCandidate.staleReason}
                onApply={() => transcription.handleRequestApplyCandidate(activeStudentId)}
                onDiscard={() => transcription.handleDiscardCandidate(activeStudentId)}
                onRetryPage={(scanPageId, part) => {
                  const item = transcription.studentPagesWithIndices.find(
                    (p) => p.page.id === scanPageId || p.part === part
                  );
                  if (item) {
                    transcription.executeRetrySinglePage(activeStudentId, item);
                  }
                }}
                onRetryQwenVerify={() => transcription.executeRetryQwenVerification(activeStudentId)}
                isRetryingQwen={transcription.isRetryingQwen}
                perPageLoading={transcription.perPageLoading}
                assignmentId={assignment?.id || 'default'}
              />
            </div>
          )}

          {/* AI Marking Status & Action Alert */}
          {(() => {
            const isEntireScriptBlank =
              currentTranscript.isEntireScriptBlank ||
              (studentPagesWithIndices.length > 0 &&
                studentPagesWithIndices.every((item) => item.page.isBlank));

            if (isEntireScriptBlank) {
              return (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <strong className="font-semibold text-slate-800">Entire script confirmed blank:</strong>{' '}
                      OCR and ordinary AI marking are skipped for this student. You can enter teacher feedback or approve directly.
                    </div>
                  </div>
                </div>
              );
            }

            const currentFreshness = freshnessMap?.[activeStudentId] ?? (
              isAiMarkingLoading
                ? 'running'
                : aiMarkingError
                ? 'failed'
                : currentMarking.findings.length > 0
                ? 'up_to_date'
                : 'initial_pending'
            );

            const reqCount = currentMarking.findings.filter((f) => (f.feedbackType || 'correction') === 'correction').length;
            const impCount = currentMarking.findings.filter((f) => f.feedbackType === 'improvement').length;
            const claCount = currentMarking.findings.filter((f) => f.feedbackType === 'clarity').length;

            if (currentFreshness === 'running' || currentFreshness === 'queued') {
              return (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-center justify-between mb-3 animate-pulse">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                    <div>
                      <strong className="font-semibold">
                        {currentFreshness === 'running' ? 'AI Marking in progress (running in background):' : 'AI Marking queued in background:'}
                      </strong>{' '}
                      {markingModelHealth?.modelId || 'Local LLM'} is evaluating the transcript on port {markingModelHealth?.port || 18086}...
                    </div>
                  </div>
                </div>
              );
            }

            if (currentFreshness === 'needs_refresh') {
              return (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold">OCR changed · AI marking needs refresh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onRunAiMarking && (
                      <button
                        type="button"
                        onClick={() => onRunAiMarking(activeStudentId)}
                        disabled={isBatchRunning}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                        <span>Re-run AI Marking for this student</span>
                      </button>
                    )}
                    {onRerunAiMarkingAndGoNext && (
                      <button
                        type="button"
                        onClick={() => onRerunAiMarkingAndGoNext(activeStudentId)}
                        disabled={isBatchRunning}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors shadow-2xs"
                      >
                        <span>Re-run AI Marking and go to next student</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (currentFreshness === 'failed') {
              return (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 flex items-center justify-between mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">AI Marking failed:</strong> {aiMarkingError || 'Marking error'}
                    </div>
                  </div>
                  {onRunAiMarking && (
                    <button
                      type="button"
                      onClick={() => onRunAiMarking(activeStudentId)}
                      disabled={isBatchRunning}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 rounded hover:bg-rose-50 transition-colors shrink-0 ml-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              );
            }

            // Distinguish the 4 states for AI Marking readiness:
            const hasTranscriptText = transcriptText.trim().length > 0;
            const hasStagedCandidate = Boolean(transcription.activeCandidate?.transcript?.trim());

            if (!hasTranscriptText) {
              if (hasStagedCandidate) {
                return (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-900 flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <strong className="font-semibold text-purple-800">OCR 候選文字已就緒 (Staged OCR):</strong> 請檢視上方候選文字並點擊「套用至謄本」，再進行 AI 評分。
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-400 bg-purple-50 border border-purple-200 rounded cursor-not-allowed opacity-60"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run AI Marking</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-600 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <strong className="font-semibold text-slate-700">尚未辨識或輸入謄本 (No transcript):</strong> 請先執行上方 OCR 辨識或手動輸入作文謄本後再進行評分。
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed opacity-60"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run AI Marking</span>
                  </button>
                </div>
              );
            }

            // Has transcript text, but unverified -> Allow provisional marking!
            if (!isTranscriptVerified) {
              if (currentFreshness === 'initial_pending' || currentMarking.findings.length === 0) {
                return (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <strong className="font-semibold text-amber-800">臨時 AI 評分 (Provisional AI Marking):</strong> 謄本尚未核對。可先執行臨時初步評分，核對謄本後評分將更精確。
                      </div>
                    </div>
                    {onRunAiMarking && (
                      <button
                        type="button"
                        onClick={() => onRunAiMarking(activeStudentId)}
                        disabled={isAiMarkingLoading || isBatchRunning}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Run AI Marking (Provisional)</span>
                      </button>
                    )}
                  </div>
                );
              }

              // Up to date (provisional)
              return (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">AI Marking up to date [Provisional / 臨時評分]</strong>
                      <span className="text-amber-800 text-[11px] block mt-0.5">
                        {reqCount} required corrections • {impCount} improvements • {claCount} clarity suggestions available (基於未核對謄本).
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onRunAiMarking && (
                      <button
                        type="button"
                        onClick={() => onRunAiMarking(activeStudentId)}
                        disabled={isAiMarkingLoading || isBatchRunning}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50 whitespace-normal"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Re-run AI Marking (Provisional)</span>
                      </button>
                    )}
                    {onRerunAiMarkingAndGoNext && (
                      <button
                        type="button"
                        onClick={() => onRerunAiMarkingAndGoNext(activeStudentId)}
                        disabled={isAiMarkingLoading || isBatchRunning}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 whitespace-normal"
                      >
                        <span>Re-run AI Marking and go to next student</span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Has transcript text and is verified!
            if (currentFreshness === 'initial_pending') {
              return (
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <strong className="font-semibold">Preliminary AI Marking:</strong> Ready to evaluate student script.
                    </div>
                  </div>
                  {onRunAiMarking && (
                    <button
                      type="button"
                      onClick={() => onRunAiMarking(activeStudentId)}
                      disabled={isBatchRunning}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Run AI Marking</span>
                    </button>
                  )}
                </div>
              );
            }

            // Up to date
            return (
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-md text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">AI Marking up to date</strong>
                    <span className="text-emerald-800 text-[11px] block mt-0.5">
                      {reqCount} required corrections • {impCount} improvements • {claCount} clarity suggestions available.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onRunAiMarking && (
                    <button
                      type="button"
                      onClick={() => onRunAiMarking(activeStudentId)}
                      disabled={isAiMarkingLoading || isBatchRunning}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50 whitespace-normal"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Re-run AI Marking</span>
                    </button>
                  )}
                  {onRerunAiMarkingAndGoNext && (
                    <button
                      type="button"
                      onClick={() => onRerunAiMarkingAndGoNext(activeStudentId)}
                      disabled={isAiMarkingLoading || isBatchRunning}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 whitespace-normal"
                    >
                      <span>Re-run AI Marking and go to next student</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Persistent instruction near transcript */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-md text-xs text-slate-700 mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <MousePointer className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-800">Left-click: correct OCR · Right-click: add marking</span>
              <span className="text-slate-400 hidden sm:inline">（左鍵：修正 OCR · 右鍵：新增批改）</span>
            </div>
            {selectedText && (
              <div className="flex items-center gap-2 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                <span className="truncate max-w-[180px]">已選取：「<strong>{selectedText}</strong>」</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-slate-400 hover:text-slate-600"
                  title="取消選取"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Non-blocking OCR review notices banner */}
          {currentTranscript.reviewNotices && currentTranscript.reviewNotices.length > 0 && (
            <div className="mb-2 p-2.5 bg-amber-50/90 border border-amber-200/90 rounded-md text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center justify-between font-medium">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-amber-900">
                    OCR Review Notices ({currentTranscript.reviewNotices.length}):
                  </span>
                  <span className="text-amber-800">Non-blocking notices. Text is preserved in the transcript; click to edit.</span>
                </div>
              </div>
              <div className="mt-1.5 space-y-1">
                {currentTranscript.reviewNotices.map((notice) => (
                  <div key={notice.id} className="flex items-start gap-1.5 pl-5 text-[11px] text-amber-900">
                    <span className="font-mono text-amber-700 font-semibold shrink-0">
                      {notice.lineNumber ? `[Line ${notice.lineNumber}]` : '•'}
                    </span>
                    <span>
                      <strong className="font-semibold">{notice.matchedText}</strong> — {notice.message}
                    </span>
                  </div>
                ))}
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
              onWordClick={handleWordClick}
              onWordContextMenu={handleWordContextMenu}
              onCanvasContextMenu={handleCanvasContextMenu}
              onTranscriptTextEdit={handleTranscriptTextEdit}
              revision={currentTranscript.revision ?? 0}
              onSaveWholeTranscript={handleSaveWholeTranscript}
              onSelectionContextMenu={handleSelectionContextMenu}
              onFindingContextMenu={handleFindingContextMenu}
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
                {/* Staged AI Proposal Banner (Protects Teacher Overrides) */}
                {currentMarking.stagedAiProposal && (
                  <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/80 text-xs text-indigo-950 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>新 AI 批改建議已就緒（現有教師修改已安全保留）</span>
                      </div>
                      <span className="text-[11px] text-indigo-700 font-semibold px-2 py-0.5 rounded bg-indigo-100/80 border border-indigo-200">
                        AI 建議總分: {currentMarking.stagedAiProposal.totalScore}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      系統偵測到您已編輯過此學生的評分或評語。新執行的 AI 結果已暫存，未覆蓋您的手動修改。您可以選擇檢視並套用分數、評語或新標註。
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsReviewProposalModalOpen(true)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs"
                      >
                        檢視並選擇套用
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissStagedAiProposal?.(activeStudentId)}
                        className="px-2.5 py-1 bg-white text-indigo-700 border border-indigo-300 rounded text-xs font-medium hover:bg-indigo-100 transition-colors"
                      >
                        略過此建議
                      </button>
                    </div>
                  </div>
                )}

                {/* Rubric Dimension Score Inputs & Total Badge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-slate-700">Rubric Dimensions &amp; Scores</h4>
                      {currentMarking.scoresSource && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            currentMarking.scoresSource === 'teacher'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {currentMarking.scoresSource === 'teacher' ? '教師評分' : 'AI 評分'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                      <span className="text-slate-500 font-medium">Total:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {hasScores ? `${totalScore} / ${maxPossibleScore}` : `— / ${maxPossibleScore}`}
                      </span>
                    </div>
                  </div>
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

                {/* Structured Assessment Comments (Positive, Relevant, Next Step) */}
                {currentMarking.assessmentComments && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-700">Structured Pedagogical Feedback</h4>
                      {currentMarking.commentsSource && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {currentMarking.commentsSource === 'teacher' ? '教師編輯評語' : 'AI 生成評語'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded bg-emerald-50/60 border border-emerald-200/80 text-xs">
                        <div className="font-bold text-emerald-800 text-[11px] mb-1 flex items-center gap-1">
                          <span>★</span>
                          <span>優點與亮點 (Positive)</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                          {currentMarking.assessmentComments.positive || '（暫無優點評語）'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded bg-amber-50/60 border border-amber-200/80 text-xs">
                        <div className="font-bold text-amber-800 text-[11px] mb-1 flex items-center gap-1">
                          <span>✎</span>
                          <span>改進建議 (Relevant)</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                          {currentMarking.assessmentComments.relevant || '（暫無改進建議）'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded bg-blue-50/60 border border-blue-200/80 text-xs">
                        <div className="font-bold text-blue-800 text-[11px] mb-1 flex items-center gap-1">
                          <span>➜</span>
                          <span>下一步行動 (Next Step)</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                          {currentMarking.assessmentComments.finalNextStep || '（暫無下一步行動）'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Composite / Overall Feedback Commentary */}
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
              const studentFreshness = freshnessMap?.[student.id];
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
                        : studentFreshness === 'running'
                        ? 'text-blue-600 font-medium'
                        : studentFreshness === 'queued'
                        ? 'text-blue-600'
                        : studentFreshness === 'needs_refresh'
                        ? 'text-amber-600 font-semibold'
                        : studentFreshness === 'failed'
                        ? 'text-rose-600 font-semibold'
                        : studentFreshness === 'initial_pending'
                        ? 'text-slate-400'
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
                      : studentFreshness === 'running'
                      ? 'Evaluating...'
                      : studentFreshness === 'queued'
                      ? 'Queued'
                      : studentFreshness === 'needs_refresh'
                      ? 'Needs refresh'
                      : studentFreshness === 'failed'
                      ? 'Marking failed'
                      : studentFreshness === 'initial_pending'
                      ? 'Initial pending'
                      : reqCount > 0
                      ? `${reqCount} corr${refCount > 0 ? ` · ${refCount} opt` : ''}`
                      : refCount > 0
                      ? `${refCount} opt suggestions`
                      : marking?.feedbackComment
                      ? 'Draft review'
                      : 'Ready for review'}
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
                onClick={handleCloseAddFindingModal}
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
                  onClick={handleCloseAddFindingModal}
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
              {correctOcrWordText && (
                <div className="p-2 bg-purple-50 text-purple-900 border border-purple-200 rounded font-medium text-xs">
                  點擊單詞 (Target word)：<strong className="font-serif text-purple-950 font-bold">"{correctOcrWordText}"</strong>
                </div>
              )}
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

      {/* Staged AI Proposal Review & Selective Application Modal */}
      {isReviewProposalModalOpen && currentMarking.stagedAiProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  檢視並選擇套用 AI 批改建議
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewProposalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                系統偵測到您已編輯過此學生的評分或評語。重新執行的 AI 結果已妥善暫存，未覆蓋任何手動修改。請檢視下列新舊比對，並勾選欲套用的項目：
              </p>

              {/* Side-by-Side Scores Comparison */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span>評分比對</span>
                  <span className="text-[11px] text-slate-500">滿分: {maxPossibleScore} 分</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded bg-white border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">
                      現有評分 ({currentMarking.scoresSource === 'teacher' ? '教師自訂' : '目前評分'})
                    </span>
                    <div className="text-lg font-bold text-slate-800 mb-1">
                      {hasScores ? `${totalScore} 分` : '未評分'}
                    </div>
                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      {rubric.map((dim) => (
                        <div key={dim.id} className="flex justify-between">
                          <span>{dim.name}:</span>
                          <span className="font-medium">
                            {currentMarking.scores[dim.id] ?? '—'} / {dim.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-indigo-50/80 border border-indigo-200">
                    <span className="font-semibold text-indigo-900 block mb-1">
                      AI 建議新評分
                    </span>
                    <div className="text-lg font-bold text-indigo-700 mb-1">
                      {currentMarking.stagedAiProposal.totalScore} 分
                    </div>
                    <div className="space-y-0.5 text-[11px] text-indigo-800">
                      {rubric.map((dim) => (
                        <div key={dim.id} className="flex justify-between">
                          <span>{dim.name}:</span>
                          <span className="font-semibold">
                            {currentMarking.stagedAiProposal?.scores[dim.id] ?? 0} / {dim.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments Comparison */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
                <span className="font-bold text-slate-700 block">評語比對</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded bg-white border border-slate-200 text-[11px]">
                    <span className="font-semibold text-slate-700 block mb-1">現有評語</span>
                    <p className="text-slate-600 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                      {currentMarking.feedbackComment || '（暫無評語）'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded bg-indigo-50/80 border border-indigo-200 text-[11px]">
                    <span className="font-semibold text-indigo-900 block mb-1">AI 結構化新評語</span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto text-indigo-900">
                      <div>
                        <span className="font-bold text-[10px] text-indigo-700 block">優點與亮點：</span>
                        <p>{currentMarking.stagedAiProposal.assessmentComments.positive || '—'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-[10px] text-indigo-700 block">改進建議：</span>
                        <p>{currentMarking.stagedAiProposal.assessmentComments.relevant || '—'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-[10px] text-indigo-700 block">下一步行動：</span>
                        <p>{currentMarking.stagedAiProposal.assessmentComments.finalNextStep || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selection Checkboxes */}
              <div className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/30 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">請勾選要套用至學生的項目：</span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={applyProposalScores}
                      onChange={(e) => setApplyProposalScores(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>套用 AI 建議分數 (總分: {currentMarking.stagedAiProposal.totalScore} / {maxPossibleScore})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={applyProposalComments}
                      onChange={(e) => setApplyProposalComments(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>套用 AI 結構化評語 (優點、改進建議與下一步行動)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={applyProposalFindings}
                      onChange={(e) => setApplyProposalFindings(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>套用 AI 標註建議 ({currentMarking.stagedAiProposal.findings.length} 項，保留教師手動標註)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsReviewProposalModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md font-semibold text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!applyProposalScores && !applyProposalComments && !applyProposalFindings}
                onClick={() => {
                  onAcceptStagedAiProposal?.(activeStudentId, {
                    applyScores: applyProposalScores,
                    applyComments: applyProposalComments,
                    applyFindings: applyProposalFindings,
                  });
                  setIsReviewProposalModalOpen(false);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md font-semibold text-xs shadow-2xs transition-colors"
              >
                確認套用所選項目
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Transcription Settings Modal */}
      {transcription.isSettingsModalOpen && (
        <TranscriptionSettingsModal
          isOpen={transcription.isSettingsModalOpen}
          onClose={() => transcription.setIsSettingsModalOpen(false)}
          settings={transcription.currentSettings}
          onSave={(newSettings) => {
            onUpdateAssignmentSettings?.(newSettings);
            transcription.setIsSettingsModalOpen(false);
          }}
        />
      )}

      {/* Transcription Confirmation Dialog */}
      {transcription.confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-800">
              {transcription.confirmDialog.type === 'apply_candidate_overwrite'
                ? '覆蓋現有謄本內容 (Overwrite Transcript)'
                : transcription.confirmDialog.type === 'qwen_unavailable_choice'
                ? 'Qwen VL (18088) 離線提示'
                : '重新執行 OCR (Re-run OCR)'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {transcription.confirmDialog.type === 'apply_candidate_overwrite'
                ? '套用此候選謄本將覆蓋目前編輯器內的文字。已核對的狀態將被撤銷以供重新檢視。確定要繼續嗎？'
                : transcription.confirmDialog.type === 'qwen_unavailable_choice'
                ? 'Qwen VL (Port 18088) 目前無法連線。是否要改以「Mathpix OCR Only」模式直接進行辨識？'
                : '重新執行 OCR 將產生新的候選謄本。現有編輯器內的文字不會被自動覆蓋，除非您明確點擊「套用至謄本」。'}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => transcription.setConfirmDialog(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const dlg = transcription.confirmDialog;
                  transcription.setConfirmDialog(null);
                  if (!dlg) return;
                  if (dlg.type === 'apply_candidate_overwrite') {
                    transcription.applyCandidateToEditor(dlg.targetStudentId, dlg.candidateText, dlg.linesWithBboxes);
                  } else if (dlg.type === 'qwen_unavailable_choice') {
                    transcription.executeSingleEssayTranscription(dlg.targetStudentId, 'mathpix_only');
                  } else if (dlg.type === 'pre_flight_transcribe') {
                    transcription.executeSingleEssayTranscription(dlg.targetStudentId);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs"
              >
                確定執行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finding context menu: Correct OCR source text */}
      {contextMenu && contextMenu.kind === 'finding' && (
        <div className="fixed inset-0 z-[99990]" onMouseDown={() => setContextMenu(null)}>
          <div
            className="absolute w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs text-slate-700"
            style={{
              left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 250),
              top: contextMenu.y,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
              onClick={() => {
                openCorrectionEditorForSelection();
              }}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Correct OCR source text
            </button>
          </div>
        </div>
      )}

      {/* Selected OCR source correction editor */}
      {correctionEditor && (
        <div className="fixed inset-0 z-[99995] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Correct OCR source text</h3>
              <button type="button" onClick={() => setCorrectionEditor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              className="w-full min-h-[120px] p-2 border border-slate-200 rounded-md text-sm font-serif focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setCorrectionEditor(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySelectedCorrection}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Apply correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
