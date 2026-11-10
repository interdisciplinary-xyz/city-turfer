import type { LocalDay } from '../contract';

/**
 * Port: the device's local calendar. A day starts at local midnight, so a day may be 23 or 25 hours
 * long (DST); never step days by adding 24 h.
 */
export interface LocalCalendar {
  /** The local day an instant (epoch ms) falls on. */
  dayOf(ms: number): LocalDay;
  /** Epoch ms of the local start of a day. */
  startOf(day: LocalDay): number;
  /** The day `n` calendar days later (earlier when negative). */
  addDays(day: LocalDay, n: number): LocalDay;
}

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isLocalDay = (s: string): s is LocalDay => LOCAL_DAY.test(s);
