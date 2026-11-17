import { describe, expect, it } from 'vitest';
import { filterToManagedClasses, isClassManaged, resolveManagedClassIds } from '@/lib/staff/managedClasses';

describe('managedClasses helpers', () => {
  it('admin sees all classes', () => {
    const items = [{ name: '4A' }, { name: '3A' }];
    expect(filterToManagedClasses(items, ['4A'], true).map((i) => i.name)).toEqual(['4A', '3A']);
  });

  it('staff sees only managed classes', () => {
    const items = [{ name: '4A' }, { name: '3A' }];
    expect(filterToManagedClasses(items, ['4A'], false).map((i) => i.name)).toEqual(['4A']);
  });

  it('staff with empty assignments sees none', () => {
    expect(filterToManagedClasses([{ name: '4A' }], [], false)).toEqual([]);
  });

  it('isClassManaged allows admin any class', () => {
    expect(isClassManaged('3A', ['4A'], true)).toBe(true);
  });

  it('isClassManaged denies staff unmanaged class', () => {
    expect(isClassManaged('3A', ['4A'], false)).toBe(false);
  });

  it('falls back to the staff class when assignments are empty', () => {
    expect(resolveManagedClassIds([], '4A')).toEqual(['4A']);
    expect(resolveManagedClassIds(['4A'], '3A')).toEqual(['4A']);
    expect(resolveManagedClassIds([], null)).toEqual([]);
  });
});
