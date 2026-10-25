import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MarkingFinding, FindingDecision, FindingFeedbackType } from '../types';
import {
  alignTranscriptWithFindings,
  AlignedFindingToken,
  AlignedTextToken,
  validateFindingQuoteAndRange,
} from '../utils/markingTextAlignment';
import {
  Check,
  X,
  Edit2,
  Edit3,
  Trash2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Eye,
  EyeOff,
  Crosshair,
} from 'lucide-react';

export interface SelectedWordTarget {
  lineIndex: number;
  wordIndex: number;
  text: string;
  bbox?: [number, number, number, number];
}

interface InlineMarkingViewProps {
  transcript: string;
  findings: MarkingFinding[];
  studentId: string;
  studentName?: string;
  selectedLineIndex?: number | null;
  selectedWordTarget?: SelectedWordTarget | null;
  selectedText?: string;
  selectedOccurrenceIndex?: number | null;
  onSelectLine?: (lineIndex: number | null) => void;
  onSelectWord?: (target: SelectedWordTarget | null) => void;
  onTextSelection?: (
    selectedText: string,
    lineIndex: number,
    occurrenceIndex?: number,
    exactRange?: { startOffset: number; endOffset: number }
  ) => void;
  onFindingDecision: (
    studentId: string,
    findingId: string,
    decision: FindingDecision,
    customText?: string
  ) => void;
  onDeleteFinding: (studentId: string, findingId: string) => void;
  onEditFinding?: (
    studentId: string,
    findingId: string,
    updatedFinding: Partial<MarkingFinding>
  ) => void;
  onUpdateFindings?: (studentId: string, findings: MarkingFinding[]) => void;
  onWordClick?: (target: { lineIndex: number; wordIndex: number; text: string }) => void;
  onWordContextMenu?: (
    target: { lineIndex: number; wordIndex: number; text: string; startOffset?: number; endOffset?: number },
    e: React.MouseEvent
  ) => void;
  onCanvasContextMenu?: (e: React.MouseEvent) => void;
  revision?: number;
  onSaveWholeTranscript?: (newText: string, baseRevision?: number) => void;
  onTranscriptTextEdit?: (lineIndex: number, newLineText: string) => void;
  onSelectionContextMenu?: (
    payload: {
      sourceText: string;
      startLine: number;
      startOffset: number;
      endLine: number;
      endOffset: number;
      involvedFindingIds: string[];
    },
    e: React.MouseEvent
  ) => void;
  onFindingContextMenu?: (findingId: string, e: React.MouseEvent) => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

interface ActionPopoverPosition {
  top: number;
  left: number;
}

export const InlineMarkingView: React.FC<InlineMarkingViewProps> = ({
  transcript,
  findings,
  studentId,
  studentName = 'Student',
  revision,
  selectedLineIndex,
  selectedWordTarget,
  selectedText,
  selectedOccurrenceIndex,
  onSelectLine,
  onSelectWord,
  onTextSelection,
  onFindingDecision,
  onDeleteFinding,
  onEditFinding,
  onUpdateFindings,
  onWordClick,
  onWordContextMenu,
  onCanvasContextMenu,
  onSaveWholeTranscript,
  onTranscriptTextEdit,
  onSelectionContextMenu,
  onFindingContextMenu,
}) => {
  const [showRejected, setShowRejected] = useState(false);
  const [isUnmatchedOpen, setIsUnmatchedOpen] = useState(true);

  // Mouse drag tracking refs to distinguish click from drag-selection
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastSelectionRangeRef = useRef<{
    startLine: number;
    startOffset: number;
    endLine: number;
    endOffset: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedText) {
      lastSelectionRangeRef.current = null;
    }
  }, [selectedText]);

  // Hover Tooltip state
  const [hoveredFinding, setHoveredFinding] = useState<MarkingFinding | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Click Action Popover state
  const [activeActionFinding, setActiveActionFinding] = useState<MarkingFinding | null>(null);
  const [actionPos, setActionPos] = useState<ActionPopoverPosition | null>(null);
  const [isEditingInPopover, setIsEditingInPopover] = useState(false);
  const [isReselectingRange, setIsReselectingRange] = useState(false);
  const [editQuote, setEditQuote] = useState('');
  const [editSuggestion, setEditSuggestion] = useState('');
  const [editFeedbackType, setEditFeedbackType] = useState<FindingFeedbackType>('correction');
  const [editCategory, setEditCategory] = useState('Grammar');
  const [editExplanation, setEditExplanation] = useState('');
  const [editLineIndex, setEditLineIndex] = useState<number | undefined>(undefined);
  const [editOccIndex, setEditOccIndex] = useState<number | undefined>(undefined);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  // Align transcript text with findings
  const { alignedLines, unmatchedFindings } = alignTranscriptWithFindings(
    transcript,
    findings
  );

  const rejectedCount = findings.filter((f) => f.decision === 'rejected').length;
  const needsReviewFindings = findings.filter((f) => f.decision === 'needs_review' || f.anchorReview);

  // Scroll to selected line or word when selected from scan or externally
  useEffect(() => {
    const targetLine = selectedWordTarget?.lineIndex ?? selectedLineIndex;
    if (targetLine !== null && targetLine !== undefined) {
      const el = document.getElementById(`inline-line-${targetLine}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedLineIndex, selectedWordTarget]);

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button === 0) {
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (dragStartPosRef.current && (e.buttons === 1 || e.buttons === 3)) {
      const dist = Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y);
      if (dist > 3) {
        isDraggingRef.current = true;
      }
    }
  };

  // Handle mouseup for text selection inside middle column
  const handleMouseUpCanvas = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text) {
        isDraggingRef.current = true;
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 120);
        let node: Node | null = selection.anchorNode;
        let lineEl: HTMLElement | null = null;
        while (node && !lineEl) {
          if (node instanceof HTMLElement && node.getAttribute('data-line-index') !== null) {
            lineEl = node;
          } else {
            node = node.parentNode;
          }
        }
        if (lineEl) {
          const lineIdx = parseInt(lineEl.getAttribute('data-line-index') || '0', 10);

          // Calculate character offset of selection start relative to this line's tokens
          const tokensEl = lineEl.querySelector('[data-line-tokens]');
          let charOffsetInLine = 0;
          if (tokensEl && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            try {
              const preRange = range.cloneRange();
              preRange.selectNodeContents(tokensEl);
              preRange.setEnd(range.startContainer, range.startOffset);
              charOffsetInLine = preRange.toString().length;
            } catch {
              charOffsetInLine = 0;
            }
          }

          // Determine occurrence index in the line text
          const targetLine = alignedLines.find((l) => l.lineIndex === lineIdx);
          const rawLineText = targetLine?.rawText || '';
          let occIdx = 0;
          if (rawLineText) {
            const occurrences: number[] = [];
            let pos = 0;
            while ((pos = rawLineText.indexOf(text, pos)) !== -1) {
              occurrences.push(pos);
              pos += 1;
            }
            if (occurrences.length > 1) {
              let minDiff = Infinity;
              occurrences.forEach((o, i) => {
                const diff = Math.abs(o - charOffsetInLine);
                if (diff < minDiff) {
                  minDiff = diff;
                  occIdx = i;
                }
              });
            }
            if (isReselectingRange) {
              setEditQuote(text);
              setEditLineIndex(lineIdx);
              setEditOccIndex(occIdx);
              setEditValidationError(null);
              setIsReselectingRange(false);
              selection.removeAllRanges();
              return;
            }

            let startOffset = charOffsetInLine;
            let endOffset = charOffsetInLine + text.length;
            if (occurrences.length > 0 && typeof occurrences[occIdx] === 'number') {
              startOffset = occurrences[occIdx];
              endOffset = startOffset + text.length;
            }
            lastSelectionRangeRef.current = { startLine: lineIdx, startOffset, endLine: lineIdx, endOffset };
            onTextSelection?.(text, lineIdx, occIdx, { startOffset, endOffset });
          }
        }
      }
    } else {
      lastSelectionRangeRef.current = null;
    }
  };

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Reset active popover and tooltip when student changes
  useEffect(() => {
    setActiveActionFinding(null);
    setHoveredFinding(null);
    setTooltipPos(null);
    setActionPos(null);
  }, [studentId]);

  const handleMouseEnterMarking = (finding: MarkingFinding, e: React.MouseEvent<HTMLElement>) => {
    if (activeActionFinding) return; // Don't show hover tooltip if action popover is open
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipHeight = 110;
    const tooltipWidth = 280;

    let placement: 'top' | 'bottom' = 'top';
    let top = rect.top - tooltipHeight - 8;

    if (top < 10) {
      placement = 'bottom';
      top = rect.bottom + 8;
    }

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Keep within viewport boundaries
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }

    setTooltipPos({ top, left, placement });
    setHoveredFinding(finding);
  };

  const handleMouseLeaveMarking = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredFinding(null);
      setTooltipPos(null);
    }, 120);
  };

  const handleTooltipMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
    handleMouseLeaveMarking();
  };

  const handleFocusMarking = (finding: MarkingFinding, e: React.FocusEvent<HTMLElement>) => {
    handleMouseEnterMarking(finding, e as unknown as React.MouseEvent<HTMLElement>);
  };

  const handleBlurMarking = () => {
    handleMouseLeaveMarking();
  };

  const handleClickMarking = (finding: MarkingFinding, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    // Hide hover tooltip
    setHoveredFinding(null);
    setTooltipPos(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 360;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 12) left = 12;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }

    let top = rect.bottom + 8;
    if (top + 340 > window.innerHeight && rect.top > 340) {
      top = rect.top - 340;
    }

    setActionPos({ top, left });
    setActiveActionFinding(finding);
    setIsEditingInPopover(false);
    setIsReselectingRange(false);
    setEditQuote(finding.originalText);
    setEditSuggestion(finding.teacherCustomText || finding.replacementText || '');
    setEditFeedbackType(finding.feedbackType || 'correction');
    setEditCategory(finding.type || 'Grammar');
    setEditExplanation(finding.explanation || '');
    setEditLineIndex(finding.lineIndex);
    setEditOccIndex(finding.occurrenceIndex);
    setEditValidationError(null);
  };

  const handleClosePopover = useCallback(() => {
    setActiveActionFinding(null);
    setActionPos(null);
    setIsEditingInPopover(false);
    setIsReselectingRange(false);
    setEditValidationError(null);
  }, []);

  const handleStartEdit = () => {
    if (!activeActionFinding) return;
    setIsEditingInPopover(true);
    setIsReselectingRange(false);
    setEditQuote(activeActionFinding.originalText);
    setEditSuggestion(activeActionFinding.teacherCustomText || activeActionFinding.replacementText || '');
    setEditFeedbackType(activeActionFinding.feedbackType || 'correction');
    setEditCategory(activeActionFinding.type || 'Grammar');
    setEditExplanation(activeActionFinding.explanation || '');
    setEditLineIndex(activeActionFinding.lineIndex);
    setEditOccIndex(activeActionFinding.occurrenceIndex);
    setEditValidationError(null);
  };

  const handleCancelEdit = () => {
    setIsEditingInPopover(false);
    setIsReselectingRange(false);
    setEditValidationError(null);
    if (activeActionFinding) {
      setEditQuote(activeActionFinding.originalText);
      setEditSuggestion(activeActionFinding.teacherCustomText || activeActionFinding.replacementText || '');
      setEditFeedbackType(activeActionFinding.feedbackType || 'correction');
      setEditCategory(activeActionFinding.type || 'Grammar');
      setEditExplanation(activeActionFinding.explanation || '');
      setEditLineIndex(activeActionFinding.lineIndex);
      setEditOccIndex(activeActionFinding.occurrenceIndex);
    }
  };

  const handleSelectWordForReselect = (
    lineIdx: number,
    wordText: string,
    approxCharOffset: number,
    rawLineText: string
  ) => {
    const clean = wordText.trim();
    if (!clean) return;

    const occurrences: number[] = [];
    let pos = 0;
    while ((pos = rawLineText.indexOf(clean, pos)) !== -1) {
      occurrences.push(pos);
      pos += 1;
    }

    let occIdx = 0;
    if (occurrences.length > 1) {
      let minDiff = Infinity;
      occurrences.forEach((o, i) => {
        const diff = Math.abs(o - approxCharOffset);
        if (diff < minDiff) {
          minDiff = diff;
          occIdx = i;
        }
      });
    }

    setEditQuote(clean);
    setEditLineIndex(lineIdx);
    setEditOccIndex(occIdx);
    setEditValidationError(null);
    setIsReselectingRange(false);
  };

  // Close popover on Escape or outside click (suppressed during reselection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePopover();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (isReselectingRange) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.marking-action-popover')) {
        handleClosePopover();
      }
    };

    if (activeActionFinding) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeActionFinding, isReselectingRange, handleClosePopover]);

  const handleAcceptFinding = (findingId: string) => {
    onFindingDecision(studentId, findingId, 'accepted');
    handleClosePopover();
  };

  const handleRejectFinding = (findingId: string) => {
    onFindingDecision(studentId, findingId, 'rejected');
    handleClosePopover();
  };

  const handleSaveEdit = () => {
    if (!activeActionFinding) return;

    const validation = validateFindingQuoteAndRange({
      quote: editQuote,
      lineIndex: editLineIndex,
      occurrenceIndex: editOccIndex,
      transcript,
      currentFindingId: activeActionFinding.id,
      existingFindings: findings,
    });

    if (!validation.valid) {
      setEditValidationError(validation.error || 'Invalid quote or source range.');
      return;
    }

    const updatedFinding: MarkingFinding = {
      ...activeActionFinding,
      originalText: editQuote.trim(),
      replacementText: editSuggestion.trim(),
      teacherCustomText: editSuggestion.trim(),
      feedbackType: editFeedbackType,
      type: editCategory,
      explanation: editExplanation.trim(),
      lineIndex: validation.lineIndex,
      paragraphIndex: validation.paragraphIndex,
      occurrenceIndex: validation.occurrenceIndex,
      decision: 'edited',
      source: 'teacher',
      isManual: true,
    };

    if (onEditFinding) {
      onEditFinding(studentId, activeActionFinding.id, updatedFinding);
    } else if (onUpdateFindings) {
      const nextFindings = findings.map((f) =>
        f.id === activeActionFinding.id ? updatedFinding : f
      );
      onUpdateFindings(studentId, nextFindings);
    } else {
      onFindingDecision(studentId, activeActionFinding.id, 'edited', editSuggestion.trim());
    }

    handleClosePopover();
  };

  const handleDelete = (findingId: string) => {
    onDeleteFinding(studentId, findingId);
    handleClosePopover();
  };

  // Whole-transcript controlled in-place editing state
  const [isEditingWhole, setIsEditingWhole] = useState(false);
  const [draftText, setDraftText] = useState('');
  const draftsByStudentRef = useRef<Record<string, { text: string; baseRevision: number }>>({});
  const wholeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync draft text on student switch: never lose an unsaved draft or apply to wrong student
  useEffect(() => {
    const existing = draftsByStudentRef.current[studentId];
    if (existing) {
      setDraftText(existing.text);
      setIsEditingWhole(true);
    } else {
      setIsEditingWhole(false);
      setDraftText('');
    }
  }, [studentId]);

  const startWholeEdit = () => {
    const initialText = transcript;
    setDraftText(initialText);
    draftsByStudentRef.current[studentId] = {
      text: initialText,
      baseRevision: revision ?? 0,
    };
    setIsEditingWhole(true);
  };

  const handleDraftChange = (newVal: string) => {
    setDraftText(newVal);
    if (draftsByStudentRef.current[studentId]) {
      draftsByStudentRef.current[studentId].text = newVal;
    }
  };

  const handleSaveWholeEdit = () => {
    const clean = draftText.replace(/\r\n/g, '\n');
    const oldClean = transcript.replace(/\r\n/g, '\n');
    const baseRev = draftsByStudentRef.current[studentId]?.baseRevision ?? revision ?? 0;
    delete draftsByStudentRef.current[studentId];
    setIsEditingWhole(false);
    if (clean !== oldClean) {
      if (onSaveWholeTranscript) {
        onSaveWholeTranscript(clean, baseRev);
      } else if (onTranscriptTextEdit) {
        onTranscriptTextEdit(0, clean);
      }
    }
  };

  const handleCancelWholeEdit = () => {
    delete draftsByStudentRef.current[studentId];
    setIsEditingWhole(false);
    setDraftText('');
  };

  useEffect(() => {
    if (isEditingWhole && wholeTextareaRef.current) {
      const el = wholeTextareaRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, [isEditingWhole]);

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('tense')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (cat.includes('spell')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (cat.includes('gramm')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (cat.includes('punct')) return 'bg-teal-100 text-teal-800 border-teal-200';
    if (cat.includes('capit')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (cat.includes('vocab')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="w-full flex flex-col">
      {/* Secondary Sub-Toolbar: Rejected toggle & Status summary */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 rounded-t-lg gap-2">
        {(() => {
          const activeFindings = findings.filter((f) => f.decision !== 'rejected');
          const correctionsCount = activeFindings.filter((f) => (f.feedbackType || 'correction') === 'correction').length;
          const improvementsCount = activeFindings.filter((f) => f.feedbackType === 'improvement').length;
          const clarityCount = activeFindings.filter((f) => f.feedbackType === 'clarity').length;

          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Inline Full-Text Marking:</span>
              <span className="text-slate-500">
                {alignedLines.filter((l) => !l.isEmpty).length} lines •{' '}
                <span className="text-rose-600 font-semibold">{correctionsCount} Required</span> •{' '}
                <span className="text-purple-600 font-semibold">{improvementsCount} Improvements</span> •{' '}
                <span className="text-sky-600 font-semibold">{clarityCount} Clarity</span>
              </span>
            </div>
          );
        })()}

        <div className="flex items-center gap-2">
          {!isEditingWhole && (
            <button
              type="button"
              onClick={startWholeEdit}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
              title="Edit full transcript in place (split/merge lines, correct text)"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit Transcript</span>
            </button>
          )}

          {rejectedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowRejected((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
              title={showRejected ? 'Hide rejected suggestions' : 'Show rejected suggestions for review/undo'}
            >
              {showRejected ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hide Rejected ({rejectedCount})</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Show Rejected ({rejectedCount})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isEditingWhole ? (
        <div className="p-4 md:p-6 bg-slate-50 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[420px] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between bg-blue-50/90 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 gap-2">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Editing full OCR transcript:</strong> Correct OCR text, insert or remove line breaks, and split/merge lines anywhere in the essay. Enter inserts a newline.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancelWholeEdit}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWholeEdit}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Save OCR changes
              </button>
            </div>
          </div>

          <textarea
            ref={wholeTextareaRef}
            value={draftText}
            onChange={(e) => handleDraftChange(e.target.value)}
            onContextMenu={(e) => e.stopPropagation()}
            className="w-full flex-1 min-h-[380px] p-4 text-slate-900 font-serif text-[15px] leading-relaxed bg-white border border-slate-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Full transcript text..."
            aria-label="Full OCR transcript editor"
          />
        </div>
      ) : (
        /* Main Inline Text Canvas */
        <div
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          onContextMenu={(e) => {
            const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
            if (sel && sel.length > 0 && lastSelectionRangeRef.current) {
              e.preventDefault();
              e.stopPropagation();
              onSelectionContextMenu?.(
                {
                  sourceText: sel,
                  startLine: lastSelectionRangeRef.current.startLine,
                  startOffset: lastSelectionRangeRef.current.startOffset,
                  endLine: lastSelectionRangeRef.current.endLine,
                  endOffset: lastSelectionRangeRef.current.endOffset,
                  involvedFindingIds: [],
                },
                e
              );
            } else if (onCanvasContextMenu) {
              onCanvasContextMenu(e);
            }
          }}
          className="p-4 md:p-6 bg-white overflow-y-auto max-h-[calc(100vh-270px)] min-h-[420px] select-text"
        >
          {alignedLines.length === 0 || (alignedLines.length === 1 && alignedLines[0].rawText.trim() === '') ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600">No transcript available for {studentName}.</p>
              <p className="text-slate-400 mt-1">Please run OCR or enter transcript text before marking.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {alignedLines.map((line) => {
                if (line.isEmpty) {
                  return (
                    <div
                      key={`line-empty-${line.lineIndex}`}
                      className="h-6 flex items-center select-none cursor-pointer hover:bg-slate-50/70 rounded"
                      onClick={startWholeEdit}
                      aria-hidden="true"
                    >
                      <span className="text-[10px] text-slate-300 font-mono w-7 text-right pr-2">
                        ·
                      </span>
                    </div>
                  );
                }

                const isSelectedLine = selectedLineIndex === line.lineIndex;

                return (
                  <div
                    key={`line-${line.lineIndex}`}
                    id={`inline-line-${line.lineIndex}`}
                    data-line-index={line.lineIndex}
                    onClick={() => {
                      if (isReselectingRange) return;
                      const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                      if (isDraggingRef.current || (sel && sel.length > 0)) {
                        return;
                      }
                      startWholeEdit();
                    }}
                    className={`relative flex items-start gap-2 py-2 px-2 rounded-md transition-all group/line cursor-pointer ${
                      isSelectedLine
                        ? 'ring-2 ring-purple-500 bg-purple-50/70 border border-purple-200 shadow-2xs'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Line Number Badge (anchored to original handwritten source line) */}
                    <span
                      className={`shrink-0 select-none font-mono text-[11px] font-semibold w-6 text-right pt-0.5 transition-colors ${
                        isSelectedLine
                          ? 'text-purple-700 font-bold'
                          : 'text-slate-400 group-hover/line:text-slate-600'
                      }`}
                      title={`Source Line ${line.lineIndex + 1}`}
                    >
                      {line.lineIndex + 1}
                    </span>

                    <div
                      data-line-tokens={line.lineIndex}
                      className="flex-1 flex flex-wrap items-end gap-y-1.5 text-slate-800 text-sm md:text-[15px] font-serif leading-relaxed"
                    >
                      {(() => {
                        let lineWordCounter = 0;
                        let runningCharOffset = 0;
                        return line.tokens.map((token, tokenIdx) => {
                          if (token.type === 'text') {
                            const parts = token.text.split(/(\s+)/);
                            return parts.map((part, partIdx) => {
                              if (!part) return null;
                              const partOffset = runningCharOffset;
                              runningCharOffset += part.length;

                              if (/^\s+$/.test(part)) {
                                return (
                                  <span
                                    key={`ws-${line.lineIndex}-${tokenIdx}-${partIdx}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                                      if (isDraggingRef.current || (sel && sel.length > 0)) {
                                        return;
                                      }
                                      startWholeEdit();
                                    }}
                                    className="whitespace-pre-wrap text-slate-800 cursor-pointer"
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              const currentWIdx = lineWordCounter++;
                              const cleanWord = part.trim();
                              const isThisWordSelected =
                                selectedWordTarget?.lineIndex === line.lineIndex &&
                                selectedWordTarget?.wordIndex === currentWIdx;

                              return (
                                <span
                                  key={`w-${line.lineIndex}-${tokenIdx}-${partIdx}-${currentWIdx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isReselectingRange) {
                                      handleSelectWordForReselect(line.lineIndex, cleanWord, partOffset, line.rawText);
                                      return;
                                    }
                                    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                                    if (isDraggingRef.current || (sel && sel.length > 0)) {
                                      return;
                                    }
                                    startWholeEdit();
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                                    if (sel && sel.length > 0 && lastSelectionRangeRef.current) {
                                      onSelectionContextMenu?.(
                                        {
                                          sourceText: sel,
                                          startLine: lastSelectionRangeRef.current.startLine,
                                          startOffset: lastSelectionRangeRef.current.startOffset,
                                          endLine: lastSelectionRangeRef.current.endLine,
                                          endOffset: lastSelectionRangeRef.current.endOffset,
                                          involvedFindingIds: [],
                                        },
                                        e
                                      );
                                    } else {
                                      onWordContextMenu?.(
                                        {
                                          lineIndex: line.lineIndex,
                                          wordIndex: currentWIdx,
                                          text: cleanWord,
                                          startOffset: partOffset,
                                          endOffset: partOffset + cleanWord.length,
                                        },
                                        e
                                      );
                                    }
                                  }}
                                  className={`whitespace-pre-wrap inline-block rounded transition-all cursor-pointer select-text ${
                                    isReselectingRange
                                      ? 'hover:bg-amber-100 hover:text-amber-900 cursor-crosshair ring-1 ring-amber-300'
                                      : isThisWordSelected
                                      ? 'bg-purple-200 text-purple-950 font-bold ring-2 ring-purple-600 px-1 -mx-0.5 shadow-xs z-20'
                                      : 'hover:bg-purple-100/70 hover:text-purple-900 px-0.5 -mx-0.5'
                                  }`}
                                  title={
                                    isReselectingRange
                                      ? `Click to select "${cleanWord}" for quote (L${line.lineIndex + 1})`
                                      : `L${line.lineIndex + 1} W${currentWIdx + 1}: ${cleanWord} · Left-click: edit line · Right-click: add marking / correct OCR`
                                  }
                                >
                                  {part}
                                </span>
                              );
                            });
                          }

                        // Finding Token
                        const findingToken = token as AlignedFindingToken;
                        const { finding, originalText, replacementText, isRejected, isAccepted, isEdited } =
                          findingToken;
                        const tokenOffset = runningCharOffset;
                        runningCharOffset += originalText.length;
                        const currentWIdx = lineWordCounter++;
                        const isFindingWordSelected =
                          selectedWordTarget?.lineIndex === line.lineIndex &&
                          selectedWordTarget?.wordIndex === currentWIdx;

                        const feedbackType = finding.feedbackType || 'correction';
                        const isCorrection = feedbackType === 'correction';
                        const isImprovement = feedbackType === 'improvement';
                        const isClarity = feedbackType === 'clarity';

                        // Format displayed suggestion text
                        let formattedSuggestion = replacementText;
                        if (!isCorrection) {
                          const cleanRepl = (replacementText || (isClarity ? 'Clarification needed' : '')).trim();
                          formattedSuggestion = cleanRepl.startsWith('(') && cleanRepl.endsWith(')')
                            ? cleanRepl
                            : `(${cleanRepl})`;
                        } else if (!formattedSuggestion) {
                          formattedSuggestion = '(delete)';
                        }

                        // If rejected and showRejected is off, display as normal text without red/green markings
                        if (isRejected && !showRejected) {
                          return (
                            <span
                              key={`fnd-rej-${finding.id}-${tokenIdx}-${currentWIdx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isReselectingRange) {
                                  handleSelectWordForReselect(line.lineIndex, originalText, tokenOffset, line.rawText);
                                  return;
                                }
                                const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                                if (isDraggingRef.current || (sel && sel.length > 0)) {
                                  isDraggingRef.current = false;
                                  return;
                                }
                                isDraggingRef.current = false;
                                onSelectWord?.({
                                  lineIndex: line.lineIndex,
                                  wordIndex: currentWIdx,
                                  text: originalText,
                                });
                                onWordClick?.({
                                  lineIndex: line.lineIndex,
                                  wordIndex: currentWIdx,
                                  text: originalText,
                                });
                                startWholeEdit();
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                                if (sel && sel.length > 0 && lastSelectionRangeRef.current) {
                                  onSelectionContextMenu?.(
                                    {
                                      sourceText: sel,
                                      startLine: lastSelectionRangeRef.current.startLine,
                                      startOffset: lastSelectionRangeRef.current.startOffset,
                                      endLine: lastSelectionRangeRef.current.endLine,
                                      endOffset: lastSelectionRangeRef.current.endOffset,
                                      involvedFindingIds: [],
                                    },
                                    e
                                  );
                                } else {
                                  onWordContextMenu?.(
                                    {
                                      lineIndex: line.lineIndex,
                                      wordIndex: currentWIdx,
                                      text: originalText,
                                      startOffset: tokenOffset,
                                      endOffset: tokenOffset + originalText.length,
                                    },
                                    e
                                  );
                                }
                              }}
                              className={`whitespace-pre-wrap text-slate-800 inline-block rounded transition-all cursor-pointer ${
                                isReselectingRange
                                  ? 'hover:bg-amber-100 hover:text-amber-900 cursor-crosshair ring-1 ring-amber-300'
                                  : isFindingWordSelected
                                  ? 'bg-purple-200 text-purple-950 font-bold ring-2 ring-purple-600 px-1 -mx-0.5 shadow-xs z-20'
                                  : 'hover:bg-purple-100/70 hover:text-purple-900 px-0.5 -mx-0.5'
                              }`}
                              title={
                                isReselectingRange
                                  ? `Click to select "${originalText}" for quote (L${line.lineIndex + 1})`
                                  : `L${line.lineIndex + 1} W${currentWIdx + 1}: ${originalText} · Left-click: edit line · Right-click: add marking / correct OCR`
                              }
                            >
                              {originalText}
                            </span>
                          );
                        }

                        // If rejected and showRejected is ON, show subtle dashed underline for undo
                        if (isRejected && showRejected) {
                          return (
                            <span
                              key={`fnd-rej-visible-${finding.id}-${tokenIdx}-${currentWIdx}`}
                              onClick={(e) => {
                                if (isReselectingRange) {
                                  e.stopPropagation();
                                  handleSelectWordForReselect(line.lineIndex, originalText, tokenOffset, line.rawText);
                                  return;
                                }
                                e.stopPropagation();
                                handleClickMarking(finding, e);
                                onSelectWord?.({
                                  lineIndex: line.lineIndex,
                                  wordIndex: currentWIdx,
                                  text: originalText,
                                });
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClickMarking(finding, e);
                              }}
                              className={`whitespace-pre-wrap text-slate-500 line-through decoration-slate-300 decoration-dashed cursor-pointer rounded px-0.5 transition-all ${
                                isReselectingRange
                                  ? 'hover:bg-amber-100 hover:text-amber-900 cursor-crosshair ring-1 ring-amber-300'
                                  : isFindingWordSelected
                                  ? 'ring-2 ring-purple-600 bg-purple-100 text-purple-950 font-bold shadow-xs z-20'
                                  : 'hover:bg-slate-100'
                              }`}
                              title={
                                isReselectingRange
                                  ? `Click to select "${originalText}" for quote (L${line.lineIndex + 1})`
                                  : `Rejected suggestion [L${line.lineIndex + 1} W${currentWIdx + 1}]`
                              }
                            >
                              {originalText}
                            </span>
                          );
                        }

                        return (
                          <span
                            key={`fnd-${finding.id}-${tokenIdx}-${currentWIdx}`}
                            data-finding-id={finding.id}
                            data-finding-original={originalText}
                            className={`inline-flex flex-col items-center justify-end align-bottom mx-1 group cursor-pointer transition-all ${
                              isReselectingRange
                                ? 'hover:bg-amber-100/80 cursor-crosshair ring-1 ring-amber-400 rounded'
                                : isFindingWordSelected
                                ? 'ring-2 ring-purple-600 bg-purple-100/80 rounded px-1 -mx-0.5 shadow-sm z-20'
                                : ''
                            }`}
                            onClick={(e) => {
                              if (isReselectingRange) {
                                e.stopPropagation();
                                handleSelectWordForReselect(line.lineIndex, originalText, tokenOffset, line.rawText);
                                return;
                              }
                              const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
                              if (isDraggingRef.current || (sel && sel.length > 0)) {
                                return;
                              }
                              e.stopPropagation();
                              handleClickMarking(finding, e);
                              onSelectWord?.(
                                isFindingWordSelected
                                  ? null
                                  : {
                                      lineIndex: line.lineIndex,
                                      wordIndex: currentWIdx,
                                      text: originalText,
                                    }
                              );
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onFindingContextMenu?.(finding.id, e);
                            }}
                            onMouseEnter={(e) => handleMouseEnterMarking(finding, e)}
                            onMouseLeave={handleMouseLeaveMarking}
                            onFocus={(e) => handleFocusMarking(finding, e)}
                            onBlur={handleBlurMarking}
                            tabIndex={0}
                            role="button"
                            aria-label={`${feedbackType}: ${originalText}, suggested: ${formattedSuggestion}`}
                          >
                            {/* Top: Suggested Correction / Improvement / Clarity in flow */}
                            <span className="mb-1 pointer-events-none select-none">
                              <span
                                className={`inline-block font-sans font-bold text-xs leading-none whitespace-nowrap px-1.5 py-0.5 rounded transition-all shadow-2xs ${
                                  isCorrection
                                    ? isAccepted
                                      ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                      : isEdited
                                      ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                                      : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 ring-1 ring-emerald-200'
                                    : isImprovement
                                    ? 'bg-purple-50 text-purple-700 group-hover:bg-purple-100 ring-1 ring-purple-200'
                                    : 'bg-sky-50 text-sky-700 group-hover:bg-sky-100 ring-1 ring-sky-200'
                                }`}
                              >
                                {formattedSuggestion}
                                {isAccepted && isCorrection && <span className="ml-0.5 text-[10px]">✓</span>}
                              </span>
                            </span>

                            {/* Bottom: Original Student Text on Text Baseline */}
                            <span
                              className={`inline font-serif text-sm md:text-[15px] font-medium leading-none px-0.5 rounded transition-colors ${
                                isCorrection
                                  ? isAccepted
                                    ? 'text-slate-400 line-through decoration-rose-400'
                                    : 'text-rose-600 line-through decoration-rose-500 font-semibold bg-rose-50/50 group-hover:bg-rose-100/60'
                                  : isImprovement
                                  ? 'text-slate-800 border-b-2 border-dotted border-purple-400 group-hover:bg-purple-50/70'
                                  : 'text-slate-800 border-b-2 border-dotted border-sky-400 group-hover:bg-sky-50/70'
                              }`}
                            >
                              {originalText || (
                                <span className="text-emerald-700 font-sans font-bold text-xs leading-none">^</span>
                              )}
                            </span>
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Needs Review Section: Flagged when OCR text is corrected */}
        {needsReviewFindings.length > 0 && (
          <div className="mt-6 border border-amber-300 bg-amber-50/80 rounded-lg p-3 text-xs shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between font-semibold text-amber-900 pb-2 border-b border-amber-200">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>待重新檢查建議 (Needs Review) ({needsReviewFindings.length})</span>
              </div>
              <span className="text-[11px] font-normal text-amber-700">因 OCR 修正而暫停正文標記</span>
            </div>

            <div className="mt-2.5 space-y-2">
              <p className="text-[11px] text-amber-800">
                下列批改建議的原文字詞因謄本文字被手動修正而不再精確匹配，已自動暫停在正文顯示。請確認是否重新套用、拒絕或刪除：
              </p>
              {needsReviewFindings.map((f) => (
                <div
                  key={`needs-review-${f.id}`}
                  className="p-2.5 bg-white border border-amber-300 rounded-md shadow-2xs space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadgeClass(f.type)}`}>
                      {f.type}
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold uppercase">
                      待重新檢查
                    </span>
                  </div>

                  <div className="font-serif text-slate-800 flex items-center gap-2">
                    <span className="line-through text-rose-600 font-semibold">{f.originalText}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 font-bold font-sans">
                      {f.teacherCustomText || f.replacementText}
                    </span>
                  </div>

                  {(f.anchorReviewReason || f.reviewReason) && (
                    <p className="text-amber-800 text-[11px] bg-amber-50/60 p-1 rounded border border-amber-100">
                      <strong>原因：</strong>{f.anchorReviewReason || f.reviewReason}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAcceptFinding(f.id)}
                        className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded font-medium text-[11px]"
                        title="確認此建議依然有效並重新套用"
                      >
                        重新套用
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectFinding(f.id)}
                        className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded font-medium text-[11px]"
                      >
                        拒絕
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                      title="刪除此建議"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Unmatched Suggestions Area */}
        {unmatchedFindings.length > 0 && (
          <div className="mt-8 border border-amber-200 bg-amber-50/70 rounded-lg p-3 text-xs">
            <button
              type="button"
              onClick={() => setIsUnmatchedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left font-semibold text-amber-900"
            >
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Unmatched Suggestions / 未能定位建議 ({unmatchedFindings.length})
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-700">
                <span>{isUnmatchedOpen ? 'Hide' : 'Review'}</span>
                {isUnmatchedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {isUnmatchedOpen && (
              <div className="mt-3 space-y-2 pt-2 border-t border-amber-200">
                <p className="text-[11px] text-amber-800">
                  These suggestions could not be unambiguously mapped to a single line in the transcript. You can still accept, edit, or reject them:
                </p>
                {unmatchedFindings.map((f) => (
                  <div
                    key={`unmatched-${f.id}`}
                    className="p-2.5 bg-white border border-amber-200 rounded-md shadow-2xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadgeClass(f.type)}`}>
                        {f.type}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {f.decision}
                      </span>
                    </div>

                    <div className="font-serif text-slate-800 flex items-center gap-2">
                      {f.feedbackType === 'improvement' || f.feedbackType === 'clarity' ? (
                        <>
                          <span className="text-slate-700 font-medium">"{f.originalText}"</span>
                          <span className="text-slate-400">→</span>
                          <span
                            className={
                              f.feedbackType === 'improvement'
                                ? 'text-purple-700 font-bold font-sans'
                                : 'text-sky-700 font-bold font-sans'
                            }
                          >
                            ({f.teacherCustomText || f.replacementText || (f.feedbackType === 'clarity' ? 'Clarification needed' : '')})
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="line-through text-rose-600 font-semibold">{f.originalText}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-700 font-bold font-sans">
                            {f.teacherCustomText || f.replacementText}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-slate-600 text-[11px]">{f.teacherCustomText || f.explanation}</p>
                    {(f.anchorReviewReason || f.reviewReason) && (
                      <p className="text-amber-800 text-[11px] bg-amber-50/60 p-1 rounded border border-amber-100">
                        <strong>原因：</strong>{f.anchorReviewReason || f.reviewReason}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      {f.feedbackType === 'improvement' || f.feedbackType === 'clarity' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium text-[10px]">
                            Reference Only
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAcceptFinding(f.id)}
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded font-medium text-[11px]"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectFinding(f.id)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded font-medium text-[11px]"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                        title="Delete finding"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Floating Hover Tooltip (rendered via React Portal to prevent clipping) */}
      {hoveredFinding && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            width: '290px',
            zIndex: 99999,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className="bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-lg shadow-xl border border-slate-700 text-xs animate-in fade-in duration-100 select-none pointer-events-auto"
        >
          {/* Header with Type and Text Label for Feedback Type */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80 mb-1.5 gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider shrink-0 ${
                  hoveredFinding.feedbackType === 'improvement'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                    : hoveredFinding.feedbackType === 'clarity'
                    ? 'bg-sky-950/80 text-sky-300 border-sky-500/50'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                }`}
              >
                {hoveredFinding.feedbackType === 'improvement'
                  ? 'Optional Improvement'
                  : hoveredFinding.feedbackType === 'clarity'
                  ? 'Clarity / Coherence'
                  : 'Required Correction'}
              </span>
              <span className="text-[11px] font-medium text-slate-300 truncate">
                {hoveredFinding.type}
              </span>
            </div>

            <span className="text-[10px] text-slate-400 capitalize shrink-0">
              {hoveredFinding.feedbackType === 'improvement' || hoveredFinding.feedbackType === 'clarity'
                ? 'Reference Only'
                : hoveredFinding.decision === 'edited'
                ? 'Teacher Edited'
                : hoveredFinding.decision}
            </span>
          </div>

          <p className="text-slate-200 text-xs leading-snug mb-2">
            {hoveredFinding.teacherCustomText || hoveredFinding.explanation || 'Language feedback suggestion.'}
          </p>

          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700/60">
            <span>
              {hoveredFinding.feedbackType === 'improvement' || hoveredFinding.feedbackType === 'clarity'
                ? 'Click word to view / edit note'
                : 'Click word to review or edit'}
            </span>
            <span className="font-mono text-purple-300">↵ Enter</span>
          </div>
        </div>,
        document.body
      )}

      {/* Click Action Popover (rendered via React Portal) */}
      {activeActionFinding && actionPos && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${actionPos.top}px`,
            left: `${actionPos.left}px`,
            width: isEditingInPopover ? '370px' : '320px',
            zIndex: 100000,
          }}
          className="marking-action-popover bg-white border border-slate-200 rounded-lg shadow-2xl p-4 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                  activeActionFinding.feedbackType === 'improvement'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : activeActionFinding.feedbackType === 'clarity'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : getCategoryBadgeClass(activeActionFinding.type)
                }`}
              >
                {activeActionFinding.feedbackType === 'improvement'
                  ? 'Optional Improvement'
                  : activeActionFinding.feedbackType === 'clarity'
                  ? 'Clarity / Coherence'
                  : activeActionFinding.type}
              </span>

              {activeActionFinding.feedbackType === 'improvement' || activeActionFinding.feedbackType === 'clarity' ? (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Reference Only
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 capitalize">
                  {activeActionFinding.decision === 'edited'
                    ? 'Teacher Edited'
                    : activeActionFinding.decision}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleClosePopover}
              className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Finding Comparison Box (shown only when NOT in edit mode) */}
          {!isEditingInPopover && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md mb-2.5">
              {activeActionFinding.feedbackType === 'improvement' ? (
                <div className="space-y-1">
                  <div className="font-serif text-sm text-slate-800">
                    <span className="text-slate-500 text-xs font-sans mr-1 font-normal">Original:</span>
                    <span>"{activeActionFinding.originalText}"</span>
                  </div>
                  <div className="font-sans text-xs text-purple-700 font-semibold flex items-center gap-1">
                    <span className="text-slate-500 font-normal">Suggested phrasing:</span>
                    <span className="font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      ({activeActionFinding.teacherCustomText || activeActionFinding.replacementText})
                    </span>
                  </div>
                </div>
              ) : activeActionFinding.feedbackType === 'clarity' ? (
                <div className="space-y-1">
                  <div className="font-serif text-sm text-slate-800">
                    <span className="text-slate-500 text-xs font-sans mr-1 font-normal">Original:</span>
                    <span>"{activeActionFinding.originalText}"</span>
                  </div>
                  <div className="font-sans text-xs text-sky-700 font-semibold flex items-center gap-1">
                    <span className="text-slate-500 font-normal">Suggestion:</span>
                    <span className="font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                      ({activeActionFinding.teacherCustomText || activeActionFinding.replacementText || 'Clarification needed'})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="font-serif text-sm">
                    <span className="line-through text-rose-600 font-semibold mr-1.5">
                      {activeActionFinding.originalText}
                    </span>
                    <span className="text-slate-400 mr-1.5">→</span>
                    <span className="text-emerald-700 font-bold font-sans">
                      {activeActionFinding.teacherCustomText || activeActionFinding.replacementText}
                    </span>
                  </div>
                  {activeActionFinding.decision === 'accepted' && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ✓ Accepted
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Explanation or Edit Mode */}
          {isEditingInPopover ? (
            <div className="space-y-2.5 mb-2">
              {/* Feedback Type Toggle (Correction / Improvement / Clarity) */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Feedback Type
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-md text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEditFeedbackType('correction')}
                    className={`py-1 px-1.5 rounded font-medium text-center transition-all ${
                      editFeedbackType === 'correction'
                        ? 'bg-rose-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFeedbackType('improvement')}
                    className={`py-1 px-1.5 rounded font-medium text-center transition-all ${
                      editFeedbackType === 'improvement'
                        ? 'bg-purple-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Improvement
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFeedbackType('clarity')}
                    className={`py-1 px-1.5 rounded font-medium text-center transition-all ${
                      editFeedbackType === 'clarity'
                        ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Clarity
                  </button>
                </div>
              </div>

              {/* Original Quoted Text & Range */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                    Original Quoted Text
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                      Line {(editLineIndex ?? 0) + 1}
                      {typeof editOccIndex === 'number' && editOccIndex > 0 ? ` (Occ ${editOccIndex + 1})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReselectingRange(!isReselectingRange)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                        isReselectingRange
                          ? 'bg-amber-500 text-white font-bold ring-1 ring-amber-600 animate-pulse'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                      title="Click or drag-select text in the transcript to set the exact quote and position"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{isReselectingRange ? 'Selecting...' : 'Reselect'}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={editQuote}
                  onChange={(e) => {
                    setEditQuote(e.target.value);
                    if (editValidationError) setEditValidationError(null);
                  }}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-serif text-slate-900 focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  placeholder="Original word or phrase..."
                />
              </div>

              {/* Reselect Hint Banner */}
              {isReselectingRange && (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 flex items-start gap-1.5 animate-in fade-in">
                  <Crosshair className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold leading-tight">Reselect Mode Active</p>
                    <p className="text-[10px] text-amber-800 leading-snug mt-0.5">
                      Click any word or highlight a phrase in the transcript to update this quote and source location.
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Error Banner */}
              {editValidationError && (
                <div className="p-2 bg-rose-50 border border-rose-300 rounded text-[11px] text-rose-900 flex items-start gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-tight">{editValidationError}</span>
                </div>
              )}

              {/* Suggested Correction / Phrasing */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  {editFeedbackType === 'improvement'
                    ? 'Suggested Phrasing'
                    : editFeedbackType === 'clarity'
                    ? 'Clarity Note / Phrasing'
                    : 'Suggested Correction'}
                </label>
                <input
                  type="text"
                  value={editSuggestion}
                  onChange={(e) => setEditSuggestion(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-sans text-slate-900 focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  placeholder={editFeedbackType === 'correction' ? 'e.g. saved (leave empty for delete)' : 'e.g. He was always helpful'}
                />
              </div>

              {/* Category & Explanation */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="Tense">Tense</option>
                    <option value="Grammar">Grammar</option>
                    <option value="Spelling">Spelling</option>
                    <option value="Punctuation">Punctuation</option>
                    <option value="Word Choice">Word Choice</option>
                    <option value="Preposition">Preposition</option>
                    <option value="Sentence Structure">Structure</option>
                    <option value="Style">Style</option>
                    <option value="Capitalization">Capitalization</option>
                    <option value="Clarity">Clarity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Explanation Note
                  </label>
                  <input
                    type="text"
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white text-slate-700 focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                    placeholder="e.g. Past tense 'saved'"
                  />
                </div>
              </div>

              {/* Buttons: Cancel & Save Changes */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded text-xs shadow-2xs transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-slate-600 text-xs leading-relaxed">
                {activeActionFinding.teacherCustomText || activeActionFinding.explanation}
              </p>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          {!isEditingInPopover && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
              {activeActionFinding.feedbackType === 'improvement' || activeActionFinding.feedbackType === 'clarity' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Note</span>
                    </button>
                    <span className="text-[10px] text-slate-400 italic">Reference only • No action required</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(activeActionFinding.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete suggestion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAcceptFinding(activeActionFinding.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                        activeActionFinding.decision === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRejectFinding(activeActionFinding.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(activeActionFinding.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete finding"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
