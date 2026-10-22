import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkingReviewPanel } from '@/modules/essay-marking/components/MarkingReviewPanel';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  RubricDimension,
  ScanPage,
  StudentTranscriptState,
} from '@/modules/essay-marking/types';

describe('right-click context menu regression', () => {
  const students: StudentRosterItem[] = [
    { id: 's1', displayName: 'Alice', classNumber: 1, className: '4B' },
  ];
  const pages: ScanPage[] = [
    { id: 'p1', fileId: 'f1', fileName: 'scan.png', sourcePageNumber: 1, previewUrl: 'blob:x', orderIndex: 0 },
  ];
  const appliedMatching: AppliedMatching = {
    classId: '4B',
    counts: [1],
    map: [{ studentIndex: 0, studentId: 's1', studentName: 'Alice', classNumber: 1, part: 1, total: 1 }],
    assignedStudentIndices: [0],
    mode: 'sequential',
  };
  const rubric: RubricDimension[] = [{ id: 'content', name: 'Content', maxScore: 40 }];
  const transcripts: Record<string, StudentTranscriptState> = {
    s1: {
      studentId: 's1',
      rawOcrText: 'They is running in the park.',
      editedText: 'They is running in the park.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
    },
  };
  const markings: Record<string, StudentMarkingState> = {
    s1: { studentId: 's1', scores: {}, feedbackComment: '', findings: [], isApproved: false },
  };

  const renderPanel = (markingsOverride?: Record<string, StudentMarkingState>) =>
    render(
      <MarkingReviewPanel
        pages={pages}
        transcripts={transcripts}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={rubric}
        markings={markingsOverride || markings}
        isRequirementsConfirmed={true}
        isTranscriptVerified={true}
        onSelectStudent={vi.fn()}
        onUpdateScores={vi.fn()}
        onUpdateFeedback={vi.fn()}
        onAddFinding={vi.fn()}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onApproveMarking={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

  it('right-click plain text opens the context menu and executes Add manual finding', () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByText('They'));
    expect(screen.getByText('Correct OCR text')).toBeInTheDocument();
    expect(screen.getByText('Add manual finding')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add manual finding'));
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();
  });

  it('right-click marked source text offers Correct OCR source text and opens the correction editor', () => {
    const findingsMarking: Record<string, StudentMarkingState> = {
      s1: {
        studentId: 's1',
        scores: {},
        feedbackComment: '',
        findings: [
          {
            id: 'f-is',
            type: 'Grammar',
            originalText: 'is',
            replacementText: 'are',
            explanation: 'Subject-verb agreement',
            decision: 'pending',
            lineIndex: 0,
            paragraphIndex: 0,
          },
        ],
        isApproved: false,
      },
    };
    renderPanel(findingsMarking);

    // The finding chip renders the source word "is".
    fireEvent.contextMenu(screen.getByText('is'));
    expect(screen.getByText('Correct OCR source text')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Correct OCR source text'));
    // Correction editor opens with an Apply button and the prefilled source text.
    expect(screen.getByText('Apply correction')).toBeInTheDocument();
    expect(screen.getByDisplayValue('is')).toBeInTheDocument();
  });
});
