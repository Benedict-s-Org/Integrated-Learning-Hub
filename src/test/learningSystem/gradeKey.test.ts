import { describe, it, expect } from 'vitest';
import { parseLearningSystemGradeKey, isLearningSystemGradeKey } from '../../lib/learningSystem/gradeKey';

describe('parseLearningSystemGradeKey', () => {
  it('parses class codes like 3A to P.3', () => {
    expect(parseLearningSystemGradeKey('3A')).toBe('P.3');
    expect(parseLearningSystemGradeKey('4B')).toBe('P.4');
  });

  it('parses P.3 and P3 style names', () => {
    expect(parseLearningSystemGradeKey('P.3')).toBe('P.3');
    expect(parseLearningSystemGradeKey('P3')).toBe('P.3');
  });

  it('returns null when unparseable', () => {
    expect(parseLearningSystemGradeKey(null)).toBeNull();
    expect(parseLearningSystemGradeKey('')).toBeNull();
    expect(parseLearningSystemGradeKey('Staff')).toBeNull();
  });
});

describe('isLearningSystemGradeKey', () => {
  it('accepts P.1–P.6 only', () => {
    expect(isLearningSystemGradeKey('P.3')).toBe(true);
    expect(isLearningSystemGradeKey('P3')).toBe(false);
  });
});
