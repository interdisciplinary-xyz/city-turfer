import { ACHIEVEMENT_GROUPS, type AchievementInput, evaluateAchievements } from '../achievements';

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

  it('counts different weeks, not weeks in a row, so a gap loses nothing', () => {
    // Four separate weeks spread over two months, with gaps of several weeks between them.
    const a = byId({
      activities: [at(2026, 8, 3), at(2026, 8, 4), at(2026, 8, 24), at(2026, 9, 21), at(2026, 10, 12)].map(
        (startedAt) => ({ type: 'walk' as const, startedAt, distanceM: 1000 })
      ),
      turfCells: 0,
      strongCells: 0,
    });
    expect(a['four-weeks']).toMatchObject({ unlocked: true, current: 4, unit: 'weeks' });
    expect(a['season-ticket']).toMatchObject({ unlocked: false, current: 4, target: 12 });
  });

  it('climbs the turf and glow ladders from cell counts', () => {
    const a = byId({ activities: [], turfCells: 1200, strongCells: 60 });
    expect(['neighbourhood', 'district', 'turf-lord'].every((id) => a[id].unlocked)).toBe(true);
    expect(a['across-town']).toMatchObject({ unlocked: false, current: 1200, target: 5000 });
    expect(a['first-glow'].unlocked).toBe(true);
    expect(a['stronghold'].unlocked).toBe(true);
    expect(a['home-ground']).toMatchObject({ unlocked: false, current: 60 });
  });

  it('adds 10K for one activity and 500 km in total', () => {
    const ride = (distanceM: number, n = 1) =>
      byId({
        activities: Array.from({ length: n }, (_, i) => ({
          type: 'cycle' as const,
          startedAt: at(2026, 9, 1 + i),
          distanceM,
        })),
        turfCells: 0,
        strongCells: 0,
      });
    expect(ride(9_990)['ten-k'].unlocked).toBe(false);
    expect(ride(10_000)['ten-k'].unlocked).toBe(true);
    expect(ride(50_000, 9)['five-hundred-km']).toMatchObject({ unlocked: false, current: 450 });
    expect(ride(50_000, 10)['five-hundred-km'].unlocked).toBe(true);
  });

  it('keeps ids unique and each group together, in the published group order', () => {
    const list = evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 });
    expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    const order = list.map((x) => x.group).filter((g, i, all) => g !== all[i - 1]);
    expect(order).toEqual([...ACHIEVEMENT_GROUPS]);
  });

  it('keeps every id that shipped before, so nobody loses an unlock', () => {
    const ids = evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 }).map((x) => x.id);
    const shippedInV020 = [
      'first-steps',
      'all-rounder',
      'five-k',
      'half-marathon',
      'half-century-ride',
      'hundred-km',
      'regular',
      'early-bird',
      'night-owl',
      'neighbourhood',
      'turf-lord',
      'stronghold',
    ];
    expect(ids).toEqual(expect.arrayContaining(shippedInV020));
  });
});
