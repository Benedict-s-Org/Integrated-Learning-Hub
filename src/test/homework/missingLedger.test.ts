import { describe, expect, it } from 'vitest';
import {
  buildMissingLedger,
  buildMissingTally,
  classifyHomeworkMark,
  formatLedgerStudentLabel,
  formatMissingAnnouncement,
  handedInKey,
  isTestUsername,
  listHomeworkAppearances,
  makeupKey,
  missingLogsFromEnglishMarks,
  openMissingAnnouncement,
  sortMissingTally,
  submittedKeysWithHandedIn,
  type MissingLogInput,
} from '@/lib/homework/missingLedger';

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

describe('formatLedgerStudentLabel', () => {
  it('puts the class number in front of the name', () => {
    expect(formatLedgerStudentLabel(1, 'Abby')).toBe('1 Abby');
    expect(formatLedgerStudentLabel(0, 'Abby')).toBe('Abby');
    expect(formatLedgerStudentLabel(2, '')).toBe('2 Unknown');
  });
});

describe('buildMissingLedger', () => {
  it('groups by date then homework item, with the date nearest today first', () => {
    const ledger = buildMissingLedger(logs, new Set(), () => '', '2026-10-05');
    expect(ledger.map((group) => group.date)).toEqual(['2026-10-02', '2026-10-01']);
    const october2 = ledger[0];
    expect(october2.items.map((item) => `${item.subject}:${item.item}`)).toEqual(['中文:詞語', '英文:WS1']);
    expect(october2.items[1].students.map((student) => student.name)).toEqual(['Ben', 'Amy']);
    expect(october2.complete).toBe(false);
  });

  it('hides a fully submitted item and drops a cleared date entirely', () => {
    const madeUp = new Set([
      makeupKey('log-cara', '英文', 'Pen'),
      makeupKey('log-amy', '英文', 'WS1'),
      makeupKey('log-ben', '英文', 'WS1'),
    ]);
    const ledger = buildMissingLedger(logs, madeUp, ({ item }) => (item === 'Pen' ? 'p.4' : ''), '2026-10-05');
    expect(ledger.map((group) => group.date)).toEqual(['2026-10-02']);
    expect(ledger[0].items.map((item) => item.item)).toEqual(['詞語']);
    expect(ledger[0].items[0].students[0]).toMatchObject({ name: 'Amy', submitted: false });
  });

  it('announces open dates with class-number labels, nearest date first', () => {
    const madeUp = new Set([makeupKey('log-ben', '英文', 'WS1')]);
    const blocks = openMissingAnnouncement(buildMissingLedger(logs, madeUp, () => '', '2026-10-05'));
    expect(blocks.map((block) => block.isoDate)).toEqual(['2026-10-02', '2026-10-01']);
    expect(formatMissingAnnouncement(blocks[0])).toBe(
      `${blocks[0].date}\n中文 · 詞語: 2 Amy\n英文 · WS1: 2 Amy`,
    );
    expect(blocks[0].lines.join('\n')).not.toContain('Ben');
  });
});

describe('submittedKeysWithHandedIn', () => {
  it('crosses a morning-duty name when that student is ticked handed in', () => {
    const keys = submittedKeysWithHandedIn(
      logs,
      new Set(),
      new Set([handedInKey('amy', '2026-10-02', '英文', 'WS1')]),
    );
    const ledger = buildMissingLedger(logs, keys, () => '', '2026-10-05');
    const ws1 = ledger.find((group) => group.date === '2026-10-02')?.items.find((item) => item.item === 'WS1');
    expect(ws1?.students.find((student) => student.studentId === 'amy')?.submitted).toBe(true);
    expect(ws1?.students.find((student) => student.studentId === 'ben')?.submitted).toBe(false);
    const block = openMissingAnnouncement(ledger).find((item) => item.isoDate === '2026-10-02');
    expect(block?.lines).toEqual(['中文 · 詞語: 2 Amy', '英文 · WS1: 1 Ben']);
  });
});

describe('missingLogsFromEnglishMarks', () => {
  const students = [
    { id: 'amy', name: 'Amy', className: '4A', classNumber: 1 },
    { id: 'ben', name: 'Ben', className: '4A', classNumber: 2 },
    { id: 'cara', name: 'Cara', className: '4A', classNumber: 3 },
  ];

  it('lists classmates who were not ticked handed in after a record is updated', () => {
    const englishLogs = missingLogsFromEnglishMarks(students, [
      { className: '4A', date: '2026-10-29', subject: '英文', item: 'Writing File', studentId: 'amy', handedIn: true },
      { className: '4A', date: '2026-10-29', subject: '英文', item: 'WS File', studentId: 'ben', handedIn: false },
    ]);
    const ledger = buildMissingLedger(englishLogs, new Set(), () => '', '2026-10-30');
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

describe('missing tally', () => {
  const roster = [
    { id: 'kylie', name: 'Kylie', className: '4A', classNumber: 4, username: 'kylie' },
    { id: 'belle', name: 'Belle', className: '4A', classNumber: 19, username: 'belle' },
    { id: 'tester', name: 'Test Pupil', className: '4A', classNumber: 7, username: 'test_4a' },
    { id: 'erin', name: 'Erin', className: '4A', classNumber: 12, username: 'erin' },
    { id: 'sophie', name: 'Sophie', className: '4A', classNumber: 10, username: 'sophie' },
  ];

  it('rejects usernames that contain test, in any case', () => {
    expect(isTestUsername('test_4a')).toBe(true);
    expect(isTestUsername('4ATest')).toBe(true);
    expect(isTestUsername('erin')).toBe(false);
    expect(isTestUsername(null)).toBe(false);
  });

  it('keeps a real missing record apart from a row nobody clicked', () => {
    expect(classifyHomeworkMark({ dutyStatus: 'missing', inMissingItems: true, handedIn: false })).toBe('missing');
    expect(classifyHomeworkMark({ dutyStatus: 'todo', inMissingItems: false, handedIn: false })).toBe('unclicked');
    expect(classifyHomeworkMark({ dutyStatus: '', inMissingItems: false, handedIn: false })).toBe('unclicked');
    expect(classifyHomeworkMark({ dutyStatus: 'absent', inMissingItems: true, handedIn: false })).toBe('absent');
    expect(classifyHomeworkMark({ dutyStatus: 'exempted', inMissingItems: false, handedIn: false })).toBe('exempt');
    expect(classifyHomeworkMark({ dutyStatus: 'submitted', inMissingItems: false, handedIn: true })).toBe('hidden');
  });

  it('counts missing and not-clicked separately, and drops test accounts', () => {
    const appearances = listHomeworkAppearances(
      roster,
      [
        { studentId: 'kylie', date: '2026-11-16', status: 'missing', missingItems: { 中文: ['小練筆'] }, logId: 'log-kylie' },
        { studentId: 'belle', date: '2026-11-16', status: 'absent', missingItems: {}, logId: 'log-belle' },
        { studentId: 'erin', date: '2026-11-16', status: 'exempted', missingItems: {}, logId: 'log-erin' },
        { studentId: 'tester', date: '2026-11-16', status: 'missing', missingItems: { 中文: ['小練筆'] }, logId: 'log-test' },
      ],
      [{ date: '2026-11-16', className: '4A', subject: '中文', item: '小練筆' }],
      new Set(),
      new Set(),
    );
    expect(appearances.map((row) => `${row.name}:${row.mark}`).sort()).toEqual([
      'Belle:absent',
      'Erin:exempt',
      'Kylie:missing',
      'Sophie:unclicked',
    ]);
    const tally = buildMissingTally(roster, appearances);
    expect(tally.map((row) => row.name)).toEqual(['Kylie', 'Belle', 'Erin', 'Sophie']);
    expect(tally.find((row) => row.name === 'Kylie')).toMatchObject({ missing: 1, unclicked: 0 });
    expect(tally.find((row) => row.name === 'Sophie')).toMatchObject({ missing: 0, unclicked: 1 });
    expect(tally.find((row) => row.name === 'Belle')).toMatchObject({ missing: 0, absent: 1 });
    expect(sortMissingTally(tally, 'count').map((row) => row.name)).toEqual(['Kylie', 'Sophie', 'Erin', 'Belle']);
    expect(sortMissingTally(tally, 'number').map((row) => row.classNumber)).toEqual([4, 10, 12, 19]);

    const logs = appearances.map((row) => ({
      id: row.logId,
      logDate: row.date,
      className: row.className,
      studentId: row.studentId,
      studentName: row.name,
      classNumber: row.classNumber,
      missingItems: { [row.subject]: [row.item] },
    }));
    const ledger = buildMissingLedger(logs, new Set(), () => '', '2026-11-16', ({ studentId, date, subject, item }) => (
      appearances.find((row) => row.studentId === studentId && row.date === date && row.subject === subject && row.item === item)?.mark || 'missing'
    ));
    const announced = openMissingAnnouncement(ledger);
    expect(announced[0]?.lines.join('\n') || '').toContain('Kylie');
    expect(announced[0]?.lines.join('\n') || '').not.toContain('Belle');
    expect(announced[0]?.lines.join('\n') || '').not.toContain('Test');
  });
});
