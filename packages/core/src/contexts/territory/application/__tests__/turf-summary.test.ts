import { weekStartOf } from '../../../../shared-kernel';
import type { CellGrid } from '../../domain/cell-grid';
import type { CellRow, TerritoryRepository } from '../../domain/territory-repository';
import { GetTurfSummary } from '../use-cases';

// Every date here is local time (new Date(y, m, d, h, min)), so the tests hold in any TZ
// (run with TZ=Europe/Warsaw, TZ=UTC, TZ=America/Los_Angeles, TZ=Pacific/Kiritimati).
const at = (month: number, day: number, h = 0, min = 0) => new Date(2026, month - 1, day, h, min).getTime();
const DAY = 86_400_000;
const CELL_M2 = 1_000_000; // 1 km² per cell keeps the expected numbers readable

function summaryAt(now: number, firstAts: number[]) {
  const rows: CellRow[] = firstAts.map((firstAt, i) => ({
    cell: `c${i}`,
    lat: 0,
    lon: 0,
    walk: 1,
    run: 0,
    cycle: 0,
    firstAt,
  }));
  const repo = { allCells: async () => rows } as unknown as TerritoryRepository;
  const grid = { areaM2: () => CELL_M2 } as unknown as CellGrid;
  return new GetTurfSummary({
    repo,
    grid,
    tracks: { trackOf: async () => [] },
    clock: { now: () => now },
    afterCommit: () => undefined,
  }).execute();
}

describe('GetTurfSummary: new this week is the calendar week (local Monday 00:00), like the This week card', () => {
  it('on Monday morning, a cell first claimed on Sunday is not this week; one at Monday 00:30 is', async () => {
    const monday = at(10, 26, 8); // Mon 26 Oct 2026, 08:00 (the day after the EU clocks went back)
    expect(weekStartOf(monday)).toBe(at(10, 26));
    const s = await summaryAt(monday, [at(10, 25, 23, 59), at(10, 25, 12), at(10, 26, 0, 30)]);
    expect(s.newThisWeekKm2).toBe(1);
    expect(s.areaKm2).toBe(3);
  });

  it('counts a cell first claimed exactly at Monday 00:00 and not one a millisecond before', async () => {
    const s = await summaryAt(at(10, 26, 8), [at(10, 26), at(10, 26) - 1]);
    expect(s.newThisWeekKm2).toBe(1);
  });

  it('mid-week: Monday to now counts, last Sunday does not, though both are within 7 days', async () => {
    const thursday = at(10, 29, 18); // Thu 29 Oct 2026, 18:00
    const s = await summaryAt(thursday, [at(10, 26, 0, 5), at(10, 28, 7), at(10, 29, 17), at(10, 25, 20), at(10, 23)]);
    expect(s.newThisWeekKm2).toBe(3);
    // The month figure is still the last 30 days (rolling), so all five count there.
    expect(s.newThisMonthKm2).toBe(5);
  });

  it('keeps the month figure rolling: 30 days back counts, a millisecond more does not', async () => {
    const now = at(10, 29, 18);
    const s = await summaryAt(now, [now - 30 * DAY, now - 30 * DAY - 1]);
    expect(s.newThisMonthKm2).toBe(1);
    expect(s.newThisWeekKm2).toBe(0);
  });
});
