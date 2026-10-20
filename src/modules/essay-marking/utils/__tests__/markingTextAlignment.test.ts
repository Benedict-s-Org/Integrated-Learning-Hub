import { describe, it, expect } from 'vitest';
import {
  alignTranscriptWithFindings,
  buildTranscriptParagraphStructure,
} from '../markingTextAlignment';
import { MarkingFinding } from '../../types';

describe('markingTextAlignment', () => {
  it('correctly parses paragraph structure with empty line breaks', () => {
    const rawLines = ['Line 1', 'Line 2', '', 'Line 3'];
    const structure = buildTranscriptParagraphStructure(rawLines);
    expect(structure.paragraphs.length).toBe(2);
    expect(structure.paragraphs[0].length).toBe(2);
    expect(structure.paragraphs[0][0].rawLineIndex).toBe(0);
    expect(structure.paragraphs[1][0].rawLineIndex).toBe(3);
  });

  it('aligns finding using paragraphIndex and lineIndex', () => {
    const transcript = 'One time he save the city.\nHe is very brave.';
    const findings: MarkingFinding[] = [
      {
        id: 'f1',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        explanation: 'Use past tense',
        decision: 'pending',
        paragraphIndex: 0,
        lineIndex: 0,
      },
    ];

    const { alignedLines, unmatchedFindings } = alignTranscriptWithFindings(transcript, findings);
    expect(unmatchedFindings.length).toBe(0);
    expect(alignedLines[0].tokens.length).toBe(3);
    expect(alignedLines[0].tokens[0]).toEqual({ type: 'text', text: 'One time he ' });
    expect(alignedLines[0].tokens[1]).toMatchObject({
      type: 'finding',
      originalText: 'save',
      replacementText: 'saved',
      isRejected: false,
    });
    expect(alignedLines[0].tokens[2]).toEqual({ type: 'text', text: ' the city.' });
  });

  it('handles multiple non-overlapping findings on the same line', () => {
    const transcript = 'He goed to sily school.';
    const findings: MarkingFinding[] = [
      {
        id: 'f1',
        type: 'Tense',
        originalText: 'goed',
        replacementText: 'went',
        explanation: 'Use went',
        decision: 'pending',
        lineIndex: 0,
      },
      {
        id: 'f2',
        type: 'Spelling',
        originalText: 'sily',
        replacementText: 'silly',
        explanation: 'Spelling error',
        decision: 'pending',
        lineIndex: 0,
      },
    ];

    const { alignedLines, unmatchedFindings } = alignTranscriptWithFindings(transcript, findings);
    expect(unmatchedFindings.length).toBe(0);
    const tokens = alignedLines[0].tokens;
    expect(tokens.length).toBe(5);
    expect(tokens[0]).toEqual({ type: 'text', text: 'He ' });
    expect(tokens[1]).toMatchObject({ type: 'finding', originalText: 'goed', replacementText: 'went' });
    expect(tokens[2]).toEqual({ type: 'text', text: ' to ' });
    expect(tokens[3]).toMatchObject({ type: 'finding', originalText: 'sily', replacementText: 'silly' });
    expect(tokens[4]).toEqual({ type: 'text', text: ' school.' });
  });

  it('places ambiguous findings (repeated words without line info) into unmatchedFindings', () => {
    const transcript = 'He save the cat.\nThen he save the dog.';
    const findings: MarkingFinding[] = [
      {
        id: 'f1',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        explanation: 'Ambiguous line',
        decision: 'pending',
      },
    ];

    const { unmatchedFindings } = alignTranscriptWithFindings(transcript, findings);
    expect(unmatchedFindings.length).toBe(1);
    expect(unmatchedFindings[0].id).toBe('f1');
  });

  it('places overlapping findings into unmatchedFindings to prevent corrupt tokens', () => {
    const transcript = 'He save the city.';
    const findings: MarkingFinding[] = [
      {
        id: 'f1',
        type: 'Tense',
        originalText: 'save',
        replacementText: 'saved',
        explanation: 'Use saved',
        decision: 'pending',
        lineIndex: 0,
      },
      {
        id: 'f2',
        type: 'Grammar',
        originalText: 'save the',
        replacementText: 'saved the',
        explanation: 'Conflict',
        decision: 'pending',
        lineIndex: 0,
      },
    ];

    const { alignedLines, unmatchedFindings } = alignTranscriptWithFindings(transcript, findings);
    expect(unmatchedFindings.length).toBe(1);
    expect(unmatchedFindings[0].id).toBe('f2');
    expect(alignedLines[0].tokens.filter((t) => t.type === 'finding').length).toBe(1);
  });

  it('reflects rejected and edited decision states cleanly', () => {
    const transcript = 'He mess things up.';
    const findings: MarkingFinding[] = [
      {
        id: 'f1',
        type: 'Grammar',
        originalText: 'mess',
        replacementText: 'messes',
        teacherCustomText: 'messed',
        explanation: 'Subject-verb agreement',
        decision: 'edited',
        lineIndex: 0,
      },
    ];

    const { alignedLines } = alignTranscriptWithFindings(transcript, findings);
    const findingToken = alignedLines[0].tokens[1] as any;
    expect(findingToken.isEdited).toBe(true);
    expect(findingToken.replacementText).toBe('messed');
  });

  describe('computeWordLevelDiff minimal highlighting', () => {
    it('he save -> he saved: marks only save -> saved', () => {
      const transcript = 'One time he save a friend.';
      const findings: MarkingFinding[] = [
        {
          id: 'f1',
          type: 'Tense',
          originalText: 'he save',
          replacementText: 'he saved',
          explanation: 'Past tense',
          decision: 'pending',
          lineIndex: 0,
        },
      ];

      const { alignedLines } = alignTranscriptWithFindings(transcript, findings);
      const tokens = alignedLines[0].tokens;
      // "One time he " + [save -> saved] + " a friend."
      expect(tokens[0]).toEqual({ type: 'text', text: 'One time he ' });
      expect(tokens[1]).toMatchObject({
        type: 'finding',
        originalText: 'save',
        replacementText: 'saved',
        finding: expect.objectContaining({ id: 'f1' }),
      });
      expect(tokens[2]).toEqual({ type: 'text', text: ' a friend.' });
    });

    it('He have -> He has: marks only have -> has', () => {
      const transcript = 'He have a small book.';
      const findings: MarkingFinding[] = [
        {
          id: 'f2',
          type: 'Grammar',
          originalText: 'He have',
          replacementText: 'He has',
          explanation: 'Subject-verb agreement',
          decision: 'pending',
          lineIndex: 0,
        },
      ];

      const { alignedLines } = alignTranscriptWithFindings(transcript, findings);
      const tokens = alignedLines[0].tokens;
      expect(tokens[0]).toEqual({ type: 'text', text: 'He ' });
      expect(tokens[1]).toMatchObject({
        type: 'finding',
        originalText: 'have',
        replacementText: 'has',
        finding: expect.objectContaining({ id: 'f2' }),
      });
      expect(tokens[2]).toEqual({ type: 'text', text: ' a small book.' });
    });

    it('when he go -> when he goes: marks only go -> goes', () => {
      const transcript = 'He plays when he go there.';
      const findings: MarkingFinding[] = [
        {
          id: 'f3',
          type: 'Tense',
          originalText: 'when he go',
          replacementText: 'when he goes',
          explanation: 'Subject-verb agreement',
          decision: 'pending',
          lineIndex: 0,
        },
      ];

      const { alignedLines } = alignTranscriptWithFindings(transcript, findings);
      const tokens = alignedLines[0].tokens;
      expect(tokens[0]).toEqual({ type: 'text', text: 'He plays when he ' });
      expect(tokens[1]).toMatchObject({
        type: 'finding',
        originalText: 'go',
        replacementText: 'goes',
        finding: expect.objectContaining({ id: 'f3' }),
      });
      expect(tokens[2]).toEqual({ type: 'text', text: ' there.' });
    });

    it('A part of dog -> a part of dog: marks only A -> a', () => {
      const transcript = 'He is A part of dog in the story.';
      const findings: MarkingFinding[] = [
        {
          id: 'f4',
          type: 'Capitalization',
          originalText: 'A part of dog',
          replacementText: 'a part of dog',
          explanation: 'Do not capitalize',
          decision: 'pending',
          lineIndex: 0,
        },
      ];

      const { alignedLines } = alignTranscriptWithFindings(transcript, findings);
      const tokens = alignedLines[0].tokens;
      expect(tokens[0]).toEqual({ type: 'text', text: 'He is ' });
      expect(tokens[1]).toMatchObject({
        type: 'finding',
        originalText: 'A',
        replacementText: 'a',
        finding: expect.objectContaining({ id: 'f4' }),
      });
      expect(tokens[2]).toEqual({ type: 'text', text: ' part of dog in the story.' });
    });
  });
});
