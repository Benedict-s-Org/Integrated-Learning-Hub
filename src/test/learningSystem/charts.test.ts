import { describe, it, expect } from 'vitest';
import {
  buildSkillLinePoints,
  buildTwoSetBars,
  buildTwentyItemPie,
  LINE_BATCH_SIZE,
} from '../../lib/learningSystem/charts';
import type { ChartAttempt } from '../../lib/learningSystem/charts';

function makeAttempts(n: number, skillId = 's1'): ChartAttempt[] {
  return Array.from({ length: n }, (_, i) => ({
    isCorrect: i % 2 === 0,
    skillId,
    answeredAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
}

describe('buildSkillLinePoints', () => {
  it('has no point at 24, one at 25, two at 50', () => {
    expect(buildSkillLinePoints(makeAttempts(24)).points).toHaveLength(0);
    expect(buildSkillLinePoints(makeAttempts(24)).pendingInBatch).toBe(24);

    const at25 = buildSkillLinePoints(makeAttempts(25));
    expect(at25.points).toHaveLength(1);
    expect(at25.points[0].toAttempt).toBe(LINE_BATCH_SIZE);
    expect(at25.pendingInBatch).toBe(0);

    const at50 = buildSkillLinePoints(makeAttempts(50));
    expect(at50.points).toHaveLength(2);
    // Same-day multi-batch: two distinct points retained
    expect(at50.points[0].completedAt).toBeTruthy();
    expect(at50.points[1].completedAt).toBeTruthy();
  });
});

describe('buildTwoSetBars', () => {
  it('bar height is correct/20 (10 correct → 50%)', () => {
    const setA = makeAttempts(10).map((a, i) => ({ ...a, isCorrect: i < 5 }));
    const setB = makeAttempts(10).map((a, i) => ({
      ...a,
      skillId: 's2',
      isCorrect: i < 5,
    }));
    const bars = buildTwoSetBars([setA, setB]);
    expect(bars).toHaveLength(1);
    expect(bars[0].correctCount).toBe(10);
    expect(bars[0].heightRatio).toBe(0.5);
  });

  it('does not form a bar from a single incomplete pair', () => {
    expect(buildTwoSetBars([makeAttempts(10)])).toHaveLength(0);
  });
});

describe('buildTwentyItemPie', () => {
  it('slices sum to 100% over the same 20 items', () => {
    const twenty = [
      ...Array.from({ length: 12 }, (_, i) => ({
        isCorrect: true,
        skillId: i < 8 ? 'a' : 'b',
        answeredAt: '2026-02-01T00:00:00.000Z',
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        isCorrect: false,
        skillId: i < 3 ? 'a' : 'c',
        answeredAt: '2026-02-01T00:00:00.000Z',
      })),
    ];
    const pie = buildTwentyItemPie(twenty);
    const totalRatio = pie.reduce((s, x) => s + x.ratio, 0);
    expect(totalRatio).toBeCloseTo(1);
    expect(pie.reduce((s, x) => s + x.count, 0)).toBe(20);
    // correct slices come before incorrect
    const firstIncorrect = pie.findIndex((s) => !s.isCorrect);
    const lastCorrect = pie.map((s) => s.isCorrect).lastIndexOf(true);
    if (firstIncorrect !== -1 && lastCorrect !== -1) {
      expect(lastCorrect).toBeLessThan(firstIncorrect);
    }
  });
});
