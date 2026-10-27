import { describe, it, expect } from 'vitest';
import { isWithinClassDashHours, classDashErrorMessage } from '@/utils/classDashAccess';

/** Build a Date whose Asia/Hong_Kong wall time equals the given parts. */
function hkWallTime(parts: {
  year: number; month: number; day: number;
  hour: number; minute: number;
}): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoGuess = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:00+08:00`;
  return new Date(isoGuess);
}

describe('isWithinClassDashHours', () => {
  it('allows weekday 07:30', () => {
    // 2026-10-28 is Wednesday
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 7, minute: 30 }))).toBe(true);
  });

  it('allows weekday 15:30 inclusive end-of-minute start, rejects 15:31', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 15, minute: 30 }))).toBe(true);
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 15, minute: 31 }))).toBe(false);
  });

  it('rejects before 07:30 on weekday', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 28, hour: 7, minute: 29 }))).toBe(false);
  });

  it('rejects Saturday even at noon', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 10, day: 31, hour: 12, minute: 0 }))).toBe(false);
  });

  it('rejects Sunday', () => {
    expect(isWithinClassDashHours(hkWallTime({ year: 2026, month: 11, day: 1, hour: 10, minute: 0 }))).toBe(false);
  });
});

describe('classDashErrorMessage', () => {
  it('returns English outside hours copy', () => {
    expect(classDashErrorMessage('outside_hours')).toMatch(/school hours/i);
  });
});
