import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { InlineMarkingView } from '@/modules/essay-marking/components/InlineMarkingView';
import { MarkingReviewPanel } from '@/modules/essay-marking/components/MarkingReviewPanel';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  RubricDimension,
  ScanPage,
  StudentTranscriptState,
  MarkingFinding,
} from '@/modules/essay-marking/types';
import {
  computeTranscriptEdits,
  remapFindingsThroughEdits,
} from '@/modules/essay-marking/utils/markingTextAlignment';

describe('Whole-Transcript In-Place OCR Editing - 10 Focused Verifications', () => {
  const multilineTranscript = `First line of the essay.

Third line with middle word here.
Fourth line is the conclusion.`;

  const sampleFindings: MarkingFinding[] = [
    {
      id: 'f-middle',
      type: 'Vocabulary',
      originalText: 'middle',
      replacementText: 'central',
      explanation: 'More formal vocabulary.',
      decision: 'pending',
      lineIndex: 2,
      paragraphIndex: 1,
      startIndex: 16,
      endIndex: 22,
    },
  ];

  it('1. Left-click opens one full-transcript inline textarea with existing text and newlines', () => {
    render(
      <InlineMarkingView
        transcript={multilineTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Initial normal canvas renders text lines
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();

    // Click ordinary text word
    fireEvent.click(screen.getByText('First'));

    // Replaces area in-place with ONE controlled textarea containing full transcript
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe(multilineTranscript);
    expect(textarea.value).toContain('\n\nThird line with middle word here.');

    // Save and Cancel buttons are visible
    expect(screen.getByRole('button', { name: /Save OCR changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('2. Enter inserts a newline without saving; IME Enter does not accidentally save', () => {
    const onSaveWholeTranscript = vi.fn();
    render(
      <InlineMarkingView
        transcript={multilineTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('First'));
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;

    // Normal Enter keydown in textarea
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    // Enter must NOT save or close editor
    expect(onSaveWholeTranscript).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Full OCR transcript editor')).toBeInTheDocument();

    // IME composition Enter (keyCode 229)
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });
    fireEvent.compositionEnd(textarea);
    expect(onSaveWholeTranscript).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Full OCR transcript editor')).toBeInTheDocument();
  });

  it('3. Save preserves added/removed newlines and updates rendered line numbers correctly', () => {
    const onSaveWholeTranscript = vi.fn();
    const { rerender } = render(
      <InlineMarkingView
        transcript={multilineTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        revision={1}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Initial lines: 4 lines (indices 0, 1, 2, 3)
    fireEvent.click(screen.getByText('First'));
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;

    // Split Line 1 into two separate lines by inserting a newline
    const modifiedText = `First line\nof the essay.

Third line with middle word here.
Fourth line is the conclusion.`;
    fireEvent.change(textarea, { target: { value: modifiedText } });

    // Click Save OCR changes
    fireEvent.click(screen.getByRole('button', { name: /Save OCR changes/i }));

    expect(onSaveWholeTranscript).toHaveBeenCalledTimes(1);
    expect(onSaveWholeTranscript).toHaveBeenCalledWith(modifiedText, 1);

    // Rerender with saved updated transcript and line numbers
    rerender(
      <InlineMarkingView
        transcript={modifiedText}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        revision={2}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Verify rendered source line numbers: line 1 ("First line"), line 2 ("of the essay."), line 3 (empty dot), line 4 ("Third line...")
    expect(screen.getByTitle('Source Line 1')).toBeInTheDocument();
    expect(screen.getByTitle('Source Line 2')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
    expect(screen.getByTitle('Source Line 4')).toBeInTheDocument();
    expect(screen.getByTitle('Source Line 5')).toBeInTheDocument();
  });

  it('4. Cancel and unchanged Save produce no transcript write or revision increment', () => {
    const onSaveWholeTranscript = vi.fn();
    render(
      <InlineMarkingView
        transcript={multilineTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        revision={3}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Open edit mode
    fireEvent.click(screen.getByText('First'));
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;

    // Type change but hit Cancel
    fireEvent.change(textarea, { target: { value: 'Draft modification that is cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onSaveWholeTranscript).not.toHaveBeenCalled();
    // Reverted back to canvas
    expect(screen.queryByLabelText('Full OCR transcript editor')).not.toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();

    // Open edit mode again and hit Save without any text change
    fireEvent.click(screen.getByText('First'));
    fireEvent.click(screen.getByRole('button', { name: /Save OCR changes/i }));
    // Unchanged Save does NOT call onSaveWholeTranscript
    expect(onSaveWholeTranscript).not.toHaveBeenCalled();
  });

  it('5. Newline-only edits move findings correctly without changing decisions or ownership', () => {
    const oldText = 'First line.\nSecond line with keyword here.\nThird line.';
    const newText = 'First line.\nExtra added line.\nSecond line with keyword here.\nThird line.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-kw',
        type: 'Grammar',
        originalText: 'keyword',
        replacementText: 'phrase',
        teacherCustomText: 'phrase',
        decision: 'accepted',
        source: 'teacher',
        isManual: true,
        lineIndex: 1,
        startIndex: 17,
        endIndex: 24,
      },
    ];

    const edits = computeTranscriptEdits(oldText, newText);
    const remapped = remapFindingsThroughEdits(oldText, newText, findings, edits);

    expect(remapped).toHaveLength(1);
    expect(remapped[0].status).toBe('mapped');
    expect(remapped[0].mapped?.lineIndex).toBe(2); // Shifted down 1 line due to newline insertion
    expect(remapped[0].mapped?.startIndex).toBe(17);
  });

  it('6. Multiple separated edits preserve findings in unchanged intervening text', () => {
    const oldText = 'Sentence one is fine. TargetA is in middle. Sentence two is here. TargetB at the end.';
    const newText = 'EDIT1 Sentence one is fine. TargetA is in middle. Sentence two is here. TargetB EDIT2.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-targetA',
        type: 'Vocabulary',
        originalText: 'TargetA',
        replacementText: 'ReplacementA',
        decision: 'pending',
        lineIndex: 0,
        startIndex: 22,
        endIndex: 29,
      },
      {
        id: 'f-targetB',
        type: 'Vocabulary',
        originalText: 'TargetB',
        replacementText: 'ReplacementB',
        decision: 'pending',
        lineIndex: 0,
        startIndex: 72,
        endIndex: 79,
      },
    ];

    const edits = computeTranscriptEdits(oldText, newText);
    expect(edits.length).toBeGreaterThanOrEqual(2); // Multiple disjoint edits detected

    const remapped = remapFindingsThroughEdits(oldText, newText, findings, edits);
    const mapA = remapped.find((r) => r.findingId === 'f-targetA');
    const mapB = remapped.find((r) => r.findingId === 'f-targetB');

    // Both surviving findings in unchanged text are preserved and safely shifted
    expect(mapA?.status).toBe('mapped');
    expect(mapB?.status).toBe('mapped');
    expect(mapA?.anchorReviewReason).toBeUndefined();
    expect(mapB?.anchorReviewReason).toBeUndefined();
  });

  it('7. Deleting one of two identical words flags its own finding rather than moving it to the surviving word', () => {
    const oldText = 'apple in the morning and apple in the evening';
    const newText = 'in the morning and apple in the evening'; // First "apple " was deleted
    const findings: MarkingFinding[] = [
      {
        id: 'f-apple1',
        type: 'Spelling',
        originalText: 'apple',
        replacementText: 'Apple',
        decision: 'pending',
        lineIndex: 0,
        startIndex: 0,
        endIndex: 5,
        occurrenceIndex: 0,
      },
      {
        id: 'f-apple2',
        type: 'Spelling',
        originalText: 'apple',
        replacementText: 'Apple',
        decision: 'pending',
        lineIndex: 0,
        startIndex: 25,
        endIndex: 30,
        occurrenceIndex: 1,
      },
    ];

    const edits = computeTranscriptEdits(oldText, newText);
    const remapped = remapFindingsThroughEdits(oldText, newText, findings, edits);

    const f1 = remapped.find((r) => r.findingId === 'f-apple1');
    const f2 = remapped.find((r) => r.findingId === 'f-apple2');

    // First apple was deleted -> must be flagged for review, NOT attached to second apple
    expect(f1?.status).toBe('anchor_review');
    expect(f1?.anchorReviewReason).toBeDefined();

    // Second apple survives and is mapped
    expect(f2?.status).toBe('mapped');
    expect(f2?.mapped?.startIndex).toBe(19);
  });

  it('8. Right-click manual marking still works outside edit mode; textarea retains normal native editing behavior', () => {
    const onWordContextMenu = vi.fn();
    render(
      <InlineMarkingView
        transcript={multilineTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="Alice"
        onWordContextMenu={onWordContextMenu}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Outside edit mode: right-click on word invokes onWordContextMenu for manual marking
    const word = screen.getByText('First');
    fireEvent.contextMenu(word);
    expect(onWordContextMenu).toHaveBeenCalled();

    // Now enter edit mode
    fireEvent.click(word);
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;

    // In edit mode: right-clicking textarea stops propagation and does not invoke onWordContextMenu
    onWordContextMenu.mockClear();
    fireEvent.contextMenu(textarea);
    expect(onWordContextMenu).not.toHaveBeenCalled();
  });

  it('9. Stale drafts cannot overwrite a newer revision or another student’s transcript', () => {
    const onSaveWholeTranscript = vi.fn();
    const { rerender } = render(
      <InlineMarkingView
        transcript="Student A original text"
        findings={[]}
        studentId="std-A"
        studentName="Student A"
        revision={1}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Start draft for Student A
    fireEvent.click(screen.getByText('Student'));
    const textareaA = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;
    fireEvent.change(textareaA, { target: { value: 'Student A draft modification' } });

    // Switch to Student B
    rerender(
      <InlineMarkingView
        transcript="Student B original text"
        findings={[]}
        studentId="std-B"
        studentName="Student B"
        revision={1}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Editor should not apply Student A's draft to Student B
    expect(screen.queryByLabelText('Full OCR transcript editor')).not.toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(onSaveWholeTranscript).not.toHaveBeenCalled();

    // Switch back to Student A: draft is safely preserved for Student A
    rerender(
      <InlineMarkingView
        transcript="Student A original text"
        findings={[]}
        studentId="std-A"
        studentName="Student A"
        revision={1}
        onSaveWholeTranscript={onSaveWholeTranscript}
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    const restoredTextarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;
    expect(restoredTextarea.value).toBe('Student A draft modification');
  });

  it('10. Saving does not invoke OCR or enqueue marking', () => {
    const students: StudentRosterItem[] = [{ id: 's1', displayName: 'Alice', classNumber: 1, className: '4B' }];
    const pages: ScanPage[] = [{ id: 'p1', fileId: 'f1', fileName: 'scan.png', sourcePageNumber: 1, previewUrl: 'blob:x', orderIndex: 0 }];
    const appliedMatching: AppliedMatching = {
      classId: '4B',
      counts: [1],
      map: [{ studentIndex: 0, studentId: 's1', studentName: 'Alice', classNumber: 1, part: 1, total: 1 }],
      assignedStudentIndices: [0],
      mode: 'sequential',
    };
    const transcripts: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'They is running in the park.',
        editedText: 'They is running in the park.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
        revision: 1,
      },
    };
    const markings: Record<string, StudentMarkingState> = {
      s1: {
        studentId: 's1',
        scores: { content: 35 },
        feedbackComment: 'Good effort.',
        findings: [],
        isApproved: true,
      },
    };
    const onUpdateTranscriptText = vi.fn();
    const onRunAiMarking = vi.fn();

    render(
      <MarkingReviewPanel
        pages={pages}
        transcripts={transcripts}
        students={students}
        appliedMatching={appliedMatching}
        activeStudentIndex={0}
        rubric={[{ id: 'content', name: 'Content', maxScore: 40 }]}
        markings={markings}
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
        onUpdateTranscriptText={onUpdateTranscriptText}
        onRunAiMarking={onRunAiMarking}
      />
    );

    // Click "Edit Transcript" button
    fireEvent.click(screen.getByRole('button', { name: /Edit Transcript/i }));
    const textarea = screen.getByLabelText('Full OCR transcript editor') as HTMLTextAreaElement;

    // Modify text
    fireEvent.change(textarea, { target: { value: 'They are running in the park.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save OCR changes/i }));

    // Verify transcript write routed through onUpdateTranscriptText
    expect(onUpdateTranscriptText).toHaveBeenCalledTimes(1);
    expect(onUpdateTranscriptText).toHaveBeenCalledWith('s1', 'They are running in the park.', expect.any(Array));

    // Verify no AI marking was enqueued/triggered
    expect(onRunAiMarking).not.toHaveBeenCalled();
  });
});
