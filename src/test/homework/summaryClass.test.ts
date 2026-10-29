import { describe, expect, it } from 'vitest';
import { classesWithAssignments, listedSummaryClasses, pickSummaryClass } from '@/lib/homework/summaryClass';

describe('pickSummaryClass', () => {
  const classes = ['3A(2627)', '4A', 'Test'];

  it('opens the class that has homework when the old default is absent', () => {
    expect(pickSummaryClass(classes, ['Test'], '3A')).toBe('Test');
  });

  it('keeps a requested class that is in the list', () => {
    expect(pickSummaryClass(classes, ['Test'], '4A')).toBe('4A');
  });

  it('uses the first class when nobody has homework', () => {
    expect(pickSummaryClass(classes, [], null)).toBe('3A(2627)');
  });
});

describe('classesWithAssignments', () => {
  it('puts the most recently saved class first and skips empty lists', () => {
    expect(classesWithAssignments([
      { class_name: '4A', assignments: { 英文: ['WS1'] }, updated_at: '2026-10-29T01:00:00Z' },
      { class_name: 'Test', assignments: { 英文: ['Writing File'] }, updated_at: '2026-10-29T05:28:00Z' },
      { class_name: 'P.4', assignments: {}, updated_at: '2026-10-29T06:00:00Z' },
    ])).toEqual(['Test', '4A']);
  });
});

describe('listedSummaryClasses', () => {
  it('drops archived year tags and keeps a class that has homework', () => {
    expect(listedSummaryClasses(
      ['3A (2526)', 'Test', 'Unassigned'],
      [{ name: '4A', is_archived: false }, { name: 'Old', is_archived: true }],
      ['P.4'],
      (name) => (name || '').includes('2526'),
    )).toEqual(['4A', 'P.4', 'Test']);
  });
});
