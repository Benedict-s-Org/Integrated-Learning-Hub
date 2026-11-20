import { describe, expect, it } from 'vitest';
import {
  attachHandedInClassmates,
  buildByStudentColumns,
  buildMissingLedger,
  buildMissingTally,
  classifyHomeworkMark,
  clearMissingItemsForSubmittedDuties,
  collectClearedDutyKeys,
  buildMissingTallyFromLedger,
  enrichLedgerWithDutyMarks,
  combineDutyAndEnglishMissingLogs,
  expandGeneralMissingDutyLogs,
  mergeDutyMissingItems,
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
  type LedgerDateGroup,
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
    const withHandedIn = attachHandedInClassmates(ledger, [{
      className: '4A',
      date: '2026-10-29',
      subject: '英文',
      item: 'Writing File',
      studentId: 'amy',
      name: 'Amy',
      classNumber: 1,
    }]);
    expect(withHandedIn[0].items.find((item) => item.item === 'Writing File')?.students.map((student) => student.name)).toEqual(['Amy', 'Ben', 'Cara']);
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
    expect(classifyHomeworkMark({ dutyStatus: 'submitted', inMissingItems: true, handedIn: false })).toBe('hidden');
    // Makeup click in Missing Homework must hide the row even if duty.missing_items still lists it.
    expect(classifyHomeworkMark({ dutyStatus: 'missing', inMissingItems: true, handedIn: true })).toBe('hidden');
  });

  it('clears missing-list rows after 交齊功課 (submitted duty)', () => {
    const cleared = collectClearedDutyKeys([
      { studentId: 'erin', date: '2026-11-17', status: 'submitted' },
      { studentId: 'belle', date: '2026-11-17', status: 'missing' },
    ]);
    expect(cleared.has(['erin', '2026-11-17'].join('\0'))).toBe(true);
    const logs = clearMissingItemsForSubmittedDuties(
      [
        {
          id: 'english|erin|2026-11-17',
          logDate: '2026-11-17',
          className: '4A',
          studentId: 'erin',
          studentName: 'Erin',
          classNumber: 12,
          missingItems: { 中文: ['作文'] },
        },
        {
          id: 'english|belle|2026-11-17',
          logDate: '2026-11-17',
          className: '4A',
          studentId: 'belle',
          studentName: 'Belle',
          classNumber: 19,
          missingItems: { 中文: ['作文'] },
        },
      ],
      cleared,
    );
    expect(logs.map((log) => log.studentId)).toEqual(['belle']);
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
    expect(sortMissingTally(tally, 'name').map((row) => row.name)).toEqual(['Belle', 'Erin', 'Kylie', 'Sophie']);

    const ledger = enrichLedgerWithDutyMarks(
      buildMissingLedger(
        appearances
          .filter((row) => row.mark === 'missing')
          .map((row) => ({
            id: row.logId,
            logDate: row.date,
            className: row.className,
            studentId: row.studentId,
            studentName: row.name,
            classNumber: row.classNumber,
            missingItems: { [row.subject]: [row.item] },
          })),
        new Set(),
        () => '',
        '2026-11-16',
      ),
      appearances,
      () => '',
      '2026-11-16',
    );
    const names = ledger[0]?.items[0]?.students.map((student) => `${student.name}:${student.mark}`) || [];
    expect(names).toEqual(expect.arrayContaining([
      'Kylie:missing',
      'Sophie:unclicked',
      'Belle:absent',
      'Erin:exempt',
    ]));
    expect(names.join('\n')).not.toContain('Test');
  });

  it('does not inflate an explicit partial 欠 list with English-inferred items', () => {
    const duties = mergeDutyMissingItems(
      [
        {
          studentId: 'abby',
          date: '2026-11-18',
          status: 'missing',
          missingItems: { 英文: ['Vocab Booklet'] },
          logId: 'duty-abby',
        },
      ],
      [
        {
          studentId: 'abby',
          date: '2026-11-18',
          missingItems: { 英文: ['Vocab Booklet', 'Genre Analysis'], 數學: ['作業'] },
          logId: 'english|abby|2026-11-18',
        },
      ],
    );
    expect(duties[0]?.missingItems).toEqual({ 英文: ['Vocab Booklet'] });
  });

  it('does not reinflate English items after makeup emptied a missing duty day', () => {
    const duties = mergeDutyMissingItems(
      [
        {
          studentId: 'abby',
          date: '2026-11-18',
          status: 'missing',
          missingItems: {},
          logId: 'duty-abby',
        },
      ],
      [
        {
          studentId: 'abby',
          date: '2026-11-18',
          missingItems: { 英文: ['Vocab Booklet', 'Genre Analysis'] },
          logId: 'english|abby|2026-11-18',
        },
      ],
    );
    expect(duties[0]?.missingItems).toEqual({});
  });

  it('expands Class Dashboard general 欠 (empty items) to that day\'s listed homework', () => {
    const listed = new Map<string, Record<string, string[]>>([
      ['4A|2026-11-20', { 英文: ['Vocab Booklet', 'Genre Analysis'], 數學: ['WS'] }],
    ]);
    const expanded = expandGeneralMissingDutyLogs(
      [
        {
          id: 'duty-abby',
          logDate: '2026-11-20',
          className: '4A',
          studentId: 'abby',
          studentName: 'Abby',
          classNumber: 1,
          missingItems: {},
          status: 'missing',
        },
        {
          id: 'duty-ben',
          logDate: '2026-11-20',
          className: '4A',
          studentId: 'ben',
          studentName: 'Ben',
          classNumber: 2,
          missingItems: { 英文: ['Vocab Booklet'] },
          status: 'missing',
        },
        {
          id: 'duty-cara',
          logDate: '2026-11-20',
          className: '4A',
          studentId: 'cara',
          studentName: 'Cara',
          classNumber: 3,
          missingItems: {},
          status: 'submitted',
        },
      ],
      listed,
    );
    expect(expanded.find((log) => log.studentId === 'abby')?.missingItems).toEqual({
      英文: ['Vocab Booklet', 'Genre Analysis'],
      數學: ['WS'],
    });
    expect(expanded.find((log) => log.studentId === 'ben')?.missingItems).toEqual({
      英文: ['Vocab Booklet'],
    });
    expect(expanded.find((log) => log.studentId === 'cara')).toBeUndefined();
  });

  it('keeps ledger columns on the duty partial 欠 list instead of English-inferred extras', () => {
    const dutyLogs: MissingLogInput[] = [
      {
        id: 'duty-abby',
        logDate: '2026-11-18',
        className: '4A',
        studentId: 'abby',
        studentName: 'Abby',
        classNumber: 1,
        missingItems: { 英文: ['Vocab Booklet'] },
      },
    ];
    const englishLogs: MissingLogInput[] = [
      {
        id: 'english|abby|2026-11-18',
        logDate: '2026-11-18',
        className: '4A',
        studentId: 'abby',
        studentName: 'Abby',
        classNumber: 1,
        missingItems: { 英文: ['Vocab Booklet', 'Genre Analysis'], 數學: ['作業'] },
      },
      {
        id: 'english|ben|2026-11-18',
        logDate: '2026-11-18',
        className: '4A',
        studentId: 'ben',
        studentName: 'Ben',
        classNumber: 2,
        missingItems: { 英文: ['Genre Analysis'] },
      },
    ];
    const combined = combineDutyAndEnglishMissingLogs(
      dutyLogs,
      englishLogs,
      [
        { studentId: 'abby', date: '2026-11-18', status: 'missing' },
        { studentId: 'ben', date: '2026-11-18', status: 'todo' },
      ],
    );
    const ledger = buildMissingLedger(combined, new Set(), () => '', '2026-11-18');
    const abbyItems = ledger.flatMap((group) => group.items.flatMap((item) => (
      item.students.filter((student) => student.studentId === 'abby').map(() => item.item)
    )));
    expect(abbyItems).toEqual(['Vocab Booklet']);
    expect(combined.map((log) => log.studentId).sort()).toEqual(['abby', 'ben']);
  });

  it('counts the sidebar from the same ledger rows the columns show', () => {
    const duties = mergeDutyMissingItems(
      [
        { studentId: 'erin', date: '2026-11-10', status: 'todo', missingItems: {}, logId: 'duty-erin' },
        { studentId: 'shawnette', date: '2026-11-10', status: 'todo', missingItems: {}, logId: 'duty-shaw' },
      ],
      [
        {
          studentId: 'erin',
          date: '2026-11-10',
          missingItems: { 英文: ['BOB', 'Grammar', 'Reading'] },
          logId: 'english|erin|2026-11-10',
        },
      ],
    );
    const appearances = listHomeworkAppearances(
      roster,
      duties,
      [
        { date: '2026-11-10', className: '4A', subject: '英文', item: 'BOB' },
        { date: '2026-11-10', className: '4A', subject: '英文', item: 'Grammar' },
        { date: '2026-11-10', className: '4A', subject: '英文', item: 'Reading' },
        { date: '2026-11-10', className: '4A', subject: '中文', item: '小練筆' },
      ],
      new Set(),
      new Set(),
    );
    expect(appearances.filter((row) => row.name === 'Erin' && row.mark === 'missing')).toHaveLength(3);

    const ledger = enrichLedgerWithDutyMarks(
      buildMissingLedger(
        [
          {
            id: 'english|erin|2026-11-10',
            logDate: '2026-11-10',
            className: '4A',
            studentId: 'erin',
            studentName: 'Erin',
            classNumber: 12,
            missingItems: { 英文: ['BOB', 'Grammar', 'Reading'] },
          },
        ],
        new Set(),
        () => '',
        '2026-11-10',
      ),
      appearances,
      () => '',
      '2026-11-10',
    );
    const erinMarks = ledger.flatMap((group) => group.items.flatMap((item) => (
      item.students.filter((student) => student.name === 'Erin').map((student) => student.mark || 'missing')
    )));
    expect(erinMarks.filter((mark) => mark === 'missing')).toHaveLength(3);

    const tally = buildMissingTallyFromLedger(roster, ledger);
    expect(tally.find((row) => row.name === 'Erin')).toMatchObject({ missing: 3, unclicked: 1 });
    expect(tally.find((row) => row.name === 'Sophie')).toMatchObject({ missing: 0, unclicked: 4 });
  });

  it('lets absent and exempt rows count as handed in once submitted', () => {
    const ledger = enrichLedgerWithDutyMarks(
      [],
      [
        {
          date: '2026-11-10',
          className: '4A',
          subject: '中文',
          item: '小練筆',
          studentId: 'erin',
          name: 'Erin',
          classNumber: 12,
          mark: 'exempt',
          logId: 'log-erin',
          submitted: true,
        },
        {
          date: '2026-11-10',
          className: '4A',
          subject: '數學',
          item: 'WS',
          studentId: 'erin',
          name: 'Erin',
          classNumber: 12,
          mark: 'exempt',
          logId: 'log-erin',
          submitted: false,
        },
        {
          date: '2026-11-10',
          className: '4A',
          subject: '常識',
          item: 'WS',
          studentId: 'belle',
          name: 'Belle',
          classNumber: 19,
          mark: 'absent',
          logId: 'log-belle',
          submitted: true,
        },
        {
          date: '2026-11-10',
          className: '4A',
          subject: '英文',
          item: 'BOB',
          studentId: 'belle',
          name: 'Belle',
          classNumber: 19,
          mark: 'absent',
          logId: 'log-belle',
          submitted: false,
        },
      ],
      () => '',
      '2026-11-10',
    );
    expect(buildMissingTallyFromLedger(roster, ledger).find((row) => row.name === 'Erin')).toMatchObject({
      exempt: 1,
    });
    expect(buildMissingTallyFromLedger(roster, ledger).find((row) => row.name === 'Belle')).toMatchObject({
      absent: 1,
    });
  });
});

describe('buildByStudentColumns', () => {
  it('puts open students left by class number and clear students right, farther dates on top', () => {
    const groups: LedgerDateGroup[] = [
      {
        date: '2026-11-10',
        complete: false,
        items: [{
          subject: '中文',
          item: '作文',
          detail: '',
          complete: false,
          students: [
            {
              logId: 'a',
              studentId: 'erin',
              name: 'Erin',
              className: '4A',
              classNumber: 12,
              submitted: false,
              mark: 'missing',
            },
            {
              logId: 'b',
              studentId: 'amy',
              name: 'Amy',
              className: '4A',
              classNumber: 1,
              submitted: true,
              mark: 'missing',
            },
          ],
        }],
      },
      {
        date: '2026-11-16',
        complete: false,
        items: [{
          subject: '英文',
          item: 'WS1',
          detail: '',
          complete: false,
          students: [
            {
              logId: 'c',
              studentId: 'erin',
              name: 'Erin',
              className: '4A',
              classNumber: 12,
              submitted: false,
              mark: 'unclicked',
            },
          ],
        }],
      },
    ];
    const people = [
      { id: 'amy', name: 'Amy', classNumber: 1 },
      { id: 'erin', name: 'Erin', classNumber: 12 },
      { id: 'roy', name: 'Roy', classNumber: 25 },
    ];
    const cols = buildByStudentColumns(groups, people, '2026-11-17');
    // Open pupils first by class number (Erin #12), then clear pupils by class number (Amy #1, Roy #25).
    expect(cols.map((col) => col.studentId)).toEqual(['erin', 'amy', 'roy']);
    expect(cols.map((col) => col.classNumber)).toEqual([12, 1, 25]);
    expect(cols[0].clear).toBe(false);
    expect(cols[0].openDates.map((block) => block.date)).toEqual(['2026-11-10', '2026-11-16']);
    expect(cols[0].openDates[0].rows.map((row) => row.item)).toEqual(['作文']);
    expect(cols[1].clear).toBe(true);
    expect(cols[1].doneDates[0]?.rows[0]?.item).toBe('作文');
    expect(cols[2].clear).toBe(true);
    expect(cols[2].doneDates).toEqual([]);
  });
});
