import { describe, expect, it } from 'vitest';
import { buildMissingLedger, formatMissingAnnouncement, handedInKey, makeupKey, missingLogsFromEnglishMarks, openMissingAnnouncement, submittedKeysWithHandedIn, type MissingLogInput } from '@/lib/homework/missingLedger';

const logs: MissingLogInput[] = [
  {
    id: 'log-amy',
    logDate: '2026-10-02',
    className: '3A',
    studentId: 'amy',
    studentName: 'Amy',
    classNumber: 2,
    missingItems: { 英文: ['WS1'], 中文: ['詞語'] },
  },
  {
    id: 'log-ben',
    logDate: '2026-10-02',
    className: '3A',
    studentId: 'ben',
    studentName: 'Ben',
    classNumber: 1,
    missingItems: { 英文: ['WS1'] },
  },
  {
    id: 'log-cara',
    logDate: '2026-10-01',
    className: '3A',
    studentId: 'cara',
    studentName: 'Cara',
    classNumber: 3,
    missingItems: { 英文: ['Pen'] },
  },
];

describe('buildMissingLedger', () => {
  it('groups by date then homework item, with the earliest open date first', () => {
    const ledger = buildMissingLedger(logs, new Set());
    expect(ledger.map((group) => group.date)).toEqual(['2026-10-01', '2026-10-02']);
    const october2 = ledger[1];
    expect(october2.items.map((item) => `${item.subject}:${item.item}`)).toEqual(['中文:詞語', '英文:WS1']);
    expect(october2.items[1].students.map((student) => student.name)).toEqual(['Ben', 'Amy']);
    expect(october2.complete).toBe(false);
  });

  it('marks a row complete when every name is submitted, and moves a cleared date to the bottom', () => {
    const madeUp = new Set([
      makeupKey('log-cara', '英文', 'Pen'),
    ]);
    const ledger = buildMissingLedger(logs, madeUp, ({ item }) => (item === 'Pen' ? 'p.4' : ''));
    expect(ledger.map((group) => group.date)).toEqual(['2026-10-02', '2026-10-01']);
    expect(ledger[1].complete).toBe(true);
    expect(ledger[1].items[0]).toMatchObject({ item: 'Pen', detail: 'p.4', complete: true });
    expect(ledger[1].items[0].students[0].submitted).toBe(true);
  });

  it('announces open dates as the date, then each homework item and the students still missing it', () => {
    const madeUp = new Set([makeupKey('log-ben', '英文', 'WS1')]);
    const blocks = openMissingAnnouncement(buildMissingLedger(logs, madeUp));
    expect(blocks.map((block) => block.isoDate)).toEqual(['2026-10-01', '2026-10-02']);
    expect(formatMissingAnnouncement(blocks[1])).toBe(
      `${blocks[1].date}\n中文 · 詞語: Amy\n英文 · WS1: Amy`,
    );
    expect(blocks[1].lines.join('\n')).not.toContain('Ben');
  });
});

describe('submittedKeysWithHandedIn', () => {
  it('crosses a morning-duty name when that student is ticked handed in', () => {
    const keys = submittedKeysWithHandedIn(
      logs,
      new Set(),
      new Set([handedInKey('amy', '2026-10-02', '英文', 'WS1')]),
    );
    const ledger = buildMissingLedger(logs, keys);
    const ws1 = ledger.find((group) => group.date === '2026-10-02')?.items.find((item) => item.item === 'WS1');
    expect(ws1?.students.find((student) => student.studentId === 'amy')?.submitted).toBe(true);
    expect(ws1?.students.find((student) => student.studentId === 'ben')?.submitted).toBe(false);
    const block = openMissingAnnouncement(ledger).find((item) => item.isoDate === '2026-10-02');
    expect(block?.lines).toEqual(['中文 · 詞語: Amy', '英文 · WS1: Ben']);
  });
});

describe('missingLogsFromEnglishMarks', () => {
  const students = [
    { id: 'amy', name: 'Amy', className: '4A', classNumber: 1 },
    { id: 'ben', name: 'Ben', className: '4A', classNumber: 2 },
    { id: 'cara', name: 'Cara', className: '4A', classNumber: 3 },
  ];

  it('lists classmates who were not ticked handed in after a record is updated', () => {
    const logs = missingLogsFromEnglishMarks(students, [
      { className: '4A', date: '2026-10-29', subject: '英文', item: 'Writing File', studentId: 'amy', handedIn: true },
      { className: '4A', date: '2026-10-29', subject: '英文', item: 'WS File', studentId: 'ben', handedIn: false },
    ]);
    const ledger = buildMissingLedger(logs, new Set());
    expect(ledger).toHaveLength(1);
    const writing = ledger[0].items.find((item) => item.item === 'Writing File');
    const worksheet = ledger[0].items.find((item) => item.item === 'WS File');
    expect(writing?.students.map((student) => student.name)).toEqual(['Ben', 'Cara']);
    expect(worksheet?.students.map((student) => student.name)).toEqual(['Amy', 'Ben', 'Cara']);
  });

  it('leaves an item off the list when nobody has been marked', () => {
    expect(missingLogsFromEnglishMarks(students, [])).toEqual([]);
  });
});
