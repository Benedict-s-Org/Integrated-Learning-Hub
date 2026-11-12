/** SRS chart helpers (Master Spec §12) — pure; no Proofreading mix-in. */

export const LINE_BATCH_SIZE = 25;
export const BAR_TWO_SETS_SIZE = 20;

export interface ChartAttempt {
  isCorrect: boolean;
  skillId: string;
  answeredAt: string; // ISO
}

export interface LineBatchPoint {
  batchIndex: number; // 1-based
  fromAttempt: number; // 1-based inclusive
  toAttempt: number;
  correctCount: number;
  accuracy: number;
  /** Completion date of the last attempt in the batch */
  completedAt: string;
}

/**
 * Non-overlapping batches of 25 valid attempts. Incomplete batch → no point.
 */
export function buildSkillLinePoints(
  attemptsOldestFirst: ChartAttempt[]
): { points: LineBatchPoint[]; pendingInBatch: number } {
  const points: LineBatchPoint[] = [];
  const n = attemptsOldestFirst.length;
  const fullBatches = Math.floor(n / LINE_BATCH_SIZE);
  for (let b = 0; b < fullBatches; b++) {
    const start = b * LINE_BATCH_SIZE;
    const slice = attemptsOldestFirst.slice(start, start + LINE_BATCH_SIZE);
    const correctCount = slice.filter((a) => a.isCorrect).length;
    points.push({
      batchIndex: b + 1,
      fromAttempt: start + 1,
      toAttempt: start + LINE_BATCH_SIZE,
      correctCount,
      accuracy: correctCount / LINE_BATCH_SIZE,
      completedAt: slice[slice.length - 1].answeredAt,
    });
  }
  return {
    points,
    pendingInBatch: n % LINE_BATCH_SIZE,
  };
}

export interface TwoSetBar {
  barIndex: number;
  correctCount: number;
  /** 0–1 height = correct/20 */
  heightRatio: number;
  /** skillId → correct count in this 20 (for stack segments of correct items only) */
  correctBySkill: Record<string, number>;
}

/**
 * Every two completed sets (20 items) → one bar. Incomplete pair → no bar.
 */
export function buildTwoSetBars(
  setAttemptsOldestFirst: ChartAttempt[][]
): TwoSetBar[] {
  const completed = setAttemptsOldestFirst.filter((s) => s.length > 0);
  const bars: TwoSetBar[] = [];
  const pairs = Math.floor(completed.length / 2);
  for (let i = 0; i < pairs; i++) {
    const twenty = [...completed[i * 2], ...completed[i * 2 + 1]];
    const correctCount = twenty.filter((a) => a.isCorrect).length;
    const correctBySkill: Record<string, number> = {};
    for (const a of twenty) {
      if (!a.isCorrect) continue;
      correctBySkill[a.skillId] = (correctBySkill[a.skillId] ?? 0) + 1;
    }
    bars.push({
      barIndex: i + 1,
      correctCount,
      heightRatio: correctCount / BAR_TWO_SETS_SIZE,
      correctBySkill,
    });
  }
  return bars;
}

export interface PieSlice {
  skillId: string;
  isCorrect: boolean;
  count: number;
  /** share of 20 items */
  ratio: number;
}

/**
 * Same 20 items → pie; each item 5%. Correct wedges grouped leftish, incorrect rightish.
 */
export function buildTwentyItemPie(twenty: ChartAttempt[]): PieSlice[] {
  if (twenty.length !== BAR_TWO_SETS_SIZE) {
    throw new Error(`Pie expects exactly ${BAR_TWO_SETS_SIZE} items`);
  }
  const key = (skillId: string, isCorrect: boolean) => `${skillId}::${isCorrect ? 'ok' : 'bad'}`;
  const map = new Map<string, PieSlice>();
  for (const a of twenty) {
    const k = key(a.skillId, a.isCorrect);
    const existing = map.get(k);
    if (existing) existing.count += 1;
    else {
      map.set(k, {
        skillId: a.skillId,
        isCorrect: a.isCorrect,
        count: 1,
        ratio: 0,
      });
    }
  }
  const slices = [...map.values()].map((s) => ({
    ...s,
    ratio: s.count / BAR_TWO_SETS_SIZE,
  }));
  const correct = slices.filter((s) => s.isCorrect).sort((a, b) => b.count - a.count);
  const incorrect = slices.filter((s) => !s.isCorrect).sort((a, b) => b.count - a.count);
  return [...correct, ...incorrect];
}
