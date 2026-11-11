/**
 * School-year progress for the 2026–27 grammar pacing calendar.
 * Units that share one cycle band are taught in order across that band.
 * Source: docs/learning-system/data/school-curriculum-2026-27/grammar-pacing.json
 */

import type { LearningSystemGradeKey } from './types';

interface CycleWindow {
  fromCycle: number;
  toCycle: number;
  start: string;
  end: string;
}

const CYCLE_WINDOWS: CycleWindow[] = [
  { fromCycle: 1, toCycle: 5, start: '2026-09-04', end: '2026-10-22' },
  { fromCycle: 6, toCycle: 10, start: '2026-11-03', end: '2027-01-07' },
  { fromCycle: 11, toCycle: 15, start: '2027-01-20', end: '2027-03-15' },
  { fromCycle: 16, toCycle: 20, start: '2027-03-25', end: '2027-05-27' },
];

export interface ProgressUnit {
  code: string;
  /** Order within the grade. P.1–P.3 use the book number. P.4–P.6 use A1=1 … B6=12. */
  rank: number;
  cycleStart: number;
  cycleEnd: number;
}

function readerUnits(count: number): ProgressUnit[] {
  return Array.from({ length: count }, (_, i) => ({
    code: `B${String(i + 1).padStart(2, '0')}`,
    rank: i + 1,
    cycleStart: i + 1,
    cycleEnd: i + 1,
  }));
}

/** P.3 books whose cycle span is not one cycle per book. */
const P3_SPANS: Array<[number, number, number]> = [
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [4, 4, 5],
  [5, 6, 6],
  [6, 7, 7],
  [7, 8, 8],
  [8, 9, 10],
  [9, 11, 11],
  [10, 12, 12],
  [11, 13, 13],
  [12, 14, 15],
  [13, 16, 16],
  [14, 17, 17],
  [15, 18, 18],
  [16, 19, 20],
];

function p3Units(): ProgressUnit[] {
  return P3_SPANS.map(([book, cycleStart, cycleEnd]) => ({
    code: `B${String(book).padStart(2, '0')}`,
    rank: book,
    cycleStart,
    cycleEnd,
  }));
}

function coursebookUnits(): ProgressUnit[] {
  const bands: Array<{ from: number; to: number; codes: string[] }> = [
    { from: 1, to: 5, codes: ['A1', 'A2', 'A3'] },
    { from: 6, to: 10, codes: ['A4', 'A5', 'A6'] },
    { from: 11, to: 15, codes: ['B1', 'B2', 'B3'] },
    { from: 16, to: 20, codes: ['B4', 'B5', 'B6'] },
  ];
  const units: ProgressUnit[] = [];
  for (const band of bands) {
    for (const code of band.codes) {
      const n = Number(code.slice(1));
      units.push({
        code,
        rank: code.startsWith('A') ? n : 6 + n,
        cycleStart: band.from,
        cycleEnd: band.to,
      });
    }
  }
  return units;
}

const UNITS: Record<LearningSystemGradeKey, ProgressUnit[]> = {
  'P.1': readerUnits(20),
  'P.2': readerUnits(20),
  'P.3': p3Units(),
  'P.4': coursebookUnits(),
  'P.5': coursebookUnits(),
  'P.6': coursebookUnits(),
};

export function utcDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function hongKongDateIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function cycleBounds(cycle: number): { start: number; end: number } {
  const window = CYCLE_WINDOWS.find((w) => cycle >= w.fromCycle && cycle <= w.toCycle);
  if (!window) {
    throw new Error(`Cycle ${cycle} is outside the 2026–27 calendar.`);
  }
  const origin = utcDayNumber(window.start);
  const span = utcDayNumber(window.end) - origin + 1;
  const parts = window.toCycle - window.fromCycle + 1;
  const index = cycle - window.fromCycle;
  const start = origin + Math.floor((index * span) / parts);
  const end = origin + Math.floor(((index + 1) * span) / parts) - 1;
  return { start, end };
}

function rangeBounds(cycleStart: number, cycleEnd: number): { start: number; end: number } {
  return { start: cycleBounds(cycleStart).start, end: cycleBounds(cycleEnd).end };
}

function groupSharedBands(units: ProgressUnit[]): ProgressUnit[][] {
  const groups: ProgressUnit[][] = [];
  for (const unit of units) {
    const prev = groups[groups.length - 1];
    const last = prev?.[prev.length - 1];
    if (last && last.cycleStart === unit.cycleStart && last.cycleEnd === unit.cycleEnd) {
      prev.push(unit);
    } else {
      groups.push([unit]);
    }
  }
  return groups;
}

/**
 * Latest unit whose teaching slice has started on isoDate.
 * Returns null before the first unit of the grade.
 */
export function currentProgressUnit(
  gradeKey: LearningSystemGradeKey,
  isoDate: string
): ProgressUnit | null {
  const day = utcDayNumber(isoDate);
  let included: ProgressUnit | null = null;
  for (const group of groupSharedBands(UNITS[gradeKey])) {
    const bounds = rangeBounds(group[0].cycleStart, group[0].cycleEnd);
    if (day < bounds.start) break;
    if (day > bounds.end) {
      included = group[group.length - 1];
      continue;
    }
    const span = bounds.end - bounds.start + 1;
    const elapsed = day - bounds.start;
    const index = Math.min(group.length - 1, Math.floor((elapsed * group.length) / span));
    included = group[index];
    break;
  }
  return included;
}

/** Chapter ref is `P.1 2627bk4` or `P.4 A4`. Rank matches ProgressUnit.rank for that grade. */
export function chapterUnitRank(chapterRef: string | null | undefined): {
  year: number;
  rank: number;
} | null {
  if (!chapterRef) return null;
  const book = chapterRef.match(/^P\.([1-6]) 2627bk(\d+)$/);
  if (book) return { year: Number(book[1]), rank: Number(book[2]) };
  const unit = chapterRef.match(/^P\.([1-6]) ([AB])(\d+)$/);
  if (!unit) return null;
  const n = Number(unit[3]);
  return { year: Number(unit[1]), rank: unit[2] === 'A' ? n : 6 + n };
}
