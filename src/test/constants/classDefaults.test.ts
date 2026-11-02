import { describe, expect, it } from 'vitest';
import { pickDefaultClass, resolveClassFilter } from '@/constants/classDefaults';

describe('pickDefaultClass', () => {
  it('prefers 4A when that class exists', () => {
    expect(pickDefaultClass(['3A(2627)', '4A', 'Test'])).toBe('4A');
  });

  it('falls back to the first class when 4A is missing', () => {
    expect(pickDefaultClass(['3A(2627)', 'Test'])).toBe('3A(2627)');
  });
});

describe('resolveClassFilter', () => {
  it('keeps All classes and a valid current class', () => {
    expect(resolveClassFilter('all', ['4A', 'Test'])).toBe('all');
    expect(resolveClassFilter('Test', ['4A', 'Test'])).toBe('Test');
  });

  it('replaces a stale default with 4A', () => {
    expect(resolveClassFilter('3A', ['3A(2627)', '4A', 'Test'])).toBe('4A');
  });
});
