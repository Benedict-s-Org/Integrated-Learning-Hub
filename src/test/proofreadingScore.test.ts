import { describe, it, expect } from 'vitest';
import {
  formatProofreadingCorrectionAlternatives,
  matchesProofreadingCorrection,
  scoreProofreadingItem,
} from '../utils/proofreadingScore';

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

  it('accepts any comma-separated alternative from the Notion Corrected field', () => {
    const base = {
      userWordIndex: 1,
      expectedWordIndex: 1,
      expectedCorrection: 'is,was',
    };
    expect(scoreProofreadingItem({ ...base, userCorrection: 'is' }).isCorrect).toBe(true);
    expect(scoreProofreadingItem({ ...base, userCorrection: 'WAS' }).isCorrect).toBe(true);
    expect(scoreProofreadingItem({ ...base, userCorrection: 'are' }).isCorrect).toBe(false);
    expect(scoreProofreadingItem({ ...base, userCorrection: 'is,was' }).isCorrect).toBe(false);
  });

  it('trims spaces around comma-separated alternatives', () => {
    expect(
      scoreProofreadingItem({
        userWordIndex: 0,
        expectedWordIndex: 0,
        expectedCorrection: 'is, was , were',
        userCorrection: 'were',
      }).isCorrect
    ).toBe(true);
  });
});

describe('proofreading correction alternatives helpers', () => {
  it('formats alternatives for feedback display', () => {
    expect(formatProofreadingCorrectionAlternatives('is,was')).toBe('is / was');
    expect(formatProofreadingCorrectionAlternatives(' went ')).toBe('went');
  });

  it('matches only listed alternatives', () => {
    expect(matchesProofreadingCorrection('is', 'is,was')).toBe(true);
    expect(matchesProofreadingCorrection('was', 'is, was')).toBe(true);
    expect(matchesProofreadingCorrection('', 'is,was')).toBe(false);
    expect(matchesProofreadingCorrection('is,was', 'is,was')).toBe(false);
  });
});
