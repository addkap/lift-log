// Dates are plain "YYYY-MM-DD" strings in the phone's local time.
// We never use `new Date("2026-11-08")` because that is parsed as UTC and can show the wrong day.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in local time, e.g. "2026-11-21". */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number);
  return [y, m, d];
}

/** "Nov 8" */
export function formatShortDate(ymd: string): string {
  const [, m, d] = parts(ymd);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Sat, Nov 21" */
export function formatLongDate(ymd: string): string {
  const [y, m, d] = parts(ymd);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS[dow]}, ${MONTHS[m - 1]} ${d}`;
}

/** True for a real-looking YYYY-MM-DD string. */
export function isValidDate(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

/** Add (or subtract) whole days. Works on YYYY-MM-DD strings in local time. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = parts(ymd);
  return todayLocal(new Date(y, m - 1, d + n));
}

/** The Monday of the week containing this date. Weeks run Monday-Sunday,
 *  so a Saturday and Sunday workout land in the same week. */
export function weekStart(ymd: string): string {
  const [y, m, d] = parts(ymd);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}

/** "Mon" */
export function formatWeekday(ymd: string): string {
  const [y, m, d] = parts(ymd);
  return DAYS[new Date(y, m - 1, d).getDay()];
}
