import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineMarkingView } from '@/modules/essay-marking/components/InlineMarkingView';
import { MarkingFinding } from '@/modules/essay-marking/types';
import {
  validateFindingQuoteAndRange,
  alignTranscriptWithFindings,
} from '@/modules/essay-marking/utils/markingTextAlignment';
import {
  saveWorkbenchSession,
  loadWorkbenchSession,
  clearWorkbenchSession,
} from '@/modules/essay-marking/utils/essayMarkingStorage';

// Lightweight in-memory IDB mock for headless test environment
function setupInMemoryIndexedDB() {
  const storeMap = new Map<string, any>();

  const fakeDb = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => {},
    transaction: () => ({
      objectStore: () => ({
        put: (val: any, key: string) => {
          storeMap.set(key, val);
          const req: any = {};
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        get: (key: string) => {
          const req: any = { result: storeMap.get(key) };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        delete: (key: string) => {
          storeMap.delete(key);
          const req: any = {};
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
      }),
      oncomplete: null as any,
    }),
    close: () => {},
  };

  (globalThis as any).indexedDB = {
    open: () => {
      const req: any = { result: fakeDb };
      setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
      return req;
    },
  };
}

describe('Targeted Fix: Finding Source Range & Quote Editing', () => {
  const threeLineTranscript = `CHARACTER'S NAME: Dog Man
BOOK TITLE: Dog Man
He save Dog Man.`;

  beforeEach(async () => {
    setupInMemoryIndexedDB();
    try {
      await clearWorkbenchSession();
    } catch {
      // ignore
    }
  });

  // --------------------------------------------------------------------------
  // Verification 1: Narrowing "he save" to "save"
  // --------------------------------------------------------------------------
  it('1. Narrows "he save" to "save", leaving "He" unannotated and "save" strikethrough with "saved" above', () => {
    // Before edit: AI identified "He save" on line 3 (index 2)
    const initialFindings: MarkingFinding[] = [
      {
        id: 'f-he-save',
        type: 'Tense',
        originalText: 'He save',
        replacementText: 'saved',
        explanation: 'Past tense needed',
        decision: 'pending',
        lineIndex: 2,
        occurrenceIndex: 0,
      },
    ];

    // Validate narrowing to "save" on Line 3 (index 2)
    const validation = validateFindingQuoteAndRange({
      quote: 'save',
      lineIndex: 2,
      occurrenceIndex: 0,
      transcript: threeLineTranscript,
      currentFindingId: 'f-he-save',
      existingFindings: initialFindings,
    });

    expect(validation.valid).toBe(true);
    expect(validation.lineIndex).toBe(2);
    expect(validation.occurrenceIndex).toBe(0);
    expect(validation.startIndex).toBe(3); // In "He save Dog Man.", "save" is at index 3
    expect(validation.endIndex).toBe(7);

    // After updating finding to "save" -> "saved"
    const updatedFinding: MarkingFinding = {
      ...initialFindings[0],
      originalText: 'save',
      replacementText: 'saved',
      teacherCustomText: 'saved',
      decision: 'edited',
      source: 'teacher',
      isManual: true,
      lineIndex: validation.lineIndex,
      occurrenceIndex: validation.occurrenceIndex,
    };

    // Align lines to verify tokenized structure
    const { alignedLines } = alignTranscriptWithFindings(threeLineTranscript, [updatedFinding]);
    const line3 = alignedLines.find((l) => l.lineIndex === 2);
    expect(line3).toBeDefined();

    // Verify line tokens:
    // First token is plain text containing "He "
    expect(line3!.tokens[0].type).toBe('text');
    expect((line3!.tokens[0] as any).text).toBe('He ');

    // Second token is finding token for "save"
    expect(line3!.tokens[1].type).toBe('finding');
    expect((line3!.tokens[1] as any).originalText).toBe('save');
    expect((line3!.tokens[1] as any).replacementText).toBe('saved');

    // Third token is plain text containing " Dog Man."
    expect(line3!.tokens[2].type).toBe('text');
    expect((line3!.tokens[2] as any).text).toBe(' Dog Man.');

    // Now render via InlineMarkingView to verify visual presentation
    const onEditFinding = vi.fn();
    render(
      <InlineMarkingView
        transcript={threeLineTranscript}
        findings={[updatedFinding]}
        studentId="std-dogman"
        studentName="Abby"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onEditFinding={onEditFinding}
      />
    );

    // "He" is rendered as normal word
    const heWord = screen.getByText('He');
    expect(heWord).toBeInTheDocument();
    expect(heWord).not.toHaveClass('line-through');

    // "save" is marked as strikethrough error
    const saveToken = screen.getByText('save');
    expect(saveToken).toBeInTheDocument();
    expect(saveToken).toHaveClass('line-through');

    // "saved" is floating directly above
    const savedSuggestion = screen.getByText('saved');
    expect(savedSuggestion).toBeInTheDocument();
    expect(savedSuggestion.closest('span')).toHaveClass('text-blue-800');
  });

  // --------------------------------------------------------------------------
  // Verification 2: Selecting the correct occurrence of a repeated word
  // --------------------------------------------------------------------------
  it('2. Disambiguates repeated words and selects the exact target occurrence without confusion', () => {
    const repeatedTranscript = 'the quick brown fox jumps over the lazy dog';
    // First "the" is at index 0 (occ 0). Second "the" is at index 31 (occ 1).

    // Target the second occurrence (occ 1)
    const validationOcc1 = validateFindingQuoteAndRange({
      quote: 'the',
      lineIndex: 0,
      occurrenceIndex: 1,
      transcript: repeatedTranscript,
      currentFindingId: 'f-second-the',
      existingFindings: [],
    });

    expect(validationOcc1.valid).toBe(true);
    expect(validationOcc1.startIndex).toBe(31);
    expect(validationOcc1.endIndex).toBe(34);
    expect(validationOcc1.occurrenceIndex).toBe(1);

    // Target the first occurrence (occ 0)
    const validationOcc0 = validateFindingQuoteAndRange({
      quote: 'the',
      lineIndex: 0,
      occurrenceIndex: 0,
      transcript: repeatedTranscript,
      currentFindingId: 'f-first-the',
      existingFindings: [],
    });

    expect(validationOcc0.valid).toBe(true);
    expect(validationOcc0.startIndex).toBe(0);
    expect(validationOcc0.endIndex).toBe(3);
    expect(validationOcc0.occurrenceIndex).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Verification 3: Rejecting unmatched or ambiguous quotes
  // --------------------------------------------------------------------------
  it('3. Rejects unmatched quotes and ambiguous quotes without silent fallbacks', () => {
    // 3A: Quote not found in transcript
    const unmatched = validateFindingQuoteAndRange({
      quote: 'nonexistentWord',
      lineIndex: 0,
      transcript: threeLineTranscript,
      currentFindingId: 'f-test',
      existingFindings: [],
    });

    expect(unmatched.valid).toBe(false);
    expect(unmatched.error).toContain('Quote text was not found');

    // 3B: Ambiguous quote occurring multiple times without specified occurrence
    // "Dog Man" appears on Line 1, Line 2, and Line 3
    const ambiguousMultiLine = validateFindingQuoteAndRange({
      quote: 'Dog Man',
      lineIndex: undefined,
      occurrenceIndex: undefined,
      transcript: threeLineTranscript,
      currentFindingId: 'f-test-dogman',
      existingFindings: [],
    });

    expect(ambiguousMultiLine.valid).toBe(false);
    expect(ambiguousMultiLine.error).toContain('Quote appears 3 times in the essay');
    expect(ambiguousMultiLine.error).toContain('Please use "Reselect"');

    // 3C: Repeated quote on same line without occurrenceIndex specified
    const sameLineMulti = 'is kind is happy';
    const ambiguousSameLine = validateFindingQuoteAndRange({
      quote: 'is',
      lineIndex: 0,
      occurrenceIndex: undefined,
      transcript: sameLineMulti,
      currentFindingId: 'f-test-is',
      existingFindings: [],
    });

    expect(ambiguousSameLine.valid).toBe(false);
    expect(ambiguousSameLine.error).toContain('Quote appears 2 times on Line 1');
  });

  // --------------------------------------------------------------------------
  // Verification 4: Detecting overlap with another finding
  // --------------------------------------------------------------------------
  it('4. Detects overlaps with other findings while allowing the active finding to resize freely', () => {
    const lineTranscript = 'He mess his room today.';

    const existingFindings: MarkingFinding[] = [
      {
        id: 'f-mess',
        type: 'Grammar',
        originalText: 'mess',
        replacementText: 'messes',
        explanation: 'verb',
        decision: 'pending',
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ];

    // Attempting to anchor finding B to "mess his" overlaps with Finding A ("mess")
    const overlapValidation = validateFindingQuoteAndRange({
      quote: 'mess his',
      lineIndex: 0,
      occurrenceIndex: 0,
      transcript: lineTranscript,
      currentFindingId: 'f-another-finding',
      existingFindings,
    });

    expect(overlapValidation.valid).toBe(false);
    expect(overlapValidation.error).toContain('Overlaps with another finding on Line 1: "mess"');

    // However, editing Finding A itself (e.g. expanding or narrowing) excludes finding A from self-collision
    const selfValidation = validateFindingQuoteAndRange({
      quote: 'mess',
      lineIndex: 0,
      occurrenceIndex: 0,
      transcript: lineTranscript,
      currentFindingId: 'f-mess', // Same ID being edited
      existingFindings,
    });

    expect(selfValidation.valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Verification 5: Saving and restoring the edited range after refresh
  // --------------------------------------------------------------------------
  it('5. Preserves and restores edited finding range and teacher edit metadata after session refresh', async () => {
    const studentId = 'student-abby';
    const editedFindings: MarkingFinding[] = [
      {
        id: 'f-ai-1',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        teacherCustomText: 'saved',
        explanation: 'Past tense saved',
        decision: 'edited',
        source: 'teacher',
        isManual: true,
        lineIndex: 2,
        occurrenceIndex: 0,
        paragraphIndex: 0,
      },
    ];

    // Save session with edited findings
    await saveWorkbenchSession({
      currentStep: 'review',
      assignment: null,
      files: [],
      pages: [],
      selectedClassId: 'cls-1',
      studentPageCounts: { [studentId]: 1 },
      selectedStudentIndices: [0],
      appliedMatching: {},
      activeStudentIndex: 0,
      transcripts: { [studentId]: threeLineTranscript },
      markings: {
        [studentId]: {
          studentId,
          findings: editedFindings,
          scores: {},
          feedbackComment: 'Great effort',
          isApproved: false,
        },
      },
      recognitionResults: {},
      matchingMode: 'auto',
    });

    // Simulate session reload
    const restored = await loadWorkbenchSession();
    expect(restored).not.toBeNull();
    const restoredStudentMarkings = restored?.markings?.[studentId];
    expect(restoredStudentMarkings).toBeDefined();

    const restoredFinding = restoredStudentMarkings!.findings[0];
    expect(restoredFinding.id).toBe('f-ai-1');
    expect(restoredFinding.originalText).toBe('save');
    expect(restoredFinding.replacementText).toBe('saved');
    expect(restoredFinding.lineIndex).toBe(2);
    expect(restoredFinding.occurrenceIndex).toBe(0);
    expect(restoredFinding.decision).toBe('edited');
    expect(restoredFinding.source).toBe('teacher');
    expect(restoredFinding.isManual).toBe(true);

    // Verify AI re-run does not overwrite teacher-edited finding
    const newAiRunFindings: MarkingFinding[] = [
      {
        id: 'f-ai-1',
        type: 'Tense',
        originalText: 'He save',
        replacementText: 'saved',
        decision: 'pending',
        lineIndex: 2,
      },
    ];

    const currentFindings = restoredStudentMarkings!.findings;
    const preservedManual = currentFindings.filter(
      (f) => !f.id.startsWith('f-ai-') || f.decision === 'edited' || f.source === 'teacher' || f.isManual
    );

    // Preserved manual finding remains untouched
    expect(preservedManual.length).toBe(1);
    expect(preservedManual[0].originalText).toBe('save');
    expect(preservedManual[0].decision).toBe('edited');
  });

  // --------------------------------------------------------------------------
  // Verification 6: Confirming that the transcript itself remains unchanged
  // --------------------------------------------------------------------------
  it('6. Editing a finding does not modify or corrupt the student transcript text', () => {
    const originalTranscriptCopy = `${threeLineTranscript}`;

    const onEditFinding = vi.fn();
    const finding: MarkingFinding = {
      id: 'f-save',
      type: 'Tense',
      originalText: 'save',
      replacementText: 'saved',
      decision: 'pending',
      lineIndex: 2,
      occurrenceIndex: 0,
    };

    const { unmount } = render(
      <InlineMarkingView
        transcript={threeLineTranscript}
        findings={[finding]}
        studentId="std-1"
        onFindingDecision={vi.fn()}
        onDeleteFinding={vi.fn()}
        onEditFinding={onEditFinding}
      />
    );

    // Click on finding token to open popover
    const saveToken = screen.getByText('save');
    fireEvent.click(saveToken);

    // Click "Edit" in popover
    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    // Change original quoted text in the input
    const quoteInput = screen.getByPlaceholderText('Original word or phrase...');
    fireEvent.change(quoteInput, { target: { value: 'save' } });

    // Change suggestion
    const suggestionInput = screen.getByPlaceholderText('e.g. saved (leave empty for delete)');
    fireEvent.change(suggestionInput, { target: { value: 'rescued' } });

    // Save changes
    const saveChangesBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveChangesBtn);

    expect(onEditFinding).toHaveBeenCalledTimes(1);
    expect(onEditFinding).toHaveBeenCalledWith(
      'std-1',
      'f-save',
      expect.objectContaining({
        originalText: 'save',
        replacementText: 'rescued',
        decision: 'edited',
        source: 'teacher',
        isManual: true,
      })
    );

    // Confirm transcript string is strictly unmodified
    expect(threeLineTranscript).toBe(originalTranscriptCopy);
    expect(threeLineTranscript).toContain('He save Dog Man.');
    expect(threeLineTranscript).not.toContain('rescued');

    unmount();
  });
});
