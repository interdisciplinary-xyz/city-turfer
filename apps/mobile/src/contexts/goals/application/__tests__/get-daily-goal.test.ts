/**
 * GetDailyGoal reads the week first and goes further back only while the streak can run past it.
 * In-memory fakes; the SQL path is in infrastructure/__tests__/goals-sqlite.test.ts.
 */
import { DailyGoal, type GoalActivityStart, type GoalChange, goalStreak } from '../../domain/daily-goal';
import { deviceLocalCalendar as calendar } from '../../infrastructure/device-local-calendar';
import { GetDailyGoal } from '../use-cases';

// Local wall-clock instants (month 0-based, 2026): the same days in any machine time zone.
const at = (month: number, day: number, h = 8) => new Date(2026, month, day, h).getTime();
const nov = (day: number, h = 8) => at(10, day, h);

function setup(history: GoalChange[], metDays: number[], today = nov(20, 18)) {
  const starts: GoalActivityStart[] = metDays.map((t) => ({ startedAt: t, movingS: 30 * 60 }));
  const calls: [number, number][] = [];
  const useCase = new GetDailyGoal({
    goals: { get: async () => DailyGoal.rehydrate({ history, offerHiddenFlag: true }), save: async () => undefined },
    activities: {
      startsBetween: async (from, to) => {
        calls.push([from, to]);
        return starts.filter((s) => s.startedAt >= from && s.startedAt < to);
      },
    },
    calendar,
    clock: { now: () => today },
    afterCommit: () => undefined,
  });
  return { useCase, calls };
}

const change = (effectiveFrom: string, minutes = 30): GoalChange => ({ effectiveFrom, minutes, setAt: 0 });
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('GetDailyGoal', () => {
  it('reads only the week when a day of it was missed', async () => {
    // Goal since 1 September, met every day except the 17th.
    const met = [...range(1, 30).map((d) => at(8, d)), ...range(1, 31).map((d) => at(9, d))];
    met.push(
      ...range(1, 20)
        .filter((d) => d !== 17)
        .map((d) => nov(d))
    );
    const { useCase, calls } = setup([change('2026-09-01')], met);
    const v = await useCase.execute();
    expect(calls).toEqual([[calendar.startOf('2026-11-14'), calendar.startOf('2026-11-21')]]);
    expect(goalStreak(v)).toBe(3);
  });

  it('reads only the week when no goal was ever set', async () => {
    const { useCase, calls } = setup(
      [],
      range(1, 20).map((d) => nov(d))
    );
    expect((await useCase.execute()).metBeforeWeek).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('reads 28-day windows back until one holds a missed day', async () => {
    // Goal since 1 August, met every day from 1 October (and today, the 20th, not yet).
    const met = [...range(1, 31).map((d) => at(9, d)), ...range(1, 19).map((d) => nov(d))];
    const { useCase, calls } = setup([change('2026-08-01')], met);
    const v = await useCase.execute();
    expect(calls).toEqual([
      [calendar.startOf('2026-11-14'), calendar.startOf('2026-11-21')],
      [calendar.startOf('2026-10-17'), calendar.startOf('2026-11-14')],
      [calendar.startOf('2026-09-19'), calendar.startOf('2026-10-17')],
    ]);
    expect(v.metBeforeWeek).toBe(44); // 1 October – 13 November
    expect(goalStreak(v)).toBe(50);
  });

  it('stops at the first goal day, with a shorter last window', async () => {
    const met = range(1, 31).map((d) => at(9, d));
    met.push(...range(1, 20).map((d) => nov(d)));
    const { useCase, calls } = setup([change('2026-10-05')], met);
    const v = await useCase.execute();
    expect(calls).toEqual([
      [calendar.startOf('2026-11-14'), calendar.startOf('2026-11-21')],
      [calendar.startOf('2026-10-17'), calendar.startOf('2026-11-14')],
      [calendar.startOf('2026-10-05'), calendar.startOf('2026-10-17')],
    ]);
    expect(v.metBeforeWeek).toBe(40); // 5 October – 13 November
    expect(goalStreak(v)).toBe(47);
  });

  it('does not read before the week when the goal was first set inside it', async () => {
    const { useCase, calls } = setup(
      [change('2026-11-16')],
      range(1, 20).map((d) => nov(d))
    );
    expect(goalStreak(await useCase.execute())).toBe(5);
    expect(calls).toHaveLength(1);
  });
});
