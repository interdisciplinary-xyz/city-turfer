import type { T } from '@/i18n';
import type { DayStripDay } from '@/ui-kit/components';
import { formatWeekday, formatWeekdayShort } from '@/ui-kit/format';

import type { GoalDay, LocalDay } from '../contract';

/** Whole minutes shown for moving seconds (rounded down: 29:59 is not yet 30). */
export const minutesOf = (movingS: number): number => Math.floor(Math.max(0, movingS) / 60);

/** Share of the goal done, 0 without a goal (the bar clamps above 1). */
export const shareOf = (d: GoalDay): number => (d.goalMinutes ? d.movingS / (d.goalMinutes * 60) : 0);

/** Midday of a local 'YYYY-MM-DD' in ms (midday: never off by a day around a DST change). */
export function localDayMs(day: LocalDay): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

/** The week as day-strip columns: Intl weekday names, units spelled out for a screen reader. */
export function stripDays(week: GoalDay[], t: T<'goals'>, locale?: string): DayStripDay[] {
  return week.map((d, i) => {
    const ms = localDayMs(d.day);
    const today = i === week.length - 1;
    const name = today ? t('today') : formatWeekday(ms, locale);
    const done = minutesOf(d.movingS);
    return {
      key: d.day,
      label: formatWeekdayShort(ms, locale),
      progress: shareOf(d),
      met: d.met,
      noTarget: d.goalMinutes == null,
      current: today,
      accessibilityLabel:
        d.goalMinutes == null
          ? t('dayNoGoal', { day: name, done })
          : t('dayLabel', { day: name, done, goal: d.goalMinutes, met: d.met ? 'yes' : 'no' }),
      testID: `goal-day-${i}`,
    };
  });
}
