export const CLASS_DASH_TZ = 'Asia/Hong_Kong';

export type ClassDashErrorCode =
  | 'outside_hours'
  | 'invalid_link'
  | 'class_unavailable'
  | 'access_denied'
  | 'action_rejected';

export function classDashErrorMessage(code: ClassDashErrorCode): string {
  switch (code) {
    case 'outside_hours':
      return 'Outside school hours. Class Dashboard guest links work Monday to Friday, 07:30–15:30 (Hong Kong time).';
    case 'invalid_link':
      return 'This link is invalid or has been disabled.';
    case 'class_unavailable':
      return 'This class is not available.';
    case 'access_denied':
      return 'Access denied.';
    case 'action_rejected':
      return 'This action could not be completed.';
  }
}

function hkParts(now: Date): { weekday: string; hour: number; minute: number; date: string } {
  const weekday = now.toLocaleDateString('en-US', { timeZone: CLASS_DASH_TZ, weekday: 'long' });
  const date = now.toLocaleDateString('en-CA', { timeZone: CLASS_DASH_TZ });
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: CLASS_DASH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hourStr, minuteStr] = time.split(':');
  return { weekday, hour: parseInt(hourStr, 10), minute: parseInt(minuteStr, 10), date };
}

export function isWithinClassDashHours(now: Date = new Date()): boolean {
  const { weekday, hour, minute } = hkParts(now);
  if (weekday === 'Saturday' || weekday === 'Sunday') return false;
  const val = hour * 100 + minute;
  return val >= 730 && val <= 1530;
}

export function getClassDashWindowEndISO(now: Date = new Date()): string | null {
  if (!isWithinClassDashHours(now)) return null;
  const { date } = hkParts(now);
  return new Date(`${date}T15:30:00+08:00`).toISOString();
}
