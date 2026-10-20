import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineMarkingView } from '@/modules/essay-marking/components/InlineMarkingView';
import { MarkingFinding } from '@/modules/essay-marking/types';

describe('InlineMarkingView Component Tests', () => {
  const sampleTranscript = `One time he save the city.
He mess with the bad guys.
And he have many firend.`;

  const sampleFindings: MarkingFinding[] = [
    {
      id: 'f-save',
      type: 'Tense',
      originalText: 'save',
      replacementText: 'saved',
      explanation: 'Use past tense for completed action.',
      decision: 'pending',
      lineIndex: 0,
      paragraphIndex: 0,
    },
    {
      id: 'f-mess',
      type: 'Grammar',
      originalText: 'mess',
      replacementText: 'messes',
      explanation: 'Subject-verb agreement: third-person singular.',
      decision: 'pending',
      lineIndex: 1,
      paragraphIndex: 0,
    },
    {
      id: 'f-firend',
      type: 'Spelling',
      originalText: 'firend',
      replacementText: 'friends',
      explanation: 'Spelling and plural form.',
      decision: 'pending',
      lineIndex: 2,
      paragraphIndex: 0,
    },
  ];

  it('renders full text with source line numbers and inline markings', () => {
    const onFindingDecision = vi.fn();
    const onDeleteFinding = vi.fn();

    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={onFindingDecision}
        onDeleteFinding={onDeleteFinding}
      />
    );

    // Verify source line numbers
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Verify individual words are rendered as distinct elements for word-level interaction
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('time')).toBeInTheDocument();
    expect(screen.getAllByText('he').length).toBe(2);
    expect(screen.getAllByText('the').length).toBe(2);
    expect(screen.getByText('city.')).toBeInTheDocument();

    // Verify red strikethrough errors and green suggestions
    expect(screen.getByText('save')).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();
    expect(screen.getByText('mess')).toBeInTheDocument();
    expect(screen.getByText('messes')).toBeInTheDocument();
    expect(screen.getByText('firend')).toBeInTheDocument();
    expect(screen.getByText('friends')).toBeInTheDocument();
  });

  it('selects an individual word and highlights it with ring styling without selecting the whole line', () => {
    const onSelectWord = vi.fn();
    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onSelectWord={onSelectWord}
        selectedWordTarget={{ lineIndex: 0, wordIndex: 1, text: 'time' }}
      />
    );

    // The selected word 'time' should have the purple selection classes
    const timeWord = screen.getByText('time');
    expect(timeWord).toHaveClass('ring-2');
    expect(timeWord).toHaveClass('ring-purple-600');
    expect(timeWord).toHaveClass('bg-purple-200');

    // Other words on the same line (like 'One') must NOT have selection styling
    const oneWord = screen.getByText('One');
    expect(oneWord).not.toHaveClass('ring-purple-600');
    expect(oneWord).not.toHaveClass('bg-purple-200');

    // Clicking a word triggers onSelectWord with precise lineIndex and wordIndex
    fireEvent.click(oneWord);
    expect(onSelectWord).toHaveBeenCalledWith({
      lineIndex: 0,
      wordIndex: 0,
      text: 'One',
    });
  });

  it('disambiguates repeated words across lines and preserves precise occurrence mapping', () => {
    const onSelectWord = vi.fn();
    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onSelectWord={onSelectWord}
        // Select the second occurrence of 'he' on line 3 (index 2), wordIndex 1
        selectedWordTarget={{ lineIndex: 2, wordIndex: 1, text: 'he' }}
      />
    );

    const heInstances = screen.getAllByText('he');
    expect(heInstances.length).toBe(2);

    // First instance (Line 1) should NOT be selected
    expect(heInstances[0]).not.toHaveClass('ring-purple-600');
    // Second instance (Line 3) MUST be highlighted
    expect(heInstances[1]).toHaveClass('ring-purple-600');
    expect(heInstances[1]).toHaveClass('bg-purple-200');

    // Clicking the first instance of 'he' selects Line 1, Word 2
    fireEvent.click(heInstances[0]);
    expect(onSelectWord).toHaveBeenCalledWith({
      lineIndex: 0,
      wordIndex: 2,
      text: 'he',
    });
  });

  it('displays tooltip on hover over marking', () => {
    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    const saveElement = screen.getByText('save');
    fireEvent.mouseEnter(saveElement);

    // Tooltip should display error category and explanation
    expect(screen.getByText('Use past tense for completed action.')).toBeInTheDocument();
  });

  it('opens action popover on click and supports accepting finding', () => {
    const onFindingDecision = vi.fn();
    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={onFindingDecision}
        onDeleteFinding={vi.fn()}
      />
    );

    const saveElement = screen.getByText('save');
    fireEvent.click(saveElement);

    // Click Accept button
    const acceptBtn = screen.getByRole('button', { name: /^Accept$/i });
    expect(acceptBtn).toBeInTheDocument();
    fireEvent.click(acceptBtn);

    expect(onFindingDecision).toHaveBeenCalledWith('std-1', 'f-save', 'accepted');
  });

  it('opens action popover on click and supports rejecting finding', () => {
    const onFindingDecision = vi.fn();
    render(
      <InlineMarkingView
        transcript={sampleTranscript}
        findings={sampleFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={onFindingDecision}
        onDeleteFinding={vi.fn()}
      />
    );

    const messElement = screen.getByText('mess');
    fireEvent.click(messElement);

    // Click Reject button
    const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
    expect(rejectBtn).toBeInTheDocument();
    fireEvent.click(rejectBtn);

    expect(onFindingDecision).toHaveBeenCalledWith('std-1', 'f-mess', 'rejected');
  });

  it('renders rejected finding as normal text without red/green markings when showRejected is false', () => {
    const rejectedFindings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        explanation: 'Use past tense',
        decision: 'rejected',
        lineIndex: 0,
      },
    ];

    render(
      <InlineMarkingView
        transcript="He save the day."
        findings={rejectedFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // "save" should be rendered as plain text
    expect(screen.getByText('save')).toBeInTheDocument();
    // "saved" green suggestion should NOT be present
    expect(screen.queryByText('saved')).not.toBeInTheDocument();
  });

  it('displays edited custom teacher replacement text immediately', () => {
    const editedFindings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        teacherCustomText: 'rescued',
        explanation: 'Teacher prefers rescued',
        decision: 'edited',
        lineIndex: 0,
      },
    ];

    render(
      <InlineMarkingView
        transcript="He save the day."
        findings={editedFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    expect(screen.getByText('save')).toBeInTheDocument();
    expect(screen.getByText('rescued')).toBeInTheDocument();
  });

  it('places ambiguous unlocatable findings in the collapsible Unmatched section', () => {
    const ambiguousFindings: MarkingFinding[] = [
      {
        id: 'f-ambiguous',
        type: 'Vocabulary',
        originalText: 'super',
        replacementText: 'great',
        explanation: 'Word choice',
        decision: 'pending',
      },
    ];

    render(
      <InlineMarkingView
        transcript={"super hero.\nHe is super."}
        findings={ambiguousFindings}
        studentId="std-1"
        studentName="John Doe"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
      />
    );

    // Should indicate 1 unmatched suggestion
    expect(screen.getByText(/Unmatched Suggestions \/ 未能定位建議 \(1\)/i)).toBeInTheDocument();
  });
});
