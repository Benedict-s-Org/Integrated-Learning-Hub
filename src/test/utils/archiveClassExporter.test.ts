import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

describe('isArchivedClassName', () => {
  beforeEach(() => {
    // Fix current time to 2026-10-25 (Academic Year 2026-2027: 2627)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should treat current academic year classes like 3A(2627) and 3A as active (not archived)', () => {
    expect(isArchivedClassName('3A(2627)')).toBe(false);
    expect(isArchivedClassName('3A (2627)')).toBe(false);
    expect(isArchivedClassName('3A(2026-2027)')).toBe(false);
    expect(isArchivedClassName('3A')).toBe(false);
    expect(isArchivedClassName('4B')).toBe(false);
  });

  it('should treat future academic year classes as active (not archived)', () => {
    expect(isArchivedClassName('3A(2728)')).toBe(false);
    expect(isArchivedClassName('3A(2027-2028)')).toBe(false);
  });

  it('should treat past academic year classes like 2526 and 2425 as archived', () => {
    expect(isArchivedClassName('3A(2526)')).toBe(true);
    expect(isArchivedClassName('3A (2526)')).toBe(true);
    expect(isArchivedClassName('3A(2025-2026)')).toBe(true);
    expect(isArchivedClassName('3A(2425)')).toBe(true);
    expect(isArchivedClassName('3A (2024-2025)')).toBe(true);
  });

  it('should treat explicit archive keywords as archived regardless of year', () => {
    expect(isArchivedClassName('3A (已封存)')).toBe(true);
    expect(isArchivedClassName('3A (archive)')).toBe(true);
    expect(isArchivedClassName('3A(2627) 已封存')).toBe(true);
  });

  it('should treat classes in archivedList as archived', () => {
    expect(isArchivedClassName('3A', ['3A'])).toBe(true);
    expect(isArchivedClassName('3A(2627)', ['3A(2627)'])).toBe(true);
  });

  it('should handle null, empty or undefined gracefully', () => {
    expect(isArchivedClassName(null)).toBe(false);
    expect(isArchivedClassName(undefined)).toBe(false);
    expect(isArchivedClassName('')).toBe(false);
  });
});
