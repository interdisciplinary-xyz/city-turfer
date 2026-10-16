import type { ActivityListItem } from '../../contract';
import { activityStats, weekStartOf } from '../activity-stats';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const item = (id: string, type: ActivityListItem['type'], startedAt: number, distanceM: number): ActivityListItem => ({
  id,
  type,
  name: id,
  startedAt,
  distanceM,
  movingS: distanceM, // 1 m/s keeps the arithmetic obvious
  estimatedDistanceM: 0,
  preview: [],
});

describe('activityStats', () => {
  const now = at(2026, 10, 16); // Friday

  it('starts weeks on local Monday', () => {
    expect(weekStartOf(now)).toBe(new Date(2026, 9, 12).getTime());
    expect(weekStartOf(at(2026, 10, 12, 0))).toBe(new Date(2026, 9, 12).getTime());
    expect(weekStartOf(at(2026, 10, 11, 23))).toBe(new Date(2026, 9, 5).getTime());
  });

  it('totals this week, the last 8 weeks and each type', () => {
    const s = activityStats(
      [
        item('a', 'walk', at(2026, 10, 16), 4000),
        item('b', 'cycle', at(2026, 10, 13), 6000),
        item('c', 'run', at(2026, 10, 11), 5000), // previous week (Sunday)
        item('d', 'walk', at(2026, 6, 1), 1000), // older than 8 weeks: all-time only
      ],
      now
    );
    expect(s.thisWeek).toMatchObject({ count: 2, distanceM: 10_000, movingS: 10_000 });
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks[6]).toMatchObject({ count: 1, distanceM: 5000 });
    expect(s.weeks.reduce((n, w) => n + w.count, 0)).toBe(3);
    expect(s.byType.walk).toMatchObject({ count: 2, distanceM: 5000 });
    expect(s.allTime).toMatchObject({ count: 4, distanceM: 16_000 });
  });
});
