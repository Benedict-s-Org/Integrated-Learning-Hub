export type HomeworkBadge = 'missing' | 'on_time' | 'late';

export function homeworkBadge(input: {
  onTime: boolean;
  late: boolean;
  makeup: boolean;
}): HomeworkBadge {
  if (input.onTime && !input.late) return 'on_time';
  if (input.late || input.makeup) return 'late';
  return 'missing';
}

/** The handbook suffix is a same-day mark. Older dates keep the record without the label. */
export function handbookName(name: string, recordDate: string, today: string, marked: boolean): string {
  if (!marked || recordDate !== today) return name;
  return `${name} (Handbook)`;
}

export function nextCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export type HomeworkAnalyticsRow = {
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  subject: string;
  item: string;
  status: HomeworkBadge;
  handbookThatDay: boolean;
  stillMissingNextDay: boolean;
  handbooksBeforeSubmit: number;
};

type Assignment = { className: string; date: string; subject: string; item: string };
type Check = {
  studentId: string;
  date: string;
  subject: string;
  item: string;
  handedIn: boolean;
  isLate: boolean;
  updatedOn?: string;
};
type Student = { id: string; name: string; className: string };

export function buildHomeworkAnalytics(input: {
  students: Student[];
  assignments: Assignment[];
  checks: Check[];
  handbookDates: { studentId: string; date: string }[];
  today: string;
}): HomeworkAnalyticsRow[] {
  const checks = new Map<string, Check>();
  for (const check of input.checks) {
    checks.set(`${check.studentId}|${check.date}|${check.subject}|${check.item}`, check);
  }
  const booksByStudent = new Map<string, string[]>();
  for (const mark of input.handbookDates) {
    const list = booksByStudent.get(mark.studentId) ?? [];
    list.push(mark.date);
    booksByStudent.set(mark.studentId, list);
  }

  const rows: HomeworkAnalyticsRow[] = [];
  for (const student of input.students) {
    const books = booksByStudent.get(student.id) ?? [];
    for (const item of input.assignments) {
      if (item.className !== student.className) continue;
      const check = checks.get(`${student.id}|${item.date}|${item.subject}|${item.item}`);
      const status = homeworkBadge({
        onTime: Boolean(check?.handedIn && !check.isLate),
        late: Boolean(check?.handedIn && check.isLate),
        makeup: false,
      });
      const handbookThatDay = books.includes(item.date);
      const stillMissingNextDay = status === 'missing'
        && handbookThatDay
        && input.today >= nextCalendarDate(item.date);
      const until = status === 'missing' ? input.today : (check?.updatedOn || input.today);
      const handbooksBeforeSubmit = books.filter((date) => date >= item.date && date <= until).length;
      rows.push({
        studentId: student.id,
        studentName: student.name,
        className: student.className,
        date: item.date,
        subject: item.subject,
        item: item.item,
        status,
        handbookThatDay,
        stillMissingNextDay,
        handbooksBeforeSubmit,
      });
    }
  }
  rows.sort((a, b) => (
    b.date.localeCompare(a.date)
    || a.className.localeCompare(b.className)
    || a.studentName.localeCompare(b.studentName)
    || a.item.localeCompare(b.item)
  ));
  return rows;
}
