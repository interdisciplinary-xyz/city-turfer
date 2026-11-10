import { DomainError } from '@/shared-kernel';

import { deviceLocalCalendar as calendar } from '../../infrastructure/device-local-calendar';
import {
  addLiveMovingTime,
  DailyGoal,
  DailyGoalMinutes,
  type GoalChange,
  goalDays,
  goalOn,
  goalStreak,
} from '../daily-goal';

// Local wall-clock instants (new Date(y, m, d, h, min)): the same days in any machine time zone.
const at = (day: number, h = 12, min = 0) => new Date(2026, 10, day, h, min).getTime(); // November 2026
const NOW = at(11, 18);

const change = (effectiveFrom: string, minutes: number, setAt = 0): GoalChange => ({ effectiveFrom, minutes, setAt });

describe('DailyGoalMinutes', () => {
  it.each([10, 15, 30, 180])('accepts %i', (n) => {
    expect(DailyGoalMinutes.of(n).minutes).toBe(n);
  });

  it.each([5, 185, 12, 0, -10, 30.5, Number.NaN])('rejects %p', (n) => {
    expect(() => DailyGoalMinutes.of(n)).toThrow(DomainError);
    expect(() => DailyGoalMinutes.of(n)).toThrow('goal.minutes-invalid');
  });
});

describe('goalOn', () => {
  const history = [change('2026-11-11', 45), change('2026-11-04', 30)];

  it('is null before the first change', () => {
    expect(goalOn('2026-11-03', history)).toBeNull();
  });
  it('applies from the day of a change on', () => {
    expect(goalOn('2026-11-04', history)).toBe(30);
    expect(goalOn('2026-11-10', history)).toBe(30);
    expect(goalOn('2026-11-11', history)).toBe(45);
    expect(goalOn('2026-12-01', history)).toBe(45);
  });
  it('reads 0 as off', () => {
    const off = [...history, change('2026-11-13', 0)];
    expect(goalOn('2026-11-12', off)).toBe(45);
    expect(goalOn('2026-11-13', off)).toBeNull();
    expect(goalOn('2026-11-20', [...off, change('2026-11-20', 20)])).toBe(20);
  });
  it('takes the latest of two rows for the same day', () => {
    expect(goalOn('2026-11-04', [change('2026-11-04', 60, 2), change('2026-11-04', 30, 1)])).toBe(60);
  });
});

describe('DailyGoal aggregate', () => {
  const fresh = () => DailyGoal.rehydrate({ history: [], offerHiddenFlag: false });

  it('starts with no goal and the offer shown', () => {
    const g = fresh();
    expect(g.goalOn('2026-11-11')).toBeNull();
    expect(g.offerHidden).toBe(false);
  });

  it('a change applies from today; earlier days keep the goal in force then', () => {
    const g = fresh();
    expect(g.set(30, '2026-11-09', 1)).toBe(true);
    expect(g.set(45, '2026-11-11', 2)).toBe(true);
    expect(g.goalOn('2026-11-08')).toBeNull();
    expect(g.goalOn('2026-11-10')).toBe(30);
    expect(g.goalOn('2026-11-11')).toBe(45);
    expect(g.pullEvents()).toEqual([
      { type: 'DailyGoalSet', v: 1, at: 1, effectiveFrom: '2026-11-09', minutes: 30 },
      { type: 'DailyGoalSet', v: 1, at: 2, effectiveFrom: '2026-11-11', minutes: 45 },
    ]);
  });

  it('two changes on the same day: the second replaces the first', () => {
    const g = fresh();
    g.set(30, '2026-11-11', 1);
    g.set(60, '2026-11-11', 2);
    expect(g.toState().history).toEqual([change('2026-11-11', 60, 2)]);
    expect(g.goalOn('2026-11-11')).toBe(60);
  });

  it('turning off stores 0 from today, keeps past days and keeps the offer hidden', () => {
    const g = fresh();
    g.set(30, '2026-11-09', 1);
    g.set(null, '2026-11-11', 2);
    expect(g.goalOn('2026-11-10')).toBe(30);
    expect(g.goalOn('2026-11-11')).toBeNull();
    expect(g.toState().history.at(-1)).toEqual(change('2026-11-11', 0, 2));
    expect(g.offerHidden).toBe(true);
  });

  it('records nothing when the goal does not change', () => {
    const g = fresh();
    expect(g.set(null, '2026-11-11', 1)).toBe(false);
    g.set(30, '2026-11-11', 2);
    g.pullEvents();
    expect(g.set(30, '2026-11-11', 3)).toBe(false);
    expect(g.pullEvents()).toEqual([]);
  });

  it('rejects minutes outside the range and leaves the goal as it was', () => {
    const g = fresh();
    g.set(30, '2026-11-11', 1);
    expect(() => g.set(185, '2026-11-11', 2)).toThrow('goal.minutes-invalid');
    expect(g.goalOn('2026-11-11')).toBe(30);
  });

  it('hides the offer once', () => {
    const g = fresh();
    expect(g.hideOffer(5)).toBe(true);
    expect(g.hideOffer(6)).toBe(false);
    expect(g.offerHidden).toBe(true);
    expect(g.pullEvents()).toEqual([{ type: 'DailyGoalOfferHidden', v: 1, at: 5 }]);
  });
});

describe('goalDays', () => {
  const today = calendar.dayOf(NOW);

  it('gives the last 7 days ending today, oldest first', () => {
    const week = goalDays([], [], calendar, today);
    expect(week.map((d) => d.day)).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
    expect(week.every((d) => d.goalMinutes === null && d.movingS === 0 && !d.met)).toBe(true);
  });

  it('counts an activity in full on the day it started (23:40–00:20 walk)', () => {
    const walk = { startedAt: at(9, 23, 40), movingS: 40 * 60 };
    const week = goalDays([walk], [change('2026-11-01', 30)], calendar, today);
    const byDay = Object.fromEntries(week.map((d) => [d.day, d]));
    expect(byDay['2026-11-09']).toMatchObject({ day: '2026-11-09', goalMinutes: 30, movingS: 2400, met: true });
    expect(byDay['2026-11-10']).toMatchObject({ day: '2026-11-10', goalMinutes: 30, movingS: 0, met: false });
  });

  it('sums all activities of a day and judges each day by the goal in force then', () => {
    const starts = [
      { startedAt: at(10, 0, 0), movingS: 20 * 60 },
      { startedAt: at(10, 18), movingS: 10 * 60 },
      { startedAt: at(11, 7), movingS: 30 * 60 },
      { startedAt: at(4, 12), movingS: 99 * 60 }, // before the week
    ];
    const week = goalDays(starts, [change('2026-11-01', 30), change('2026-11-11', 45)], calendar, today);
    expect(week.at(-2)).toMatchObject({ day: '2026-11-10', goalMinutes: 30, movingS: 1800, met: true });
    expect(week.at(-1)).toMatchObject({ day: '2026-11-11', goalMinutes: 45, movingS: 1800, met: false });
  });

  it('met needs moving seconds ≥ goal × 60', () => {
    const history = [change('2026-11-01', 30)];
    expect(goalDays([{ startedAt: at(11), movingS: 1799 }], history, calendar, today).at(-1)!.met).toBe(false);
    expect(goalDays([{ startedAt: at(11), movingS: 1800 }], history, calendar, today).at(-1)!.met).toBe(true);
  });
});

describe('addLiveMovingTime', () => {
  const view = DailyGoal.rehydrate({ history: [change('2026-11-01', 30)], offerHiddenFlag: false }).view(
    [{ startedAt: at(11, 8), movingS: 20 * 60 }],
    calendar,
    '2026-11-11'
  );

  it('adds live moving time to today and the last week entry, recomputing met', () => {
    const live = addLiveMovingTime(view, 10 * 60, at(11, 9));
    expect(live.today).toEqual({
      day: '2026-11-11',
      startsAt: calendar.startOf('2026-11-11'),
      goalMinutes: 30,
      movingS: 1800,
      met: true,
    });
    expect(live.week.at(-1)).toEqual(live.today);
    expect(live.week.slice(0, 6)).toEqual(view.week.slice(0, 6));
    expect(view.today.movingS).toBe(1200); // the stored view is untouched
  });

  it('adds a recording started before midnight to the day it started, not today', () => {
    const live = addLiveMovingTime(view, 35 * 60, at(10, 23, 40));
    expect(live.today).toBe(view.today);
    expect(live.week.at(-2)).toMatchObject({ day: '2026-11-10', movingS: 35 * 60, met: true });
  });

  it('ignores a start before the week shown', () => {
    expect(addLiveMovingTime(view, 600, at(1))).toBe(view);
  });

  it('ignores zero, negative or non-finite moving time', () => {
    expect(addLiveMovingTime(view, 0, at(11))).toBe(view);
    expect(addLiveMovingTime(view, -5, at(11))).toBe(view);
    expect(addLiveMovingTime(view, Number.NaN, at(11))).toBe(view);
  });

  it('never marks a day met without a goal', () => {
    const none = DailyGoal.rehydrate({ history: [], offerHiddenFlag: false }).view([], calendar, '2026-11-11');
    expect(addLiveMovingTime(none, 3600, at(11)).today).toMatchObject({ goalMinutes: null, movingS: 3600, met: false });
  });
});

describe('goalStreak', () => {
  // Goal 30 from 1 November; `met` lists the November days with 30 minutes out.
  const viewOn = (met: number[], today = '2026-11-20', history = [change('2026-11-01', 30)]) =>
    DailyGoal.rehydrate({ history, offerHiddenFlag: true }).view(
      met.map((d) => ({ startedAt: at(d, 8), movingS: 30 * 60 })),
      calendar,
      today
    );

  it('counts days in a row up to today once today is met', () => {
    expect(goalStreak(viewOn([17, 18, 19, 20]))).toBe(4);
  });

  it('keeps a run ending yesterday while today is not met yet', () => {
    expect(goalStreak(viewOn([17, 18, 19]))).toBe(3);
  });

  it('is broken by a day under the goal', () => {
    expect(goalStreak(viewOn([16, 18, 19]))).toBe(2);
    expect(goalStreak(viewOn([17, 18]))).toBe(0); // yesterday (19th) not met
  });

  it('reaches back past the 7 days shown', () => {
    const v = viewOn([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(v.metBeforeWeek).toBe(11);
    expect(goalStreak(v)).toBe(18);
  });

  it('stops at the day the goal was first set, or a day it was off', () => {
    expect(goalStreak(viewOn([10, 11, 12, 13, 14, 15, 16, 17, 18, 19], '2026-11-20', [change('2026-11-12', 30)]))).toBe(
      8
    );
    const off = [change('2026-11-01', 30), change('2026-11-15', 0), change('2026-11-16', 30)];
    expect(goalStreak(viewOn([12, 13, 14, 15, 16, 17, 18, 19, 20], '2026-11-20', off))).toBe(5);
  });

  it('judges each day by the goal in force then', () => {
    const history = [change('2026-11-01', 30), change('2026-11-19', 60)];
    expect(goalStreak(viewOn([17, 18, 19, 20], '2026-11-20', history))).toBe(0); // 30 min < 60 from the 19th
  });

  it('grows when a live recording meets today', () => {
    const v = viewOn([18, 19]);
    expect(goalStreak(v)).toBe(2);
    expect(goalStreak(addLiveMovingTime(v, 30 * 60, at(20, 9)))).toBe(3);
  });
});
