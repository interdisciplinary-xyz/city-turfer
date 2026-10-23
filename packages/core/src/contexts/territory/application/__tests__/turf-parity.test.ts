/**
 * G2 turf parity, core side. Pins the fixture (input + golden are what turf-parity.generate.ts
 * builds; `WRITE_TURF_PARITY=1` rewrites them) and replays the operations through `createTurfApi`
 * over an in-memory repository that keeps the projection the way the server does (D4: a cell's
 * first claimer is the earliest `(startedAt, activityId)`, whatever the upload order).
 * The phone (apps/mobile/src/contexts/territory/infrastructure/__tests__/turf-parity.test.ts) and
 * the API assert the same golden.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { H3CellGrid } from '../../../../h3';
import type { ActivityType, TrackPoint } from '../../../../shared-kernel';
import {
  buildParityExpected,
  buildParityInput,
  type CompactPoint,
  type ParityExpected,
  type ParityInput,
} from '../../__fixtures__/turf-parity.generate';
import type { CellId } from '../../domain/cell-grid';
import type { Claim } from '../../domain/claim';
import type { CellRow, TerritoryRepository } from '../../domain/territory-repository';
import { createTurfApi } from '../../index';

const dir = join(__dirname, '../../__fixtures__');
const INPUT = join(dir, 'turf-parity.json');
const EXPECTED = join(dir, 'turf-parity.expected.json');
const grid = new H3CellGrid();

if (process.env.WRITE_TURF_PARITY === '1') {
  const input = buildParityInput();
  writeFileSync(INPUT, JSON.stringify(input) + '\n');
  writeFileSync(EXPECTED, JSON.stringify(buildParityExpected(input, grid), null, 1) + '\n');
}
const input: ParityInput = JSON.parse(readFileSync(INPUT, 'utf8'));
const expected: ParityExpected = JSON.parse(readFileSync(EXPECTED, 'utf8'));

/** The projection as the server keeps it: counts per type, first claimer by D4. */
class D4TerritoryRepository implements TerritoryRepository {
  readonly claims = new Map<string, { type: ActivityType; claimedAt: number; cells: CellId[] }>();
  readonly cells = new Map<CellId, CellRow & { firstId: string }>();

  async claimExists(id: string) {
    return this.claims.has(id);
  }
  async existingCells(cells: Iterable<CellId>) {
    return new Set([...cells].filter((c) => this.cells.has(c)));
  }
  async saveClaim(claim: Claim) {
    // The arrival-order `newCells` argument is ignored: "new" is canonical (D4).
    const { activityId, type, claimedAt, cells } = claim.state;
    this.claims.set(activityId, { type, claimedAt, cells: [...cells] });
    for (const c of cells) {
      const row = this.cells.get(c) ?? {
        cell: c,
        lat: 0,
        lon: 0,
        walk: 0,
        run: 0,
        cycle: 0,
        firstAt: claimedAt,
        firstId: activityId,
      };
      row[type]++;
      if (claimedAt < row.firstAt || (claimedAt === row.firstAt && activityId < row.firstId)) {
        row.firstAt = claimedAt;
        row.firstId = activityId;
      }
      this.cells.set(c, row);
    }
  }
  async releaseClaim(activityId: string) {
    const claim = this.claims.get(activityId);
    if (!claim) {
      return false;
    }
    this.claims.delete(activityId);
    for (const c of claim.cells) {
      this.cells.delete(c);
    }
    // Rebuild the released cells from the claims that remain.
    const touched = new Set(claim.cells);
    const ordered = [...this.claims.entries()].sort(([ia, a], [ib, b]) =>
      a.claimedAt !== b.claimedAt ? a.claimedAt - b.claimedAt : ia < ib ? -1 : 1
    );
    for (const [id, other] of ordered) {
      for (const c of other.cells) {
        if (!touched.has(c)) {
          continue;
        }
        const row = this.cells.get(c) ?? {
          cell: c,
          lat: 0,
          lon: 0,
          walk: 0,
          run: 0,
          cycle: 0,
          firstAt: other.claimedAt,
          firstId: id,
        };
        row[other.type]++;
        this.cells.set(c, row);
      }
    }
    return true;
  }
  async cellsIn(): Promise<CellRow[]> {
    throw new Error('not used'); // the viewport query is not part of the turf API
  }
  async allCells() {
    return [...this.cells.values()].map((r) => ({
      cell: r.cell,
      lat: r.lat,
      lon: r.lon,
      walk: r.walk,
      run: r.run,
      cycle: r.cycle,
      firstAt: r.firstAt,
    }));
  }
  async cellCounts({ offset, limit }: { offset: number; limit: number }) {
    const rows = [...this.cells.values()]
      .sort((a, b) => (a.cell < b.cell ? -1 : a.cell > b.cell ? 1 : 0))
      .map((r) => ({ cell: r.cell, walk: r.walk, run: r.run, cycle: r.cycle }));
    return { rows: rows.slice(offset, offset + limit), total: rows.length };
  }
  async claimOf(activityId: string) {
    const claim = this.claims.get(activityId);
    if (!claim) {
      return null;
    }
    const cells = claim.cells.map((c) => ({ cell: c, isNew: this.cells.get(c)!.firstId === activityId }));
    const fresh = cells.filter((c) => c.isNew);
    return {
      cellCount: cells.length,
      newCellCount: fresh.length,
      newAreaM2: fresh.reduce((s, c) => s + grid.areaM2(c.cell), 0),
      cells,
    };
  }
}

const toTrackPoints = (points: readonly CompactPoint[]): TrackPoint[] =>
  points.map(([lon, lat, t, segment, alt]) => ({ lon, lat, t, segment, alt, accuracy: null, speed: null }));

async function replay(operations: ParityInput['operations']) {
  const repo = new D4TerritoryRepository();
  const tracks = new Map<string, TrackPoint[]>();
  const turf = createTurfApi({
    repo,
    grid,
    tracks: { trackOf: async (id) => tracks.get(id) ?? [] },
    clock: { now: () => input.now },
    afterCommit: () => undefined,
  });
  for (const o of operations) {
    if (o.op === 'delete') {
      tracks.delete(o.id);
      await turf.release.execute(o.id);
      continue;
    }
    const a = o.activity;
    tracks.set(a.id, toTrackPoints(a.points));
    const e = { activityId: a.id, activityType: a.type, startedAt: a.startedAt };
    await (o.op === 'create' ? turf.claimFromActivity.execute(e) : turf.reclaim.execute(e));
  }
  return { turf, repo };
}

async function expectGolden(turf: Awaited<ReturnType<typeof replay>>['turf']) {
  const s = await turf.summary.execute();
  const g = expected.summary;
  expect({ cellCount: s.cellCount, strongCells: s.strongCells, byType: s.byType }).toEqual({
    cellCount: g.cellCount,
    strongCells: g.strongCells,
    byType: g.byType,
  });
  expect(Math.abs(s.areaKm2 - g.areaKm2)).toBeLessThan(1e-9);
  expect(Math.abs(s.newThisWeekKm2 - g.newThisWeekKm2)).toBeLessThan(1e-9);
  expect(Math.abs(s.newThisMonthKm2 - g.newThisMonthKm2)).toBeLessThan(1e-9);

  const page = await turf.cells.execute({ offset: 0, limit: 100_000 });
  expect(page.cells).toEqual(expected.cells.map(([id, w, r, c]) => [id, w, r, c]));
  expect(page.nextOffset).toBeNull();

  for (const claim of expected.claims) {
    const v = await turf.claimOf.execute(claim.activityId);
    expect(v && { cellCount: v.cellCount, newCellCount: v.newCellCount }).toEqual({
      cellCount: claim.cellCount,
      newCellCount: claim.newCellCount,
    });
    expect(Math.abs(v!.newAreaKm2 - claim.newAreaKm2)).toBeLessThan(1e-9);
  }
}

describe('G2 turf parity fixture', () => {
  it('is exactly what turf-parity.generate.ts builds (regenerate with WRITE_TURF_PARITY=1)', () => {
    expect(input).toEqual(buildParityInput());
    const rebuilt = buildParityExpected(input, grid);
    expect(rebuilt.cells).toEqual(expected.cells);
    const counts = (c: ParityExpected['claims'][number]) => [c.activityId, c.cellCount, c.newCellCount];
    expect(rebuilt.claims.map(counts)).toEqual(expected.claims.map(counts));
    expect(rebuilt.summary.byType).toEqual(expected.summary.byType);
    expect(Math.abs(rebuilt.summary.areaKm2 - expected.summary.areaKm2)).toBeLessThan(1e-12);
  });

  it('exercises what it claims to: out-of-order import, tie under D4, delete, replace, type change, all three types', () => {
    const g = expected;
    const hk = g.claims.find((c) => c.activityId.startsWith('hk-'))!;
    expect(hk.newCellCount).toBeGreaterThan(0); // first claimer although it arrived last
    const tie = g.claims.filter((c) => c.activityId.startsWith('B7') || c.activityId.startsWith('a1'));
    expect(tie.map((c) => c.newCellCount > 0)).toEqual([true, false]); // 'B7…' < 'a1…' in JS order
    // The crane ride became a run; the Long Market ride survives as a cycle, so every cycle cell
    // is its own, and some cells count a walk, a run and a ride (the cycle column is pinned).
    const ride = g.claims.find((c) => c.activityId.startsWith('e9'))!;
    expect(g.summary.byType.cycle).toBe(ride.cellCount);
    expect(g.cells.filter((c) => c[3] > 0)).toHaveLength(ride.cellCount);
    expect(g.cells.some(([, walk, run, cycle]) => walk > 0 && run > 0 && cycle > 0)).toBe(true);
    expect(g.summary.strongCells).toBeGreaterThan(0);
    expect(g.summary.newThisWeekKm2).toBeGreaterThan(0);
    expect(g.summary.newThisMonthKm2).toBeGreaterThan(g.summary.newThisWeekKm2);
    expect(g.summary.areaKm2).toBeGreaterThan(g.summary.newThisMonthKm2);
    // Long Lane's western cells lost their first claimer (45 days ago): first is now 10 days ago.
    expect(g.cells.some((c) => c[4] === input.now - 10 * 86_400_000)).toBe(true);
    expect(g.cells.some((c) => c[4] === input.now - 45 * 86_400_000)).toBe(false);
  });

  it('replaying the operations through createTurfApi gives the golden', async () => {
    const { turf } = await replay(input.operations);
    await expectGolden(turf);
  });

  it('gives the same golden whatever the upload order of the creates (D4)', async () => {
    const creates = input.operations.filter((o) => o.op === 'create').reverse();
    const rest = input.operations.filter((o) => o.op !== 'create');
    const { turf } = await replay([...creates, ...rest]);
    await expectGolden(turf);
  });
});

describe('ListTurfCells', () => {
  it('pages the cells by id', async () => {
    const { turf } = await replay(input.operations);
    const all = expected.cells.map(([id, w, r, c]) => [id, w, r, c]);
    const first = await turf.cells.execute({ offset: 0, limit: 10 });
    expect(first).toEqual({ cells: all.slice(0, 10), total: all.length, nextOffset: 10 });
    const last = await turf.cells.execute({ offset: all.length - 3, limit: 10 });
    expect(last).toEqual({ cells: all.slice(-3), total: all.length, nextOffset: null });
    expect(await turf.cells.execute({ offset: all.length + 5, limit: 10 })).toEqual({
      cells: [],
      total: all.length,
      nextOffset: null,
    });
  });

  it.each([
    { offset: -1, limit: 10 },
    { offset: 0, limit: 0 },
    { offset: 1.5, limit: 10 },
  ])('rejects %o', async (page) => {
    const { turf } = await replay([]);
    await expect(turf.cells.execute(page)).rejects.toMatchObject({ code: 'turf.invalid-page' });
  });
});
