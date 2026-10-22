import { describe, it, expect } from 'vitest';
import { remapFindingsThroughEdit } from '@/modules/essay-marking/utils/markingTextAlignment';
import { MarkingFinding } from '@/modules/essay-marking/types';

const makeFinding = (overrides: Partial<MarkingFinding>): MarkingFinding => ({
  id: 'f1',
  type: 'Grammar',
  feedbackType: 'correction',
  originalText: 'save',
  replacementText: 'saved',
  explanation: '',
  decision: 'accepted',
  source: 'teacher',
  ...overrides,
});

describe('remapFindingsThroughEdit anchor safety', () => {
  it('maps a surviving span after the edit (shifts offsets, preserves decision)', () => {
    const oldTranscript = 'He save the cat.\nThen he save the dog.';
    const newTranscript = 'He saved the cat.\nThen he save the dog.';
    // Edit: replace first "save" (3..7) with "saved"
    const findings = [
      makeFinding({ id: 'f2', originalText: 'save', lineIndex: 1, occurrenceIndex: 0, decision: 'edited' }),
    ];
    const outcome = remapFindingsThroughEdit(oldTranscript, newTranscript, findings, {
      start: 3,
      end: 7,
      inserted: 'saved',
    });
    expect(outcome).toHaveLength(1);
    expect(outcome[0].status).toBe('mapped');
    expect(outcome[0].mapped?.lineIndex).toBe(1);
  });

  it('never relocates a deleted occurrence to identical surviving text elsewhere', () => {
    const oldTranscript = 'He save the cat. He save the dog.';
    const newTranscript = 'He  the cat. He save the dog.';
    // two identical "save": occurrence 0 at [3,7), occurrence 1 at [21,25)
    const findings = [
      makeFinding({ id: 'f1', originalText: 'save', lineIndex: 0, occurrenceIndex: 0, decision: 'accepted' }),
      makeFinding({ id: 'f2', originalText: 'save', lineIndex: 0, occurrenceIndex: 1, decision: 'pending' }),
    ];
    const outcomes = remapFindingsThroughEdit(oldTranscript, newTranscript, findings, {
      start: 3,
      end: 7,
      inserted: '',
    });
    const f1 = outcomes.find((o) => o.findingId === 'f1');
    const f2 = outcomes.find((o) => o.findingId === 'f2');
    expect(f1?.status).toBe('anchor_review');
    expect(f2?.status).toBe('mapped');
    expect(f2?.mapped?.occurrenceIndex).toBe(0);
    expect(f2?.mapped?.startIndex).toBe(16);
  });

  it('flags an altered (partial overlap) span as anchor_review without relocating', () => {
    const oldTranscript = 'He save the cat.';
    const newTranscript = 'He sav the cat.';
    const findings = [
      makeFinding({ id: 'f1', originalText: 'save', lineIndex: 0, occurrenceIndex: 0, decision: 'accepted' }),
    ];
    const outcomes = remapFindingsThroughEdit(oldTranscript, newTranscript, findings, {
      start: 3,
      end: 5,
      inserted: '',
    });
    expect(outcomes[0].status).toBe('anchor_review');
  });
});
