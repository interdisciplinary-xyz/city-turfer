import { ACTIVITY_TYPES } from '@/constants/activity';
import { type ActivityType, weekStartOf } from '@/shared-kernel';

import type { ActivityListItem } from '../contract';

export interface Totals {
  count: number;
  distanceM: number;
  movingS: number;
}
export interface WeekBar extends Totals {
  weekStart: number; // local Monday 00:00, epoch ms
}
export interface ActivityStats {
  thisWeek: Totals;
  weeks: WeekBar[]; // oldest first, ends with the current week
  byType: Record<ActivityType, Totals>;
  allTime: Totals;
}

const empty = (): Totals => ({ count: 0, distanceM: 0, movingS: 0 });
const add = (t: Totals, a: ActivityListItem) => {
  t.count++;
  t.distanceM += a.distanceM;
  t.movingS += a.movingS;
};

/** Totals for the Stats tab; distances include street-routed gap estimates (as in History). */
export function activityStats(items: readonly ActivityListItem[], now: number, weekCount = 8): ActivityStats {
  const current = weekStartOf(now);
  const weeks: WeekBar[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    // Step back by calendar days (not 7 × 24 h) so DST changes keep Mondays aligned.
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    weeks.push({ weekStart: d.getTime(), ...empty() });
  }
  const byType = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, empty()])) as Record<ActivityType, Totals>;
  const allTime = empty();
  for (const a of items) {
    add(allTime, a);
    add(byType[a.type], a);
    const ws = weekStartOf(a.startedAt);
    const bar = weeks.find((w) => w.weekStart === ws);
    if (bar) add(bar, a);
  }
  return { thisWeek: weeks[weeks.length - 1], weeks, byType, allTime };
}
