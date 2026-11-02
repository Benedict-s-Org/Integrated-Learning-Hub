import { describe, expect, it } from 'vitest';
import { buildHomeworkAnalytics, handbookName, homeworkBadge } from './homeworkBadges';

describe('homework badges', () => {
  it('keeps tracker ticks green and missing-page clicks grey', () => {
    expect(homeworkBadge({ onTime: true, late: false, makeup: false })).toBe('on_time');
    expect(homeworkBadge({ onTime: false, late: true, makeup: false })).toBe('late');
    expect(homeworkBadge({ onTime: false, late: false, makeup: true })).toBe('late');
    expect(homeworkBadge({ onTime: false, late: false, makeup: false })).toBe('missing');
  });

  it('shows the handbook label only on the same Hong Kong day', () => {
    expect(handbookName('Abby', '2026-11-02', '2026-11-02', true)).toBe('Abby (Handbook)');
    expect(handbookName('Abby', '2026-11-01', '2026-11-02', true)).toBe('Abby');
    expect(handbookName('Abby', '2026-11-02', '2026-11-02', false)).toBe('Abby');
  });

  it('counts handbooks and flags a miss that is still open the next day', () => {
    const rows = buildHomeworkAnalytics({
      today: '2026-11-03',
      students: [{ id: 'abby', name: 'Abby', className: '4A' }],
      assignments: [
        { className: '4A', date: '2026-11-02', subject: 'English', item: 'WB p.1' },
        { className: '4A', date: '2026-11-03', subject: 'English', item: 'WB p.2' },
      ],
      checks: [{
        studentId: 'abby',
        date: '2026-11-03',
        subject: 'English',
        item: 'WB p.2',
        handedIn: true,
        isLate: true,
        updatedOn: '2026-11-03',
      }],
      handbookDates: [
        { studentId: 'abby', date: '2026-11-02' },
        { studentId: 'abby', date: '2026-11-03' },
      ],
    });

    const first = rows.find((row) => row.item === 'WB p.1');
    const second = rows.find((row) => row.item === 'WB p.2');
    expect(first?.status).toBe('missing');
    expect(first?.stillMissingNextDay).toBe(true);
    expect(first?.handbooksBeforeSubmit).toBe(2);
    expect(second?.status).toBe('late');
    expect(second?.stillMissingNextDay).toBe(false);
    expect(second?.handbooksBeforeSubmit).toBe(1);
  });
});
