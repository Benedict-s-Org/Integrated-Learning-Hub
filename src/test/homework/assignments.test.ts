import { describe, expect, it } from 'vitest';
import {
  buildAssignments,
  detailFor,
  listHomeworkTargets,
  parseSubjectAssignments,
  saveAssignments,
  toNameMap,
} from '@/lib/homework/assignments';

describe('listHomeworkTargets', () => {
  it('lists every saved item, including a plain name list', () => {
    expect(listHomeworkTargets({
      英文: ['WS1'],
      中文: [{ name: '詞語', detail: 'p.3' }],
    })).toEqual([
      { subject: '英文', name: 'WS1', detail: '' },
      { subject: '中文', name: '詞語', detail: 'p.3' },
    ]);
  });
});

describe('parseSubjectAssignments', () => {
  it('reads the legacy subject-to-name-list shape', () => {
    expect(parseSubjectAssignments({ 英文: ['WS1', ' GE(A) '], 數學: [] })).toEqual({
      英文: [
        { name: 'WS1', detail: '' },
        { name: 'GE(A)', detail: '' },
      ],
    });
  });

  it('reads name and pages objects and ignores blank names', () => {
    expect(parseSubjectAssignments({
      英文: [{ name: 'WS1', detail: ' p.12-15 ' }, { name: '  ' }, 'Pen'],
    })).toEqual({
      英文: [
        { name: 'WS1', detail: 'p.12-15' },
        { name: 'Pen', detail: '' },
      ],
    });
  });
});

describe('saveAssignments', () => {
  const previous = {
    英文: [{ name: 'WS1', detail: 'p.12-15' }, { name: 'Pen', detail: 'Ch.2' }],
  };

  it('keeps stored pages when a name-only save repeats the item', () => {
    expect(saveAssignments(previous, { 英文: ['WS1'] })).toEqual({
      英文: [{ name: 'WS1', detail: 'p.12-15' }],
    });
  });

  it('lets the setup text box clear a stored page range', () => {
    expect(saveAssignments(previous, { 英文: [{ name: 'WS1', detail: '' }] })).toEqual({
      英文: [{ name: 'WS1', detail: '' }],
    });
  });
});

describe('buildAssignments and toNameMap', () => {
  it('pairs selected names with typed details', () => {
    const built = buildAssignments(
      { 英文: ['WS1'] },
      { 英文: { WS1: ' p.3 ' } },
    );
    expect(built).toEqual({ 英文: [{ name: 'WS1', detail: 'p.3' }] });
    expect(toNameMap(built)).toEqual({ 英文: ['WS1'] });
    expect(detailFor(built, '英文', 'WS1')).toBe('p.3');
  });
});
