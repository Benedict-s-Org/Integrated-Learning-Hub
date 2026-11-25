import { describe, it, expect } from 'vitest';
import { buildHomeworkDiary } from '@/lib/homework/homeworkDiary';

describe('buildHomeworkDiary', () => {
  it('keeps historical cumulative after later makeup', () => {
    const days = buildHomeworkDiary({
      dutyLogs: [
        { id: 'm', log_date: '2026-11-24', status: 'missing', missing_items: { 英文: ['A'] } },
        { id: 't', log_date: '2026-11-25', status: 'submitted', missing_items: null },
      ],
      makeupActions: [
        {
          log_id: 'm',
          log_date: '2026-11-24',
          subject: '英文',
          item: 'A',
          is_made_up: true,
          marked_at: '2026-11-25T01:00:00.000Z', // choose a stamp that is 2026-11-25 in HK
        },
      ],
    });
    const mon = days.find((d) => d.date === '2026-11-24')!;
    const tue = days.find((d) => d.date === '2026-11-25')!;
    expect(mon.cumulativeOutstanding.map((x) => x.item)).toContain('A');
    expect(tue.madeUpThatDay.map((x) => x.item)).toContain('A');
    expect(tue.cumulativeOutstanding.map((x) => x.item)).not.toContain('A');
  });
});