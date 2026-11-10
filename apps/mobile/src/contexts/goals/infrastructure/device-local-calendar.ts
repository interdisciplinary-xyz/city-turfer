import type { LocalDay } from '../contract';
import type { LocalCalendar } from '../domain/local-calendar';

const pad = (n: number) => String(n).padStart(2, '0');

const format = (d: Date): LocalDay => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local noon of a day: never skipped or repeated by a DST change, so day steps stay exact. */
function noonOf(day: LocalDay): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * The phone's calendar in its current time zone, through Date (no Expo). Days are stepped with
 * setDate at local noon and started with setHours(0), so 23- and 25-hour DST days are right.
 */
export const deviceLocalCalendar: LocalCalendar = {
  dayOf: (ms) => format(new Date(ms)),
  startOf: (day) => {
    const d = noonOf(day);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },
  addDays: (day, n) => {
    const d = noonOf(day);
    d.setDate(d.getDate() + n);
    return format(d);
  },
};
