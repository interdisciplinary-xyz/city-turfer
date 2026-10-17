import { type AchievementInput, evaluateAchievements } from '../achievements';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const byId = (input: AchievementInput) => Object.fromEntries(evaluateAchievements(input).map((a) => [a.id, a]));

describe('evaluateAchievements', () => {
  it('starts with everything locked and zero progress', () => {
    const a = byId({ activities: [], turfCells: 0, strongCells: 0 });
    expect(Object.values(a).every((x) => !x.unlocked && x.current === 0)).toBe(true);
  });

  it('unlocks from activities and turf, capping progress at the target', () => {
    const a = byId({
      activities: [
        { type: 'walk', startedAt: at(2026, 10, 13, 6), distanceM: 4000 },
        { type: 'run', startedAt: at(2026, 10, 14), distanceM: 5200 },
        { type: 'cycle', startedAt: at(2026, 10, 15, 23), distanceM: 30_000 },
      ],
      turfCells: 172,
      strongCells: 12,
    });
    expect(a['first-steps']).toMatchObject({ unlocked: true, current: 1 });
    expect(a['all-rounder'].unlocked).toBe(true);
    expect(a['five-k']).toMatchObject({ unlocked: true, current: 5 });
    expect(a['half-marathon']).toMatchObject({ unlocked: false, current: 5.2 });
    expect(a['half-century-ride']).toMatchObject({ unlocked: false, current: 30 });
    expect(a['regular'].unlocked).toBe(true); // three in the week of Mon 12 Oct
    expect(a['early-bird'].unlocked).toBe(true);
    expect(a['night-owl'].unlocked).toBe(true);
    expect(a['neighbourhood']).toMatchObject({ unlocked: true, current: 100 });
    expect(a['turf-lord']).toMatchObject({ unlocked: false, current: 172 });
    expect(a['stronghold']).toMatchObject({ unlocked: false, current: 12 });
  });

  it('needs the full half-marathon distance, not the rounded 21.1 km', () => {
    const run = (distanceM: number) =>
      byId({ activities: [{ type: 'run', startedAt: at(2026, 10, 14), distanceM }], turfCells: 0, strongCells: 0 })[
        'half-marathon'
      ].unlocked;
    expect(run(21_090)).toBe(false);
    expect(run(21_100)).toBe(true);
  });

  it('counts activities per calendar week, not per 7 rolling days', () => {
    const a = byId({
      activities: [at(2026, 10, 10), at(2026, 10, 11), at(2026, 10, 12)].map((startedAt) => ({
        type: 'walk' as const,
        startedAt,
        distanceM: 1000,
      })),
      turfCells: 0,
      strongCells: 0,
    });
    expect(a['regular']).toMatchObject({ unlocked: false, current: 2 }); // Sat + Sun, then Monday starts a new week
  });
});
