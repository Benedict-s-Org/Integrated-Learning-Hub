import { describe, expect, it } from 'vitest';
import { resolveEnglishClassFilter } from '@/lib/homework/englishClassFilter';

describe('resolveEnglishClassFilter', () => {
  it('keeps All classes and a class that still exists', () => {
    expect(resolveEnglishClassFilter('all', ['4A', 'Test'])).toBe('all');
    expect(resolveEnglishClassFilter('Test', ['4A', 'Test'])).toBe('Test');
  });

  it('drops a stale default like 3A when that class is gone', () => {
    expect(resolveEnglishClassFilter('3A', ['3A(2627)', '4A', 'Test'])).toBe('all');
  });
});
