import { describe, it, expect } from 'vitest';
import { handedInKey } from '@/lib/homework/missingLedger';
import { filterOutstandingHomework, groupOutstandingByDate } from '@/lib/homework/outstandingHomework';

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