import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
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

  it('right-click plain text directly opens Add manual finding without intermediate menu', () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByText('They'));
    expect(screen.queryByText('Correct OCR text')).not.toBeInTheDocument();
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('They')).toBeInTheDocument();
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

  it('select text, right-click, add manual finding, save, and check inline display', () => {
    let addedFinding: any = null;

    const TestHost = () => {
      const [m, setM] = useState<Record<string, StudentMarkingState>>({
        s1: { studentId: 's1', scores: {}, feedbackComment: '', findings: [], isApproved: false },
      });
      return (
        <MarkingReviewPanel
          pages={pages}
          transcripts={transcripts}
          students={students}
          appliedMatching={appliedMatching}
          activeStudentIndex={0}
          rubric={rubric}
          markings={m}
          isRequirementsConfirmed={true}
          isTranscriptVerified={true}
          onSelectStudent={vi.fn()}
          onUpdateScores={vi.fn()}
          onUpdateFeedback={vi.fn()}
          onAddFinding={(studentId, finding) => {
            addedFinding = finding;
            const newF: MarkingFinding = {
              ...finding,
              id: 'f-123',
              decision: 'pending',
            };
            setM((prev) => ({
              ...prev,
              [studentId]: {
                ...prev[studentId],
                findings: [...prev[studentId].findings, newF],
              },
            }));
          }}
          onFindingDecision={vi.fn()}
          onDeleteFinding={vi.fn()}
          onApproveMarking={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );
    };

    render(<TestHost />);

    // Right-click "They"
    fireEvent.contextMenu(screen.getByText('They'));
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();

    // Fill replacement
    const replacementInput = screen.getByPlaceholderText(/例如：messes/i);
    fireEvent.change(replacementInput, { target: { value: 'We' } });

    // Click "儲存批改"
    fireEvent.click(screen.getByRole('button', { name: /儲存批改/i }));

    // Check if modal closed
    expect(screen.queryByText(/新增批改 \(Add Finding\)/i)).not.toBeInTheDocument();

    // Check if "We" is visible in the inline transcript!
    expect(screen.getByText('We')).toBeInTheDocument();
  });

  it('middle-of-line selection and second occurrence of repeated word anchors to the correct occurrence', () => {
    const repeatedTranscripts: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'They is running and she is walking.',
        editedText: 'They is running and she is walking.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
      },
    };

    let addedFinding: any = null;

    const TestHost = () => {
      const [m, setM] = useState<Record<string, StudentMarkingState>>({
        s1: { studentId: 's1', scores: {}, feedbackComment: '', findings: [], isApproved: false },
      });
      return (
        <MarkingReviewPanel
          pages={pages}
          transcripts={repeatedTranscripts}
          students={students}
          appliedMatching={appliedMatching}
          activeStudentIndex={0}
          rubric={rubric}
          markings={m}
          isRequirementsConfirmed={true}
          isTranscriptVerified={true}
          onSelectStudent={vi.fn()}
          onUpdateScores={vi.fn()}
          onUpdateFeedback={vi.fn()}
          onAddFinding={(studentId, finding) => {
            addedFinding = finding;
            const newF: MarkingFinding = {
              ...finding,
              id: 'f-second-is',
              decision: 'pending',
            };
            setM((prev) => ({
              ...prev,
              [studentId]: {
                ...prev[studentId],
                findings: [...prev[studentId].findings, newF],
              },
            }));
          }}
          onFindingDecision={vi.fn()}
          onDeleteFinding={vi.fn()}
          onApproveMarking={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );
    };

    render(<TestHost />);

    // In 'They is running and she is walking.', the elements with text 'is' are two spans.
    const isElements = screen.getAllByText('is');
    expect(isElements.length).toBe(2);

    // Right-click the SECOND 'is'
    fireEvent.contextMenu(isElements[1]);
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();

    // Fill replacement
    const replacementInput = screen.getByPlaceholderText(/例如：messes/i);
    fireEvent.change(replacementInput, { target: { value: 'was' } });

    // Click "儲存批改"
    fireEvent.click(screen.getByRole('button', { name: /儲存批改/i }));

    // Check if modal closed
    expect(screen.queryByText(/新增批改 \(Add Finding\)/i)).not.toBeInTheDocument();

    // Check what was added to onAddFinding
    console.log('Added finding for second is:', addedFinding);

    // Now, there should be one 'was' chip
    expect(screen.getByText('was')).toBeInTheDocument();

    // And the first 'is' should STILL be plain text 'is'
    const remainingIs = screen.getAllByText('is');
    // If it anchored to the first 'is', remainingIs[0] would have 'was' above it.
    // Let's check which 'is' has the finding chip!
    // Check which occurrence it anchored to!
    const lineTokens = document.querySelector('[data-line-tokens="0"]');
    console.log('Line tokens text content:', lineTokens?.textContent);
    
    // Find the text preceding 'was'
    // If it anchored to the first 'is', the tokens start with 'They' followed by the chip for 'is'
    // If it anchored to the second 'is', 'They is running and she ' precedes the chip!
    expect(lineTokens?.textContent).toContain('They is running and she');
    const wasChip = document.querySelector('[data-finding-id="f-second-is"]');
    expect(wasChip).toBeInTheDocument();
    expect(wasChip?.getAttribute('data-finding-original')).toBe('is');
    // Check if the chip is after "she"
    const fullText = lineTokens?.textContent || '';
    const indexShe = fullText.indexOf('she');
    const indexWas = fullText.indexOf('was');
    expect(indexWas).toBeGreaterThan(indexShe);
  });

  it('coexistence of manual finding with existing AI finding on the same line', () => {
    const existingAiFinding: MarkingFinding = {
      id: 'ai-finding-1',
      type: 'Spelling',
      feedbackType: 'correction',
      originalText: 'running',
      replacementText: 'jogging',
      lineIndex: 0,
      startIndex: 8,
      endIndex: 15,
      occurrenceIndex: 0,
      decision: 'pending',
      source: 'ai',
      isManual: false,
    };

    const TestHost = () => {
      const [m, setM] = useState<Record<string, StudentMarkingState>>({
        s1: {
          studentId: 's1',
          scores: {},
          feedbackComment: '',
          findings: [existingAiFinding],
          isApproved: false,
        },
      });
      return (
        <MarkingReviewPanel
          pages={pages}
          transcripts={{
            s1: {
              studentId: 's1',
              rawOcrText: 'They is running and she is walking.',
              editedText: 'They is running and she is walking.',
              isManuallyEntered: false,
              uncertainRegions: [],
              isVerified: true,
            },
          }}
          students={students}
          appliedMatching={appliedMatching}
          activeStudentIndex={0}
          rubric={rubric}
          markings={m}
          isRequirementsConfirmed={true}
          isTranscriptVerified={true}
          onSelectStudent={vi.fn()}
          onUpdateScores={vi.fn()}
          onUpdateFeedback={vi.fn()}
          onAddFinding={(studentId, finding) => {
            const newF: MarkingFinding = {
              ...finding,
              id: 'manual-walk',
              decision: 'pending',
            };
            setM((prev) => ({
              ...prev,
              [studentId]: {
                ...prev[studentId],
                findings: [...prev[studentId].findings, newF],
              },
            }));
          }}
          onFindingDecision={vi.fn()}
          onDeleteFinding={vi.fn()}
          onApproveMarking={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );
    };

    render(<TestHost />);

    // Existing AI finding "jogging" is rendered
    expect(screen.getByText('jogging')).toBeInTheDocument();

    // Select and right-click "walking"
    const walkSpan = screen.getByText('walking.');
    fireEvent.contextMenu(walkSpan);
    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();

    // Add correction for walking -> strolling
    const replacementInput = screen.getByPlaceholderText(/例如：messes/i);
    fireEvent.change(replacementInput, { target: { value: 'strolling' } });
    fireEvent.click(screen.getByRole('button', { name: /儲存批改/i }));

    // Both AI finding and manual finding coexist inline!
    expect(screen.getByText('jogging')).toBeInTheDocument();
    expect(screen.getByText('strolling')).toBeInTheDocument();
  });

  it('genuine unresolved anchors remain visible in review area with actionable reason', () => {
    // Finding quote does not exist anywhere in transcript
    const unanchoredFinding: MarkingFinding = {
      id: 'f-ghost',
      type: 'Grammar',
      feedbackType: 'correction',
      originalText: 'extraterrestrial',
      replacementText: 'alien',
      lineIndex: 0,
      decision: 'pending',
      source: 'teacher',
      isManual: true,
    };

    const TestHost = () => {
      const [m, setM] = useState<Record<string, StudentMarkingState>>({
        s1: {
          studentId: 's1',
          scores: {},
          feedbackComment: '',
          findings: [unanchoredFinding],
          isApproved: false,
        },
      });
      return (
        <MarkingReviewPanel
          pages={pages}
          transcripts={transcripts}
          students={students}
          appliedMatching={appliedMatching}
          activeStudentIndex={0}
          rubric={rubric}
          markings={m}
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
    };

    render(<TestHost />);

    // Unmatched section should be visible
    expect(screen.getByText(/Unmatched Suggestions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/extraterrestrial/i).length).toBeGreaterThanOrEqual(1);
    // Actionable reason must be displayed
    expect(screen.getByText(/無法在目前謄本文字中唯一定位/i)).toBeInTheDocument();
  });

  it('persistence/reload without duplication retains the finding at exact location', () => {
    const persistedFinding: MarkingFinding = {
      id: 'f-persisted-1',
      type: 'Tense',
      feedbackType: 'correction',
      originalText: 'is',
      replacementText: 'was',
      lineIndex: 0,
      paragraphIndex: 0,
      startIndex: 24,
      endIndex: 26,
      occurrenceIndex: 1,
      decision: 'pending',
      source: 'teacher',
      isManual: true,
    };

    const { rerender } = render(
      <MarkingReviewPanel
        pages={pages}
        transcripts={{
          s1: {
            studentId: 's1',
            rawOcrText: 'They is running and she is walking.',
            editedText: 'They is running and she is walking.',
            isManuallyEntered: false,
            uncertainRegions: [],
            isVerified: true,
          },
        }}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={rubric}
        markings={{
          s1: {
            studentId: 's1',
            scores: {},
            feedbackComment: '',
            findings: [persistedFinding],
            isApproved: false,
          },
        }}
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

    // Initial render displays chip at second 'is'
    expect(screen.getByText('was')).toBeInTheDocument();
    const lineTokens = document.querySelector('[data-line-tokens="0"]');
    expect(lineTokens?.textContent).toContain('They is running and she');

    // Simulate page reload / state rehydration with same persisted finding
    rerender(
      <MarkingReviewPanel
        pages={pages}
        transcripts={{
          s1: {
            studentId: 's1',
            rawOcrText: 'They is running and she is walking.',
            editedText: 'They is running and she is walking.',
            isManuallyEntered: false,
            uncertainRegions: [],
            isVerified: true,
          },
        }}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={rubric}
        markings={{
          s1: {
            studentId: 's1',
            scores: {},
            feedbackComment: '',
            findings: [persistedFinding],
            isApproved: false,
          },
        }}
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

    // Check no duplicate chips created
    const chips = document.querySelectorAll('[data-finding-id="f-persisted-1"]');
    expect(chips.length).toBe(1);
    expect(screen.getAllByText('was').length).toBe(1);
  });
});



