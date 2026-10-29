import { describe, expect, it } from 'vitest';
import {
  groupWorkByDate,
  groupWorkByItem,
  listEnglishWork,
  nextEnglishCheck,
} from '@/lib/homework/englishWork';

describe('listEnglishWork', () => {
  it('keeps English items and their pages, and drops other subjects', () => {
    const cells = listEnglishWork([
      {
        date: '2026-10-29',
        className: '3A',
        assignments: {
          英文: [{ name: 'WS1', detail: 'p.12-15' }, 'Pen'],
          數學: ['A簿'],
          English: [{ name: 'Dict', detail: 'Unit 2' }],
        },
      },
    ]);
    expect(cells).toEqual([
      { date: '2026-10-29', className: '3A', subject: '英文', name: 'WS1', detail: 'p.12-15' },
      { date: '2026-10-29', className: '3A', subject: '英文', name: 'Pen', detail: '' },
      { date: '2026-10-29', className: '3A', subject: 'English', name: 'Dict', detail: 'Unit 2' },
    ]);
  });
});

describe('grouping', () => {
  const cells = listEnglishWork([
    { date: '2026-10-02', className: '3A', assignments: { 英文: [{ name: 'WS1', detail: 'p.2' }] } },
    { date: '2026-10-01', className: '3A', assignments: { 英文: [{ name: 'WS1', detail: 'p.1' }, { name: 'WS1', detail: 'p.2' }] } },
  ]);

  it('sorts dates earliest first', () => {
    expect(groupWorkByDate(cells, 'asc').map((group) => group.date)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('groups the same item and page range across dates', () => {
    const groups = groupWorkByItem(cells);
    const ws1page2 = groups.find((group) => group.detail === 'p.2');
    expect(ws1page2?.works.map((work) => work.date)).toEqual(['2026-10-01', '2026-10-02']);
  });
});

describe('nextEnglishCheck', () => {
  const empty = { handedIn: false, correction: false, complete: false };

  it('checks handed in when correction or complete is turned on', () => {
    expect(nextEnglishCheck(empty, 'correction', true)).toEqual({
      handedIn: true,
      correction: true,
      complete: false,
    });
    expect(nextEnglishCheck(empty, 'complete', true).handedIn).toBe(true);
  });

  it('clears correction and complete when handed in is turned off', () => {
    expect(nextEnglishCheck({
      handedIn: true,
      correction: true,
      complete: true,
    }, 'handedIn', false)).toEqual(empty);
  });
});
