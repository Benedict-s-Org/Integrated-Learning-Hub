import { describe, it, expect } from 'vitest';
import { englishCheckLogId, handedInKey } from '@/lib/homework/missingLedger';
import {
  enrichOutstandingDetails,
  filterOutstandingHomework,
  groupOutstandingByDate,
  mergeOutstandingItems,
  outstandingFromEnglishLogs,
  outstandingEnglishGapsForStudent,
  outstandingFromOpenEnglishChecks,
} from '@/lib/homework/outstandingHomework';
import type { SubjectAssignmentMap } from '@/lib/homework/assignments';

describe('filterOutstandingHomework', () => {
  it('keeps prior missing items and drops today / made-up / handed-in', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-old',
          log_date: '2026-11-24',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Worksheet A', 'Worksheet B'] },
        },
        {
          id: 'log-today',
          log_date: '2026-11-26',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Today C'] },
        },
      ],
      makeupActions: [
        { log_id: 'log-old', subject: '英文', item: 'Worksheet B', is_made_up: true },
      ],
      handedInKeys: new Set(),
    });
    expect(items.map((i) => i.item)).toEqual(['Worksheet A']);
  });

  it('accumulates missing items across multiple past days', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-a',
          log_date: '2026-11-20',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 數學: ['Quiz 1'] },
        },
        {
          id: 'log-b',
          log_date: '2026-11-24',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Worksheet A'] },
        },
      ],
      makeupActions: [],
      handedInKeys: new Set(),
    });
    expect(items.map((i) => `${i.logDate}:${i.item}`).sort()).toEqual([
      '2026-11-20:Quiz 1',
      '2026-11-24:Worksheet A',
    ]);
  });

  it('excludes handed-in keys via handedInKey format', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-old',
          log_date: '2026-11-24',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Worksheet A', 'Worksheet B'] },
        },
      ],
      makeupActions: [],
      handedInKeys: new Set([
        handedInKey('s1', '2026-11-24', '英文', 'Worksheet B'),
      ]),
    });
    expect(items.map((i) => i.item)).toEqual(['Worksheet A']);
  });

  it('ignores logs that are not status missing', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-submitted',
          log_date: '2026-11-24',
          class: '4A',
          student_id: 's1',
          status: 'submitted',
          missing_items: { 英文: ['Should not appear'] },
        },
      ],
      makeupActions: [],
      handedInKeys: new Set(),
    });
    expect(items).toEqual([]);
  });

  it('includes english-tracker debt when classmates handed in', () => {
    const logId = englishCheckLogId('ben', '2026-11-24');
    const englishItems = outstandingFromEnglishLogs({
      todayIso: '2026-11-26',
      studentId: 'ben',
      englishLogs: [
        {
          id: logId,
          logDate: '2026-11-24',
          className: '4A',
          studentId: 'ben',
          studentName: 'Ben',
          classNumber: 2,
          missingItems: { 英文: ['Writing File'] },
        },
      ],
      madeUpKeys: new Set(),
      handedInKeys: new Set(),
    });
    expect(englishItems.map((i) => i.item)).toEqual(['Writing File']);
    expect(englishItems[0].logId).toBe(logId);
  });

  it('excludes english debt on or after todayIso', () => {
    const items = outstandingFromEnglishLogs({
      todayIso: '2026-11-26',
      studentId: 'ben',
      englishLogs: [
        {
          id: englishCheckLogId('ben', '2026-11-26'),
          logDate: '2026-11-26',
          className: '4A',
          studentId: 'ben',
          studentName: 'Ben',
          classNumber: 2,
          missingItems: { 英文: ['Today item'] },
        },
      ],
      madeUpKeys: new Set(),
      handedInKeys: new Set(),
    });
    expect(items).toEqual([]);
  });

  it('enriches detail from daily homework map', () => {
    const map = new Map<string, SubjectAssignmentMap>([
      [
        '2026-11-24|4A',
        { 英文: [{ name: 'Worksheet A', detail: 'p.3' }] },
      ],
    ]);
    const enriched = enrichOutstandingDetails(
      [
        {
          logId: 'log-old',
          logDate: '2026-11-24',
          className: '4A',
          studentId: 's1',
          subject: '英文',
          item: 'Worksheet A',
          detail: '',
        },
      ],
      map,
    );
    expect(enriched[0].detail).toBe('p.3');
  });

  it('dedupes duty and english rows via mergeOutstandingItems', () => {
    const duty = [
      {
        logId: 'log-a',
        logDate: '2026-11-20',
        className: '4A',
        studentId: 's1',
        subject: '數學',
        item: 'Quiz',
        detail: '',
      },
    ];
    const english = [
      {
        logId: englishCheckLogId('s1', '2026-11-22'),
        logDate: '2026-11-22',
        className: '4A',
        studentId: 's1',
        subject: '英文',
        item: 'WS',
        detail: '',
      },
    ];
    const merged = mergeOutstandingItems(duty, english);
    expect(merged).toHaveLength(2);
  });

  it('excludes log_date equal to todayIso', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-today',
          log_date: '2026-11-26',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Today only'] },
        },
      ],
      makeupActions: [],
      handedInKeys: new Set(),
    });
    expect(items).toEqual([]);
  });

  it('builds prior English debt from the student check rows only', () => {
    const items = outstandingFromOpenEnglishChecks({
      todayIso: '2026-11-26',
      studentId: 's1',
      fallbackClassName: '4A',
      checks: [
        {
          record_date: '2026-11-20',
          subject: '英文',
          item_name: 'WS1',
          handed_in: false,
          class_name: '4A',
        },
        {
          record_date: '2026-11-26',
          subject: '英文',
          item_name: 'Today',
          handed_in: false,
          class_name: '4A',
        },
        {
          record_date: '2026-11-19',
          subject: '英文',
          item_name: 'Done',
          handed_in: true,
          class_name: '4A',
        },
      ],
    });
    expect(items.map((i) => i.item)).toEqual(['WS1']);
    expect(items[0].logId).toBe(englishCheckLogId('s1', '2026-11-20'));
  });

  it('adds ledger-style English gaps when classmates handed in and student did not', () => {
    const items = outstandingEnglishGapsForStudent({
      todayIso: '2026-11-26',
      studentId: 's1',
      marks: [
        {
          className: '4A',
          date: '2026-11-20',
          subject: '英文',
          item: 'WS1',
          studentId: 's2',
          handedIn: true,
        },
        {
          className: '4A',
          date: '2026-11-20',
          subject: '英文',
          item: 'WS1',
          studentId: 's1',
          handedIn: false,
        },
      ],
    });
    expect(items.map((i) => i.item)).toEqual(['WS1']);
  });
});

describe('groupOutstandingByDate', () => {
  it('groups by date ascending (oldest first)', () => {
    const grouped = groupOutstandingByDate([
      {
        logId: 'b',
        logDate: '2026-11-24',
        className: '4A',
        studentId: 's1',
        subject: '英文',
        item: 'B',
        detail: '',
      },
      {
        logId: 'a',
        logDate: '2026-11-20',
        className: '4A',
        studentId: 's1',
        subject: '數學',
        item: 'A',
        detail: '',
      },
    ]);
    expect(grouped.map((g) => g.date)).toEqual(['2026-11-20', '2026-11-24']);
    expect(grouped[0].items.map((i) => i.item)).toEqual(['A']);
    expect(grouped[1].items.map((i) => i.item)).toEqual(['B']);
  });
});