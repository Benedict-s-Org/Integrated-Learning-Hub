import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from './types';
import {
  computeMatchingPreview,
  applyBulkPageCounts,
  isMatchingDirty,
} from './utils/matchingLogic';
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

export const EssayMarkingPage: React.FC = () => {
  // Navigation / Workflow Step
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('prep');

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Step 1: Preparation State
  const [assignment, setAssignment] = useState<AssignmentConfig>({
    title: 'P3 Writing 01 · A Day at the Park',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'worksheet',
    scopePrompt:
      'Write about a day at the park. Write 60–80 words. Include who you went with, what you did, and how you felt.',
    isConfirmed: false,
    rubric: DEFAULT_RUBRIC,
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

  // Active student in Steps 4, 5, 6
  const [activeStudentIndex, setActiveStudentIndex] = useState<number>(0);

  // Step 4: Transcripts State (keyed by studentId)
  const [transcripts, setTranscripts] = useState<
    Record<string, StudentTranscriptState>
  >({});

  // Step 5: Markings State (keyed by studentId)
  const [markings, setMarkings] = useState<Record<string, StudentMarkingState>>({});

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

        const rows = (data || []) as Array<{ class: string | null }>;
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

  // Fetch Students when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setStudentPageCounts([]);
      setSelectedStudentIndices(new Set());
      return;
    }

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

        const userRows = (data || []) as Array<{
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
        // Default each student to 1 page
        setStudentPageCounts(roster.map(() => 1));
        setSelectedStudentIndices(new Set());
        // Invalidate applied matching if class changes
        setAppliedMatching(null);
      } catch (err) {
        console.error('Failed to load class students:', err);
      }
    };

    fetchStudents();
  }, [selectedClassId]);

  // Compute matching preview
  const matchingPreview = useMemo(() => {
    return computeMatchingPreview(students, studentPageCounts, pages.length);
  }, [students, studentPageCounts, pages.length]);

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
      // Re-index remaining pages
      return remaining.map((p, idx) => ({ ...p, orderIndex: idx }));
    });
    setAppliedMatching(null);
    invalidateDownstream();
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
    if (
      !selectedClassId ||
      pages.length === 0 ||
      matchingPreview.extra > 0 ||
      matchingPreview.missing > 0
    ) {
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
    });

    if (assignedIndices.length > 0) {
      setActiveStudentIndex(assignedIndices[0]);
    }

    invalidateDownstream();
  };

  // Step 4: Transcript Verification Handlers
  const handleUpdateTranscriptText = (studentId: string, text: string) => {
    setTranscripts((prev) => ({
      ...prev,
      [studentId]: {
        studentId,
        rawOcrText: prev[studentId]?.rawOcrText || null,
        editedText: text,
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
  const handleResetSession = () => {
    if (
      window.confirm(
        'Are you sure you want to reset this marking session? All loaded scans, transcripts, and marking drafts will be cleared.'
      )
    ) {
      setAssignment({
        title: 'P3 Writing 01 · A Day at the Park',
        worksheetFileName: null,
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt:
          'Write about a day at the park. Write 60–80 words. Include who you went with, what you did, and how you felt.',
        isConfirmed: false,
        rubric: DEFAULT_RUBRIC,
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
      setCurrentStep('prep');
    }
  };

  const activeStudent = students[activeStudentIndex];
  const activeStudentTranscript = activeStudent
    ? transcripts[activeStudent.id]
    : undefined;

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col">
      {/* Top Workflow Stepper */}
      <WorkflowStepper
        currentStep={currentStep}
        onStepChange={(step) => setCurrentStep(step)}
        canNavigateTo={canNavigateTo}
      />

      {/* Main Workspace Surface */}
      <div className="flex-1 w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8">
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
        />

        {/* Step Panels */}
        {currentStep === 'prep' && (
          <PreparationPanel
            assignment={assignment}
            onChangeAssignment={handleChangeAssignment}
            onConfirmRequirements={handleConfirmRequirements}
            onNext={() => setCurrentStep('intake')}
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
          />
        )}

        {currentStep === 'ocr' && appliedMatching && (
          <TranscriptVerificationPanel
            students={students}
            pages={pages}
            appliedMatching={appliedMatching}
            activeStudentIndex={activeStudentIndex}
            transcripts={transcripts}
            onSelectStudent={(i) => setActiveStudentIndex(i)}
            onUpdateTranscriptText={handleUpdateTranscriptText}
            onVerifyTranscript={handleVerifyTranscript}
            onPrev={() => setCurrentStep('pair')}
            onNext={() => setCurrentStep('grade')}
          />
        )}

        {currentStep === 'grade' && appliedMatching && (
          <MarkingReviewPanel
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
            onApproveMarking={handleApproveMarking}
            onPrev={() => setCurrentStep('ocr')}
            onNext={() => setCurrentStep('report')}
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
