import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isArchivedClassName } from '@/utils/archiveClassExporter';
import {
  WorkflowStep,
  AssignmentConfig,
  DEFAULT_RUBRIC,
  ScanFileRecord,
  ScanPage,
  StudentRosterItem,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  MarkingFinding,
  FindingDecision,
  MatchingMode,
  PageIdentityRecognition,
  TemplateRegion,
  AssignmentTranscriptionSettings,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  LineWithBbox,
} from './types';
import {
  computeMatchingPreview,
  applyBulkPageCounts,
  isMatchingDirty,
} from './utils/matchingLogic';
import {
  computeIdentityMatchingPreview,
  crossCheckIdentity,
} from './utils/identityMatchingLogic';
import { cropIdentityRegions } from './utils/scanRegionCropper';
import { essayServices } from './services/essayServiceRegistry';
import { WorkflowStepper } from './components/WorkflowStepper';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { PreparationPanel } from './components/PreparationPanel';
import { ScanIntakePanel } from './components/ScanIntakePanel';
import { StudentMatchingPanel } from './components/StudentMatchingPanel';
import { TranscriptVerificationPanel } from './components/TranscriptVerificationPanel';
import { MarkingReviewPanel } from './components/MarkingReviewPanel';
import { ReportPanel } from './components/ReportPanel';
import { ServiceStatusModal } from './components/ServiceStatusModal';
import { WorkflowHelpModal } from './components/WorkflowHelpModal';
import { BatchMarkingModal } from './components/BatchMarkingModal';
import { MarkingModelHealthStatus, MarkingPromptSnapshot } from './services/essayServiceTypes';
import {
  BatchMarkingItem,
  BatchMarkingQueueProgress,
  loadPersistedBatchState,
  persistBatchState,
  clearPersistedBatchState,
  evaluateBatchMarkingEligibility,
} from './utils/markingBatchQueue';
import {
  saveWorkbenchSession,
  loadWorkbenchSession,
  clearWorkbenchSession,
  PersistedSessionData,
} from './utils/essayMarkingStorage';
import { setupGlobalErrorCatchers } from './utils/clientErrorLogger';

export const EssayMarkingPage: React.FC = () => {
  // Navigation / Workflow Step
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('prep');

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Step 1: Preparation State
  const [assignment, setAssignment] = useState<AssignmentConfig>({
    title: '',
    isTitleCustomized: false,
    grade: null,
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'worksheet',
    scopePrompt: '',
    isConfirmed: false,
    rubric: DEFAULT_RUBRIC,
    templateRegions: [],
    transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
  });

  // Step 2: Scan Intake State
  const [files, setFiles] = useState<ScanFileRecord[]>([]);
  const [pages, setPages] = useState<ScanPage[]>([]);

  // Step 3: Class & Student Matching State
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [studentPageCounts, setStudentPageCounts] = useState<number[]>([]);
  const [selectedStudentIndices, setSelectedStudentIndices] = useState<Set<number>>(
    new Set()
  );
  const [appliedMatching, setAppliedMatching] = useState<AppliedMatching | null>(
    null
  );
  const [galleryViewMode, setGalleryViewMode] = useState<'large' | 'medium' | 'list'>(
    'medium'
  );

  // Identity Recognition State (Mode 2)
  const [matchingMode, setMatchingMode] = useState<MatchingMode>('recognition');
  const [recognitionResults, setRecognitionResults] = useState<
    Record<string, PageIdentityRecognition>
  >({});
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [recognizeProgress, setRecognizeProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });
  const recognitionAbortRef = useRef<AbortController | null>(null);

  // Active student in Steps 4, 5, 6
  const [activeStudentIndex, setActiveStudentIndex] = useState<number>(0);

  // Step 4: Transcripts State (keyed by studentId)
  const [transcripts, setTranscripts] = useState<
    Record<string, StudentTranscriptState>
  >({});

  // Step 5: Markings State (keyed by studentId)
  const [markings, setMarkings] = useState<Record<string, StudentMarkingState>>({});

  // Persistence & Error Catching Refs
  const [isRestored, setIsRestored] = useState(false);
  const currentStepRef = useRef<WorkflowStep>(currentStep);
  currentStepRef.current = currentStep;
  const restoredSessionRef = useRef<PersistedSessionData | null>(null);

  // 1. Capture uncaught errors & unhandled rejections across the essay-marking module
  useEffect(() => {
    const teardown = setupGlobalErrorCatchers(() => currentStepRef.current);
    return teardown;
  }, []);

  // 2. Restore session from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    loadWorkbenchSession().then((saved) => {
      if (!isMounted || !saved) {
        setIsRestored(true);
        return;
      }
      restoredSessionRef.current = saved;
      if (saved.assignment) setAssignment(saved.assignment);
      if (saved.files) setFiles(saved.files);
      if (saved.pages) setPages(saved.pages);
      if (saved.selectedClassId) setSelectedClassId(saved.selectedClassId);
      if (saved.studentPageCounts) setStudentPageCounts(saved.studentPageCounts);
      if (saved.selectedStudentIndices) setSelectedStudentIndices(new Set(saved.selectedStudentIndices));
      if (saved.appliedMatching) setAppliedMatching(saved.appliedMatching);
      if (typeof saved.activeStudentIndex === 'number') setActiveStudentIndex(saved.activeStudentIndex);
      if (saved.transcripts) setTranscripts(saved.transcripts);
      if (saved.markings) setMarkings(saved.markings);
      if (saved.recognitionResults) setRecognitionResults(saved.recognitionResults);
      if (saved.matchingMode) setMatchingMode(saved.matchingMode);
      if (saved.currentStep) setCurrentStep(saved.currentStep);
      setIsRestored(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Debounced auto-save to IndexedDB whenever progress changes
  useEffect(() => {
    if (!isRestored) return;

    const timer = setTimeout(() => {
      saveWorkbenchSession({
        currentStep,
        assignment,
        files,
        pages,
        selectedClassId,
        studentPageCounts,
        selectedStudentIndices: Array.from(selectedStudentIndices),
        appliedMatching,
        activeStudentIndex,
        transcripts,
        markings,
        recognitionResults,
        matchingMode,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    isRestored,
    currentStep,
    assignment,
    files,
    pages,
    selectedClassId,
    studentPageCounts,
    selectedStudentIndices,
    appliedMatching,
    activeStudentIndex,
    transcripts,
    markings,
    recognitionResults,
    matchingMode,
  ]);

  // Fetch Class List from Supabase
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('class')
          .not('class', 'is', null);

        if (error) {
          console.error('Error fetching classes for essay marking:', error);
          return;
        }

        const rows = (data || []) as unknown as Array<{ class: string | null }>;
        const uniqueClasses = Array.from(
          new Set(
            rows
              .map((u) => u.class)
              .filter(
                (c: string | null): c is string =>
                  !!c && c !== 'Unassigned' && !isArchivedClassName(c)
              )
          )
        ).sort();

        setClasses(uniqueClasses);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };

    fetchClasses();
  }, []);

  // Context Fingerprint Helper
  const getContextFingerprint = useCallback(() => {
    return `${assignment.title}_${assignment.worksheetFileName || ''}_${selectedClassId}_${pages.length}_${(assignment.templateRegions || []).length}`;
  }, [assignment.title, assignment.worksheetFileName, selectedClassId, pages.length, assignment.templateRegions]);

  // Fetch Students when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setStudentPageCounts([]);
      setSelectedStudentIndices(new Set());
      setRecognitionResults({});
      return;
    }

    // Cancel running recognition and reset results when class changes
    if (recognitionAbortRef.current) {
      recognitionAbortRef.current.abort();
      setIsRecognizing(false);
    }
    setRecognitionResults({});

    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, display_name, class, class_number')
          .eq('class', selectedClassId)
          .eq('role', 'user')
          .order('class_number', { ascending: true });

        if (error) {
          console.error('Error fetching students:', error);
          return;
        }

        const userRows = (data || []) as unknown as Array<{
          id: string;
          display_name: string | null;
          class: string | null;
          class_number: number | null;
        }>;

        const roster: StudentRosterItem[] = userRows.map((u, idx) => ({
          id: u.id,
          displayName: u.display_name || `Student ${String(idx + 1).padStart(2, '0')}`,
          classNumber: u.class_number ?? idx + 1,
          className: u.class || selectedClassId,
        }));

        setStudents(roster);
        if (restoredSessionRef.current && restoredSessionRef.current.selectedClassId === selectedClassId) {
          // Preserve restored matching, student page counts, and selected indices
          restoredSessionRef.current = null;
        } else {
          // Default each student to 1 page
          setStudentPageCounts(roster.map(() => 1));
          setSelectedStudentIndices(new Set());
          // Invalidate applied matching if class changes
          setAppliedMatching(null);
        }
      } catch (err) {
        console.error('Failed to load class students:', err);
      }
    };

    fetchStudents();
  }, [selectedClassId]);

  // Compute matching preview
  const matchingPreview = useMemo(() => {
    if (matchingMode === 'recognition') {
      return computeIdentityMatchingPreview(pages, recognitionResults, students).preview;
    }
    return computeMatchingPreview(students, studentPageCounts, pages.length);
  }, [matchingMode, pages, recognitionResults, students, studentPageCounts]);

  // Invalidation Handlers
  const invalidateDownstream = useCallback(() => {
    setTranscripts({});
    setMarkings({});
  }, []);

  const handleChangeAssignment = (updated: Partial<AssignmentConfig>) => {
    setAssignment((prev) => ({ ...prev, ...updated }));
    // If scope or rubric changed, revoke all marking approvals
    if (updated.scopePrompt !== undefined || updated.rubric !== undefined) {
      setMarkings((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = { ...next[k], isApproved: false };
        });
        return next;
      });
    }
  };

  const handleConfirmRequirements = () => {
    setAssignment((prev) => ({ ...prev, isConfirmed: true }));
  };

  // Add / Remove Scans
  const handleAddFiles = (newFiles: ScanFileRecord[], newPages: ScanPage[]) => {
    // Check if this upload is re-linking existing files (e.g. restoring image preview for existing pages with matching file names and page counts)
    const isRelinking =
      files.length > 0 &&
      newFiles.length === files.length &&
      newFiles.every((nf) => {
        const existing = files.find((ef) => ef.name === nf.name);
        return existing && existing.pageCount === nf.pageCount;
      });

    if (isRelinking) {
      // Safely update preview URLs and imageBlobs on existing pages without invalidating matching or downstream transcripts!
      setFiles((prev) =>
        prev.map((ef) => {
          const matchedNew = newFiles.find((nf) => nf.name === ef.name);
          return matchedNew ? { ...ef, size: matchedNew.size, type: matchedNew.type } : ef;
        })
      );
      setPages((prev) =>
        prev.map((p) => {
          const matchedNewPage = newPages.find(
            (np) => np.fileName === p.fileName && np.sourcePageNumber === p.sourcePageNumber
          );
          if (matchedNewPage) {
            return {
              ...p,
              previewUrl: matchedNewPage.previewUrl,
              imageBlob: matchedNewPage.imageBlob ?? p.imageBlob,
            };
          }
          return p;
        })
      );
      return;
    }

    setFiles((prev) => [...prev, ...newFiles]);
    setPages((prev) => [...prev, ...newPages]);
    // Adding scans invalidates applied matching
    setAppliedMatching(null);
    invalidateDownstream();
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setPages((prev) => {
      const remaining = prev.filter((p) => p.fileId !== fileId);
      return remaining.map((p, idx) => ({ ...p, orderIndex: idx }));
    });
    setAppliedMatching(null);
    invalidateDownstream();
  };

  // Identity Recognition Handlers
  const handleStartRecognition = async () => {
    if (!selectedClassId || pages.length === 0 || isRecognizing) return;

    setIsRecognizing(true);
    setRecognizeProgress({ current: 0, total: pages.length });

    const controller = new AbortController();
    recognitionAbortRef.current = controller;

    try {
      for (let i = 0; i < pages.length; i++) {
        if (controller.signal.aborted) break;

        const page = pages[i];

        // Preserve manual teacher assignment
        if (recognitionResults[page.id]?.manualConfirmed) {
          setRecognizeProgress({ current: i + 1, total: pages.length });
          continue;
        }

        try {
          const crops = await cropIdentityRegions(
            page.previewUrl,
            page.customRegions || assignment.templateRegions || []
          );

          if (controller.signal.aborted) break;

          const bridgeRes = await essayServices.getIdentityService().recognizeIdentity({
            scanPageId: page.id,
            combinedImage: crops.combinedImage,
            classImage: crops.classImage,
            nameImage: crops.nameImage,
            numberImage: crops.numberImage,
            signal: controller.signal,
          });

          if (controller.signal.aborted) break;

          if (bridgeRes.status === 'success') {
            const check = crossCheckIdentity(bridgeRes, students, selectedClassId);
            setRecognitionResults((prev) => ({
              ...prev,
              [page.id]: {
                scanPageId: page.id,
                pageNumber: i + 1,
                rawClass: bridgeRes.rawClass,
                rawStudentName: bridgeRes.rawStudentName,
                rawClassNumber: bridgeRes.rawClassNumber,
                classReadable: bridgeRes.classReadable,
                nameReadable: bridgeRes.nameReadable,
                numberReadable: bridgeRes.numberReadable,
                warnings: bridgeRes.warnings,
                status: check.status,
                statusReason: check.statusReason,
                matchedStudentId: check.matchedStudentId,
                candidateStudentIds: check.candidateStudentIds,
              },
            }));
          } else {
            setRecognitionResults((prev) => ({
              ...prev,
              [page.id]: {
                scanPageId: page.id,
                pageNumber: i + 1,
                rawClass: null,
                rawStudentName: null,
                rawClassNumber: null,
                classReadable: false,
                nameReadable: false,
                numberReadable: false,
                warnings: bridgeRes.warnings,
                status: 'unmatched',
                statusReason: bridgeRes.errorMessage || 'Local recognition failed',
              },
            }));
          }
        } catch (pageErr: unknown) {
          if (controller.signal.aborted) break;
          console.error(`Recognition error on page ${page.id}:`, pageErr);
        }

        setRecognizeProgress({ current: i + 1, total: pages.length });
      }
    } finally {
      setIsRecognizing(false);
      recognitionAbortRef.current = null;
    }
  };

  const handleCancelRecognition = () => {
    recognitionAbortRef.current?.abort();
    setIsRecognizing(false);
  };

  const handleRetryRecognition = async () => {
    if (!selectedClassId || pages.length === 0 || isRecognizing) return;

    const pagesToRetry = pages.filter((p) => {
      const rec = recognitionResults[p.id];
      return !rec || (!rec.manualConfirmed && rec.status !== 'matched');
    });

    if (pagesToRetry.length === 0) return;

    setIsRecognizing(true);
    setRecognizeProgress({ current: 0, total: pagesToRetry.length });

    const controller = new AbortController();
    recognitionAbortRef.current = controller;

    try {
      for (let i = 0; i < pagesToRetry.length; i++) {
        if (controller.signal.aborted) break;
        const page = pagesToRetry[i];

        try {
          const crops = await cropIdentityRegions(
            page.previewUrl,
            page.customRegions || assignment.templateRegions || []
          );

          if (controller.signal.aborted) break;

          const bridgeRes = await essayServices.getIdentityService().recognizeIdentity({
            scanPageId: page.id,
            combinedImage: crops.combinedImage,
            classImage: crops.classImage,
            nameImage: crops.nameImage,
            numberImage: crops.numberImage,
            signal: controller.signal,
          });

          if (controller.signal.aborted) break;

          if (bridgeRes.status === 'success') {
            const check = crossCheckIdentity(bridgeRes, students, selectedClassId);
            setRecognitionResults((prev) => ({
              ...prev,
              [page.id]: {
                scanPageId: page.id,
                pageNumber: page.orderIndex + 1,
                rawClass: bridgeRes.rawClass,
                rawStudentName: bridgeRes.rawStudentName,
                rawClassNumber: bridgeRes.rawClassNumber,
                classReadable: bridgeRes.classReadable,
                nameReadable: bridgeRes.nameReadable,
                numberReadable: bridgeRes.numberReadable,
                warnings: bridgeRes.warnings,
                status: check.status,
                statusReason: check.statusReason,
                matchedStudentId: check.matchedStudentId,
                candidateStudentIds: check.candidateStudentIds,
              },
            }));
          }
        } catch (pageErr) {
          console.error(`Retry recognition error on page ${page.id}:`, pageErr);
        }

        setRecognizeProgress({ current: i + 1, total: pagesToRetry.length });
      }
    } finally {
      setIsRecognizing(false);
      recognitionAbortRef.current = null;
    }
  };

  const handleManualAssignStudent = (scanPageId: string, studentId: string | null) => {
    setRecognitionResults((prev) => {
      const existing = prev[scanPageId];
      return {
        ...prev,
        [scanPageId]: {
          scanPageId,
          pageNumber: existing?.pageNumber ?? 1,
          rawClass: existing?.rawClass ?? null,
          rawStudentName: existing?.rawStudentName ?? null,
          rawClassNumber: existing?.rawClassNumber ?? null,
          classReadable: existing?.classReadable ?? false,
          nameReadable: existing?.nameReadable ?? false,
          numberReadable: existing?.numberReadable ?? false,
          warnings: existing?.warnings ?? [],
          status: studentId ? 'matched' : 'unmatched',
          statusReason: studentId ? 'Manually assigned by teacher' : 'Unassigned',
          matchedStudentId: studentId,
          manualStudentId: studentId,
          manualConfirmed: Boolean(studentId),
        },
      };
    });
  };

  const handleUpdatePageCustomRegions = (pageId: string, customRegions: TemplateRegion[]) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, customRegions } : p))
    );
  };

  // Student Matching handlers
  const handlePageCountChange = (index: number, count: number) => {
    setStudentPageCounts((prev) => {
      const next = [...prev];
      next[index] = count;
      return next;
    });
  };

  const handleToggleSelectStudent = (index: number) => {
    setSelectedStudentIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedStudentIndices(new Set(students.map((_, i) => i)));
    } else {
      setSelectedStudentIndices(new Set());
    }
  };

  const handleApplyBulkCounts = (count: number) => {
    setStudentPageCounts((prev) =>
      applyBulkPageCounts(prev, selectedStudentIndices, count)
    );
  };

  const handleApplyMatching = () => {
    if (!selectedClassId || pages.length === 0) return;

    if (matchingMode === 'recognition') {
      const {
        preview,
        studentPageCounts: newCounts,
        assignedStudentIndices,
        unmatchedPagesCount,
      } = computeIdentityMatchingPreview(pages, recognitionResults, students);

      if (assignedStudentIndices.length === 0) {
        alert('尚未有任何頁面配對到學生。請先點擊「Recognise Student Details」辨識身份，或手動選擇學生。');
        return;
      }

      if (unmatchedPagesCount > 0) {
        const proceed = window.confirm(
          `尚有 ${unmatchedPagesCount} 頁未配對。若現在套用，這些未配對頁面將保持未分配狀態。\n\n是否確認套用已配對的學生？`
        );
        if (!proceed) return;
      }

      setStudentPageCounts(newCounts);
      setAppliedMatching({
        classId: selectedClassId,
        counts: newCounts,
        map: preview.map,
        assignedStudentIndices,
        mode: 'recognition',
        contextFingerprint: getContextFingerprint(),
      });

      if (assignedStudentIndices.length > 0) {
        setActiveStudentIndex(assignedStudentIndices[0]);
      }
      invalidateDownstream();
      return;
    }

    // Sequential mode
    if (matchingPreview.extra > 0 || matchingPreview.missing > 0) {
      return;
    }

    const assignedIndices = studentPageCounts
      .map((c, i) => (c > 0 ? i : null))
      .filter((i): i is number => i !== null);

    setAppliedMatching({
      classId: selectedClassId,
      counts: [...studentPageCounts],
      map: [...matchingPreview.map],
      assignedStudentIndices: assignedIndices,
      mode: 'sequential',
      contextFingerprint: getContextFingerprint(),
    });

    if (assignedIndices.length > 0) {
      setActiveStudentIndex(assignedIndices[0]);
    }

    invalidateDownstream();
  };

  // Step 4: Transcript Verification Handlers
  const handleUpdateTranscriptText = (studentId: string, text: string, linesWithBboxes?: LineWithBbox[]) => {
    setTranscripts((prev) => ({
      ...prev,
      [studentId]: {
        studentId,
        rawOcrText: prev[studentId]?.rawOcrText || null,
        editedText: text,
        linesWithBboxes: linesWithBboxes ?? prev[studentId]?.linesWithBboxes,
        isManuallyEntered: true,
        uncertainRegions: prev[studentId]?.uncertainRegions || [],
        isVerified: false, // Editing revokes verification
      },
    }));

    // Invalidate marking approval for this student
    setMarkings((prev) => {
      if (!prev[studentId]?.isApproved) return prev;
      return {
        ...prev,
        [studentId]: { ...prev[studentId], isApproved: false },
      };
    });
  };

  const handleVerifyTranscript = (studentId: string) => {
    setTranscripts((prev) => {
      const current = prev[studentId] || {
        studentId,
        rawOcrText: null,
        editedText: '',
        isManuallyEntered: true,
        uncertainRegions: [],
        isVerified: false,
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          isVerified: true,
          verifiedAt: new Date().toISOString(),
        },
      };
    });

    // Advance to next unverified student if any
    if (appliedMatching) {
      const nextIdx = appliedMatching.assignedStudentIndices.find(
        (i) => !transcripts[students[i]?.id]?.isVerified
      );
      if (nextIdx !== undefined && nextIdx !== activeStudentIndex) {
        setActiveStudentIndex(nextIdx);
      }
    }
  };

  // Step 5: Marking Review Handlers
  const handleUpdateScores = (
    studentId: string,
    scores: Record<string, number>
  ) => {
    setMarkings((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          studentId,
          findings: [],
          feedbackComment: '',
        }),
        scores,
        isApproved: false, // Editing revokes approval
      },
    }));
  };

  const handleUpdateFeedback = (studentId: string, feedback: string) => {
    setMarkings((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          studentId,
          findings: [],
          scores: {},
        }),
        feedbackComment: feedback,
        isApproved: false, // Editing revokes approval
      },
    }));
  };

  const handleAddFinding = (
    studentId: string,
    finding: Omit<MarkingFinding, 'id' | 'decision'>
  ) => {
    const newFinding: MarkingFinding = {
      ...finding,
      id: `f-${Date.now()}`,
      decision: 'pending',
    };
    setMarkings((prev) => {
      const current = prev[studentId] || {
        studentId,
        findings: [],
        scores: {},
        feedbackComment: '',
        isApproved: false,
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          findings: [...current.findings, newFinding],
          isApproved: false,
        },
      };
    });
  };

  const handleFindingDecision = (
    studentId: string,
    findingId: string,
    decision: FindingDecision,
    customText?: string
  ) => {
    setMarkings((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          findings: current.findings.map((f) =>
            f.id === findingId
              ? {
                  ...f,
                  decision,
                  teacherCustomText: customText ?? f.teacherCustomText,
                }
              : f
          ),
          isApproved: false,
        },
      };
    });
  };

  const handleEditFinding = (
    studentId: string,
    findingId: string,
    updatedFields: Partial<MarkingFinding>
  ) => {
    setMarkings((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          findings: current.findings.map((f) =>
            f.id === findingId
              ? {
                  ...f,
                  ...updatedFields,
                  decision: (updatedFields.decision as FindingDecision) || 'edited',
                  source: 'teacher',
                  isManual: true,
                }
              : f
          ),
          isApproved: false,
        },
      };
    });
  };

  const handleDeleteFinding = (studentId: string, findingId: string) => {
    setMarkings((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          findings: current.findings.filter((f) => f.id !== findingId),
          isApproved: false,
        },
      };
    });
  };

  const handleUpdateFindings = (studentId: string, findings: MarkingFinding[]) => {
    setMarkings((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          findings,
          isApproved: false,
        },
      };
    });
  };

  const handleApproveMarking = (studentId: string) => {
    setMarkings((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          isApproved: true,
          approvedAt: new Date().toISOString(),
        },
      };
    });
  };

  // Step Navigation Guards
  const canNavigateTo = (step: WorkflowStep): boolean => {
    if (step === 'prep' || step === 'intake') return true;
    if (step === 'pair') return pages.length > 0;
    if (step === 'ocr' || step === 'grade' || step === 'report') {
      return (
        appliedMatching !== null &&
        !isMatchingDirty(appliedMatching, selectedClassId, studentPageCounts)
      );
    }
    return false;
  };

  // Reset Session
  const handleResetSession = async () => {
    if (
      window.confirm(
        'Are you sure you want to clear this saved marking session? All loaded scans, transcripts, and marking drafts will be reset.'
      )
    ) {
      await clearWorkbenchSession();
      setAssignment({
        title: '',
        isTitleCustomized: false,
        grade: null,
        worksheetFileName: null,
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt: '',
        isConfirmed: false,
        rubric: DEFAULT_RUBRIC,
        templateRegions: [],
        transcriptionSettings: DEFAULT_TRANSCRIPTION_SETTINGS,
      });
      setFiles([]);
      setPages([]);
      setSelectedClassId('');
      setStudents([]);
      setStudentPageCounts([]);
      setSelectedStudentIndices(new Set());
      setAppliedMatching(null);
      setActiveStudentIndex(0);
      setTranscripts({});
      setMarkings({});
      setRecognitionResults({});
      setCurrentStep('prep');
    }
  };

  const activeStudent = students[activeStudentIndex];
  const activeStudentTranscript = activeStudent
    ? transcripts[activeStudent.id]
    : undefined;

  const [aiMarkingLoadingMap, setAiMarkingLoadingMap] = useState<Record<string, boolean>>({});
  const [aiMarkingErrorMap, setAiMarkingErrorMap] = useState<Record<string, string | null>>({});

  // 18086 Model Status & Batch Marking State
  const [markingModelHealth, setMarkingModelHealth] = useState<MarkingModelHealthStatus | null>(null);
  const [isChecking18086, setIsChecking18086] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchMarkingQueueProgress | null>(null);
  const stopBatchRequestedRef = React.useRef<boolean>(false);

  // F5 Rehydration of batch state (marking interrupted items, no auto-resend)
  useEffect(() => {
    if (assignment.id) {
      const saved = loadPersistedBatchState(assignment.id);
      if (saved) {
        setBatchProgress(saved);
      }
    }
  }, [assignment.id]);

  const handleCheck18086Status = async (): Promise<MarkingModelHealthStatus> => {
    if (isChecking18086) return markingModelHealth || { status: 'checking', port: 18086 };
    setIsChecking18086(true);
    try {
      const res = await essayServices.getAvailabilityService().checkMarkingModelStatus!();
      setMarkingModelHealth(res);
      return res;
    } catch (err: any) {
      const fallback: MarkingModelHealthStatus = {
        status: 'bridge_unreachable',
        port: 18086,
        checkedAt: new Date().toISOString(),
        details: err?.message || '18089 Bridge unreachable',
      };
      setMarkingModelHealth(fallback);
      return fallback;
    } finally {
      setIsChecking18086(false);
    }
  };

  const handleRequestStopBatch = () => {
    stopBatchRequestedRef.current = true;
    setBatchProgress((prev) => (prev ? { ...prev, status: 'stopping', stopRequested: true } : prev));
  };

  const handleDismissBatchBanner = () => {
    setBatchProgress(null);
    clearPersistedBatchState(assignment.id);
  };

  const handleStartBatchMarking = async (itemsToRun: BatchMarkingItem[]) => {
    if (itemsToRun.length === 0) return;
    stopBatchRequestedRef.current = false;

    // Build initial progress queue
    const allStudentsResult = evaluateBatchMarkingEligibility({
      students,
      appliedMatching: appliedMatching!,
      transcripts,
      markings,
      pages,
    });

    const initialProgress: BatchMarkingQueueProgress = {
      status: 'running',
      totalItems: itemsToRun.length,
      completedItems: 0,
      failedItems: 0,
      skippedItems: allStudentsResult.skippedCount,
      pendingItems: itemsToRun.length,
      activeStudentId: null,
      activeStudentName: null,
      activePageCount: null,
      items: allStudentsResult.items,
      stopRequested: false,
      startedAt: new Date().toISOString(),
    };

    setBatchProgress(initialProgress);
    persistBatchState(assignment.id, initialProgress);

    // Capture one immutable prompt snapshot at the beginning of the batch
    // so editing the prompt file during a batch does NOT alter that batch!
    let batchPromptSnapshot: MarkingPromptSnapshot | undefined;
    try {
      batchPromptSnapshot = await essayServices.getMarkingService().getPromptSnapshot?.();
    } catch (err) {
      console.warn('Could not capture prompt snapshot for batch:', err);
    }

    // Sequential execution loop: exactly 1 request in flight across entire batch
    for (let i = 0; i < itemsToRun.length; i++) {
      const targetItem = itemsToRun[i];
      const studentId = targetItem.studentId;

      // Check if user requested to stop after current essay
      if (stopBatchRequestedRef.current) {
        setBatchProgress((prev) => {
          if (!prev) return prev;
          const stoppedState: BatchMarkingQueueProgress = {
            ...prev,
            status: 'completed',
            stopRequested: false,
            activeStudentId: null,
            activeStudentName: null,
            activePageCount: null,
            pauseReason: '已依要求在完成當前作文後停止批次。',
          };
          persistBatchState(assignment.id, stoppedState);
          return stoppedState;
        });
        break;
      }

      // Update active student in progress
      setBatchProgress((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((it) =>
          it.studentId === studentId ? { ...it, status: 'running' as const } : it
        );
        const nextState: BatchMarkingQueueProgress = {
          ...prev,
          activeStudentId: studentId,
          activeStudentName: targetItem.studentName,
          activePageCount: targetItem.pageCount,
          items: nextItems,
        };
        persistBatchState(assignment.id, nextState);
        return nextState;
      });

      // Prepare text and record snapshot to detect teacher edits while running
      const transcriptState = transcripts[studentId];
      const textToMark = (transcriptState?.editedText || transcriptState?.rawOcrText || '').trim();
      const textSnapshotAtStart = textToMark;

      try {
        const res = await essayServices.getMarkingService().mark({
          transcript: textToMark,
          studentId,
          assignmentTitle: assignment.title,
          scopePrompt: assignment.scopePrompt,
          rubric: assignment.rubric,
          promptSnapshot: batchPromptSnapshot,
        });

        if (res.status === 'success') {
          // Check if teacher edited the transcript text while inference was running
          const latestTranscriptState = transcripts[studentId];
          const latestText = (latestTranscriptState?.editedText || latestTranscriptState?.rawOcrText || '').trim();
          const wasTextEditedDuringRun = latestText !== textSnapshotAtStart;

          const newFindings: MarkingFinding[] = res.findings.map((f, idx) => ({
            id: `f-ai-${Date.now()}-${idx}`,
            type: f.type,
            feedbackType: f.feedbackType || 'correction',
            originalText: f.originalText,
            replacementText: f.replacementText,
            explanation: f.explanation,
            decision: wasTextEditedDuringRun ? ('needs_review' as const) : ('pending' as const),
            reviewReason: wasTextEditedDuringRun ? '批改回傳前教師已修改原文，請重新確認。' : undefined,
            paragraphIndex: (f as any).paragraphIndex,
            lineIndex: (f as any).lineIndex,
            occurrenceIndex: (f as any).occurrenceIndex,
            promptVersion: (f as any).promptVersion || res.promptVersion,
            schemaVersion: (f as any).schemaVersion || res.schemaVersion,
          }));

          // Merge with teacher manual findings and save immediately
          setMarkings((prev) => {
            const current = prev[studentId] || {
              studentId,
              findings: [],
              scores: {},
              feedbackComment: '',
              isApproved: false,
            };
            const preservedManual = current.findings.filter(
              (f) => !f.id.startsWith('f-ai-') || f.decision === 'edited' || f.decision === 'accepted' || (f as any).isManual || f.source === 'teacher'
            );
            return {
              ...prev,
              [studentId]: {
                ...current,
                findings: [...preservedManual, ...newFindings],
                isApproved: false,
              },
            };
          });

          // Update batch progress
          setBatchProgress((prev) => {
            if (!prev) return prev;
            const nextItems = prev.items.map((it) =>
              it.studentId === studentId
                ? {
                    ...it,
                    status: 'completed' as const,
                    findingsCount: newFindings.length,
                    completedAt: new Date().toISOString(),
                  }
                : it
            );
            const nextCompleted = prev.completedItems + 1;
            const nextPending = Math.max(0, prev.pendingItems - 1);
            const isFinished = nextCompleted + prev.failedItems >= prev.totalItems;
            const nextState: BatchMarkingQueueProgress = {
              ...prev,
              completedItems: nextCompleted,
              pendingItems: nextPending,
              items: nextItems,
              status: isFinished ? 'completed' : prev.status,
              finishedAt: isFinished ? new Date().toISOString() : undefined,
            };
            persistBatchState(assignment.id, nextState);
            return nextState;
          });
        } else {
          // Failure handling
          const isNetworkOrTimeout = res.code === 'TIMEOUT' || res.code === 'NETWORK_ERROR' || res.message?.includes('timeout') || res.message?.includes('connect') || res.message?.includes('Bridge');
          setBatchProgress((prev) => {
            if (!prev) return prev;
            const nextItems = prev.items.map((it) =>
              it.studentId === studentId
                ? { ...it, status: 'failed' as const, error: res.message || 'Marking failed' }
                : it
            );
            const nextFailed = prev.failedItems + 1;
            const nextPending = Math.max(0, prev.pendingItems - 1);
            const nextState: BatchMarkingQueueProgress = {
              ...prev,
              failedItems: nextFailed,
              pendingItems: nextPending,
              items: nextItems,
              status: isNetworkOrTimeout ? 'paused' : prev.status,
              pauseReason: isNetworkOrTimeout ? `模型或 Bridge 連線中斷／超時 (${res.message || 'Network error'})。批次已暫停以防止請求堆積。` : undefined,
            };
            persistBatchState(assignment.id, nextState);
            return nextState;
          });

          // If network / timeout error, pause execution and stop loop immediately!
          if (isNetworkOrTimeout) {
            break;
          }
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to connect to marking model';
        setBatchProgress((prev) => {
          if (!prev) return prev;
          const nextItems = prev.items.map((it) =>
            it.studentId === studentId
              ? { ...it, status: 'failed' as const, error: errorMsg }
              : it
          );
          const nextFailed = prev.failedItems + 1;
          const nextPending = Math.max(0, prev.pendingItems - 1);
          const nextState: BatchMarkingQueueProgress = {
            ...prev,
            failedItems: nextFailed,
            pendingItems: nextPending,
            items: nextItems,
            status: 'paused',
            pauseReason: `模型或 Bridge 連線錯誤 (${errorMsg})。批次已暫停。`,
          };
          persistBatchState(assignment.id, nextState);
          return nextState;
        });
        break;
      }
    }
  };

  const handleResumeBatch = () => {
    if (!batchProgress) return;
    const remaining = batchProgress.items.filter((it) => it.status === 'pending' || it.status === 'interrupted');
    handleStartBatchMarking(remaining);
  };

  const handleRunAiMarking = async (studentId: string) => {
    const transcriptState = transcripts[studentId];
    const textToMark = transcriptState?.editedText || transcriptState?.rawOcrText || '';
    if (!textToMark.trim()) {
      alert('Cannot mark essay: transcript is empty. Please verify transcript first in Step 4.');
      return;
    }

    setAiMarkingLoadingMap((prev) => ({ ...prev, [studentId]: true }));
    setAiMarkingErrorMap((prev) => ({ ...prev, [studentId]: null }));

    try {
      const res = await essayServices.getMarkingService().mark({
        transcript: textToMark,
        studentId,
        assignmentTitle: assignment.title,
        scopePrompt: assignment.scopePrompt,
        rubric: assignment.rubric,
      });

      if (res.status === 'success') {
        const newFindings: MarkingFinding[] = res.findings.map((f, idx) => ({
          id: `f-ai-${Date.now()}-${idx}`,
          type: f.type,
          feedbackType: f.feedbackType || 'correction',
          originalText: f.originalText,
          replacementText: f.replacementText,
          explanation: f.explanation,
          decision: 'pending',
          paragraphIndex: (f as any).paragraphIndex,
          lineIndex: (f as any).lineIndex,
          occurrenceIndex: (f as any).occurrenceIndex,
          promptVersion: (f as any).promptVersion || res.promptVersion,
          schemaVersion: (f as any).schemaVersion || res.schemaVersion,
        }));

        setMarkings((prev) => {
          const current = prev[studentId] || {
            studentId,
            findings: [],
            scores: {},
            feedbackComment: '',
            isApproved: false,
          };
          const preservedManual = current.findings.filter(
            (f) => !f.id.startsWith('f-ai-') || f.decision === 'edited' || f.decision === 'accepted' || (f as any).isManual || f.source === 'teacher'
          );
          return {
            ...prev,
            [studentId]: {
              ...current,
              findings: [...preservedManual, ...newFindings],
              isApproved: false,
            },
          };
        });
      } else {
        setAiMarkingErrorMap((prev) => ({
          ...prev,
          [studentId]: res.message || 'AI marking failed',
        }));
      }
    } catch (err: any) {
      setAiMarkingErrorMap((prev) => ({
        ...prev,
        [studentId]: err?.message || 'Failed to connect to AI marking service',
      }));
    } finally {
      setAiMarkingLoadingMap((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const handleUpdateTranscriptionSettings = (newSettings: AssignmentTranscriptionSettings) => {
    setAssignment((prev) => ({
      ...prev,
      transcriptionSettings: newSettings,
    }));
  };

  const handleNavigateToPreparation = () => {
    setCurrentStep('prep');
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col">
      {/* Top Workflow Stepper */}
      <WorkflowStepper
        currentStep={currentStep}
        onStepChange={(step) => setCurrentStep(step)}
        canNavigateTo={canNavigateTo}
      />

      {/* Main Workspace Surface */}
      <div className="flex-1 w-full p-2 sm:p-3 md:p-4">
        <WorkbenchHeader
          title={assignment.title}
          stepTitle={
            currentStep === 'prep'
              ? 'Prepare Assignment'
              : currentStep === 'intake'
              ? 'Add Student Scans'
              : currentStep === 'pair'
              ? 'Match Scans to Students'
              : currentStep === 'ocr'
              ? 'Recognition & Transcript Verification'
              : currentStep === 'grade'
              ? 'Marking & Teacher Review'
              : 'Feedback Report Preview'
          }
          stepDescription={
            currentStep === 'prep'
              ? 'Confirm assignment title, template worksheet, scope prompts, and rubric dimensions before intake.'
              : currentStep === 'intake'
              ? 'Select or drag local handwriting scans or multi-page PDFs. Scans are processed in browser memory.'
              : currentStep === 'pair'
              ? 'Assign scans sequentially in student-number order. Preview page counts before applying matching.'
              : currentStep === 'ocr'
              ? 'Examine original scan and verify student transcript. Student spelling and grammar errors are preserved.'
              : currentStep === 'grade'
              ? 'Review language suggestions, score rubric dimensions, and craft constructive teacher feedback.'
              : 'Inspect student feedback report, export text records, or prepare print summaries.'
          }
          onOpenStatusModal={() => setIsStatusModalOpen(true)}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          onResetSession={handleResetSession}
          showMarkingTools={currentStep === 'grade'}
          onCheck18086Status={handleCheck18086Status}
          isChecking18086={isChecking18086}
          markingModelHealth={markingModelHealth}
          onOpenBatchModal={() => setIsBatchModalOpen(true)}
          isBatchRunning={batchProgress?.status === 'running' || batchProgress?.status === 'stopping'}
        />

        {/* Step Panels */}
        {currentStep === 'prep' && (
          <PreparationPanel
            assignment={assignment}
            onChangeAssignment={handleChangeAssignment}
            onConfirmRequirements={handleConfirmRequirements}
            onNext={() => setCurrentStep('intake')}
            selectedClassId={selectedClassId}
          />
        )}

        {currentStep === 'intake' && (
          <ScanIntakePanel
            files={files}
            pages={pages}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
            onPrev={() => setCurrentStep('prep')}
            onNext={() => setCurrentStep('pair')}
          />
        )}

        {currentStep === 'pair' && (
          <StudentMatchingPanel
            pages={pages}
            classes={classes}
            selectedClassId={selectedClassId}
            students={students}
            studentPageCounts={studentPageCounts}
            selectedStudentIndices={selectedStudentIndices}
            appliedMatching={appliedMatching}
            matchingPreview={matchingPreview}
            viewMode={galleryViewMode}
            onSelectClass={(c) => setSelectedClassId(c)}
            onViewModeChange={(m) => setGalleryViewMode(m)}
            onPageCountChange={handlePageCountChange}
            onToggleSelectStudent={handleToggleSelectStudent}
            onToggleSelectAll={handleToggleSelectAll}
            onApplyBulkCounts={handleApplyBulkCounts}
            onApplyMatching={handleApplyMatching}
            onPrev={() => setCurrentStep('intake')}
            onNext={() => setCurrentStep('ocr')}
            matchingMode={matchingMode}
            onChangeMatchingMode={(m) => setMatchingMode(m)}
            recognitionResults={recognitionResults}
            isRecognizing={isRecognizing}
            recognizeProgress={recognizeProgress}
            onStartRecognition={handleStartRecognition}
            onCancelRecognition={handleCancelRecognition}
            onRetryRecognition={handleRetryRecognition}
            onManualAssignStudent={handleManualAssignStudent}
            templateRegions={assignment.templateRegions || []}
            onUpdatePageCustomRegions={handleUpdatePageCustomRegions}
          />
        )}

        {currentStep === 'ocr' && appliedMatching && (
          <TranscriptVerificationPanel
            students={students}
            pages={pages}
            appliedMatching={appliedMatching}
            activeStudentIndex={activeStudentIndex}
            transcripts={transcripts}
            assignment={assignment}
            onUpdateAssignmentSettings={handleUpdateTranscriptionSettings}
            onSelectStudent={(i) => setActiveStudentIndex(i)}
            onUpdateTranscriptText={handleUpdateTranscriptText}
            onVerifyTranscript={handleVerifyTranscript}
            onPrev={() => setCurrentStep('pair')}
            onNext={() => setCurrentStep('grade')}
            onNavigateToPreparation={handleNavigateToPreparation}
          />
        )}

        {currentStep === 'grade' && appliedMatching && (
          <MarkingReviewPanel
            pages={pages}
            transcripts={transcripts}
            students={students}
            appliedMatching={appliedMatching}
            activeStudentIndex={activeStudentIndex}
            rubric={assignment.rubric}
            markings={markings}
            isRequirementsConfirmed={assignment.isConfirmed}
            isTranscriptVerified={activeStudentTranscript?.isVerified ?? false}
            onSelectStudent={(i) => setActiveStudentIndex(i)}
            onUpdateScores={handleUpdateScores}
            onUpdateFeedback={handleUpdateFeedback}
            onAddFinding={handleAddFinding}
            onFindingDecision={handleFindingDecision}
            onDeleteFinding={handleDeleteFinding}
            onEditFinding={handleEditFinding}
            onApproveMarking={handleApproveMarking}
            onPrev={() => setCurrentStep('ocr')}
            onNext={() => setCurrentStep('report')}
            onRunAiMarking={handleRunAiMarking}
            isAiMarkingLoading={Boolean(activeStudent?.id && aiMarkingLoadingMap[activeStudent.id])}
            aiMarkingError={activeStudent?.id ? aiMarkingErrorMap[activeStudent.id] : null}
            onUpdateTranscriptText={handleUpdateTranscriptText}
            onUpdateFindings={handleUpdateFindings}
            isBatchRunning={batchProgress?.status === 'running' || batchProgress?.status === 'stopping'}
            markingModelHealth={markingModelHealth}
            batchProgress={batchProgress}
            onRequestStopBatch={handleRequestStopBatch}
            onResumeBatch={handleResumeBatch}
            onDismissBatchBanner={handleDismissBatchBanner}
          />
        )}

        {currentStep === 'report' && appliedMatching && (
          <ReportPanel
            assignment={assignment}
            students={students}
            appliedMatching={appliedMatching}
            activeStudentIndex={activeStudentIndex}
            rubric={assignment.rubric}
            transcripts={transcripts}
            markings={markings}
            onSelectStudent={(i) => setActiveStudentIndex(i)}
            onPrev={() => setCurrentStep('grade')}
          />
        )}
      </div>

      {/* Batch AI Marking Confirmation Modal */}
      {appliedMatching && (
        <BatchMarkingModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          onStartBatch={handleStartBatchMarking}
          students={students}
          appliedMatching={appliedMatching}
          transcripts={transcripts}
          markings={markings}
          pages={pages}
          markingModelHealth={markingModelHealth}
          onCheckModelStatus={handleCheck18086Status}
          isCheckingModel={isChecking18086}
        />
      )}

      {/* Service Status Modal */}
      <ServiceStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Help Guide Modal */}
      <WorkflowHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};

export default EssayMarkingPage;
