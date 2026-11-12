import { describe, it, expect } from 'vitest';
import { scoreProofreadingItem } from '../utils/proofreadingScore';

describe('scoreProofreadingItem', () => {
  it('credits correction only after a correct find and an exact match', () => {
    const score = scoreProofreadingItem({
      userWordIndex: 2,
      userCorrection: '  Went ',
      expectedWordIndex: 2,
      expectedCorrection: 'went',
    });
    expect(score).toEqual({
      detectionCorrect: true,
      correctionCorrect: true,
      isCorrect: true,
    });
  });

  it('does not grant correction success when the find fails', () => {
    const score = scoreProofreadingItem({
      userWordIndex: 0,
      userCorrection: 'went',
      expectedWordIndex: 2,
      expectedCorrection: 'went',
    });
    expect(score.detectionCorrect).toBe(false);
    expect(score.correctionCorrect).toBe(false);
    expect(score.isCorrect).toBe(false);
  });

  it('finds the word but rejects a non-exact correction', () => {
    const score = scoreProofreadingItem({
      userWordIndex: 2,
      userCorrection: 'goed',
      expectedWordIndex: 2,
      expectedCorrection: 'went',
    });
    expect(score.detectionCorrect).toBe(true);
    expect(score.correctionCorrect).toBe(false);
  });

  it('scores not-sure and incomplete as neither find nor correction', () => {
    expect(
      scoreProofreadingItem({
        userWordIndex: 2,
        userCorrection: 'went',
        expectedWordIndex: 2,
        expectedCorrection: 'went',
        isNotSure: true,
      }).isCorrect
    ).toBe(false);
    expect(
      scoreProofreadingItem({
        expectedWordIndex: 2,
        expectedCorrection: 'went',
        isIncomplete: true,
      })
    ).toEqual({ detectionCorrect: false, correctionCorrect: false, isCorrect: false });
  });
});
