/**
 * G2 turf parity, phone side: the operations of the shared fixture
 * (packages/core/src/contexts/territory/__fixtures__/turf-parity.json) replayed through the real
 * wiring and SQL must give the golden the server gives (turf-parity.expected.json): the summary
 * at the fixed `now` (areas to 1e-9) and every Turf Cell's per-type visits and `firstAt`.
 *
 * What the phone does not promise: a claim's "new" cells (`claimOf` isNew / newCellCount, the
 * "+0.12 km² new turf" card) are decided in arrival order and stored with the claim, not by D4
 * (earliest `(startedAt, activityId)`), so an older import that arrives later, or a claim whose
 * cells' first claimer was deleted, reads differently from the server. Pinned below as known.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/sqlite-activity-repository';
import { migrate } from '@/platform/migrations';
import { type ActivityType, trackFromPoints, type TrackPoint } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

import { SqliteTerritoryRepository } from '../sqlite-territory-repository';

type CompactPoint = [lon: number, lat: number, t: number, segment: number, altitudeM: number | null];
interface ParityActivity {
  id: string;
  type: ActivityType;
  startedAt: number;
  points: CompactPoint[];
}
type ParityOperation =
  { op: 'create' | 'replace-track' | 'change-type'; activity: ParityActivity } | { op: 'delete'; id: string };
interface ParityInput {
  now: number;
  operations: ParityOperation[];
}
interface ParityExpected {
  summary: {
    cellCount: number;
    areaKm2: number;
    strongCells: number;
    newThisWeekKm2: number;
    newThisMonthKm2: number;
    byType: Record<ActivityType, number>;
  };
  claims: { activityId: string; cellCount: number; newCellCount: number; newAreaKm2: number }[];
  cells: [id: string, walk: number, run: number, cycle: number, firstAt: number][];
}

const FIXTURES = join(__dirname, '../../../../../../../packages/core/src/contexts/territory/__fixtures__');
const input: ParityInput = JSON.parse(readFileSync(join(FIXTURES, 'turf-parity.json'), 'utf8'));
const golden: ParityExpected = JSON.parse(readFileSync(join(FIXTURES, 'turf-parity.expected.json'), 'utf8'));

const toTrackPoints = (points: readonly CompactPoint[]): TrackPoint[] =>
  points.map(([lon, lat, t, segment, alt]) => ({ lon, lat, t, segment, alt, accuracy: null, speed: null }));

function device() {
  let n = 0;
  return {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: {
      route: async () => {
        throw new Error('offline');
      },
    },
    ids: { next: () => `id-${++n}` },
    clock: { now: () => input.now },
  };
}

/** Replays the fixture's operations on a fresh phone database, through the outbox like the app. */
async function replay(operations: readonly ParityOperation[]) {
  const db = openNodeDatabase();
  await migrate(db);
  const c = wire('parity', db, device());
  const activities = new SqliteActivityRepository(db);
  const importActivity = async (a: ParityActivity) => {
    const points = toTrackPoints(a.points);
    expect(points[0].t).toBe(a.startedAt); // the phone's import starts at the first point
    expect(await c.activityLog.importActivity.execute({ id: a.id, type: a.type, points })).toBe(true);
  };
  for (const o of operations) {
    switch (o.op) {
      case 'create':
        await importActivity(o.activity);
        break;
      case 'replace-track': {
        // The phone's own track replacement: a correction (ActivityTrackCorrected → reclaim).
        const a = await activities.get(o.activity.id);
        const points = toTrackPoints(o.activity.points);
        a!.correctTrack(trackFromPoints(points), input.now);
        await activities.saveCorrection(a!, points);
        break;
      }
      case 'change-type':
        // No type edit on the phone: delete and import again (release + claim, as the server's reclaim).
        await c.activityLog.remove.execute(o.activity.id);
        await c.dispatcher.dispatchPending();
        await importActivity(o.activity);
        break;
      case 'delete':
        await c.activityLog.remove.execute(o.id);
        break;
    }
    await c.dispatcher.dispatchPending();
  }
  const dead = await db.all('SELECT type FROM sys_outbox WHERE dead_lettered_at IS NOT NULL');
  expect(dead).toEqual([]);
  return { c, db };
}

async function expectGolden({ c, db }: Awaited<ReturnType<typeof replay>>) {
  const s = await c.territory.summary.execute();
  const g = golden.summary;
  expect({ cellCount: s.cellCount, strongCells: s.strongCells, byType: s.byType }).toEqual({
    cellCount: g.cellCount,
    strongCells: g.strongCells,
    byType: g.byType,
  });
  expect(Math.abs(s.areaKm2 - g.areaKm2)).toBeLessThan(1e-9);
  expect(Math.abs(s.newThisWeekKm2 - g.newThisWeekKm2)).toBeLessThan(1e-9);
  expect(Math.abs(s.newThisMonthKm2 - g.newThisMonthKm2)).toBeLessThan(1e-9);

  const rows = await new SqliteTerritoryRepository(db).allCells();
  const cells = rows
    .map((r) => [r.cell, r.walk, r.run, r.cycle, r.firstAt] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  expect(cells).toEqual(golden.cells);
  const page = await c.territory.cells.execute({ offset: 0, limit: 100_000 });
  expect(page.cells).toEqual(golden.cells.map(([id, w, r, cy]) => [id, w, r, cy]));

  // The projection's own total stays in step with the per-type counts.
  const drift = await db.all('SELECT cell FROM ter_cells WHERE visits != walk + run + cycle');
  expect(drift).toEqual([]);

  // Every surviving claim, with the same cells; no claim of a deleted activity is left.
  const claimed = await db.all<{ activity_id: string }>('SELECT activity_id FROM ter_claims');
  expect(claimed.map((r) => r.activity_id).sort()).toEqual(golden.claims.map((x) => x.activityId).sort());
  for (const claim of golden.claims) {
    expect((await c.territory.claimOf.execute(claim.activityId))?.cellCount).toBe(claim.cellCount);
  }
}

describe('G2 turf parity: the phone gives the golden', () => {
  it('replaying the fixture in its order', async () => {
    await expectGolden(await replay(input.operations));
  });

  it('with every create arriving in reverse order (summary and cells do not depend on order)', async () => {
    const creates = input.operations.filter((o) => o.op === 'create').reverse();
    const rest = input.operations.filter((o) => o.op !== 'create');
    await expectGolden(await replay([...creates, ...rest]));
  });

  it('known gap: "new" cells of a claim are arrival order on the phone, not D4', async () => {
    const { c } = await replay(input.operations);
    const phone = new Map<string, number>();
    for (const claim of golden.claims) {
      phone.set(claim.activityId, (await c.territory.claimOf.execute(claim.activityId))!.newCellCount);
    }
    const canonical = new Map(golden.claims.map((x) => [x.activityId, x.newCellCount]));
    const hk = golden.claims.find((x) => x.activityId.startsWith('hk-'))!.activityId;
    // The older Apple Health walk arrived last: D4 makes it first claimer of all its cells; the
    // phone saw them already claimed.
    expect(canonical.get(hk)).toBeGreaterThan(0);
    expect(phone.get(hk)).toBe(0);
    // Same start, ids 'a1…' (arrived first) and 'B7…': D4 (JS order) picks 'B7…'; the phone the first to arrive.
    const tieRecording = golden.claims.find((x) => x.activityId.startsWith('a1'))!.activityId;
    const tieImport = golden.claims.find((x) => x.activityId.startsWith('B7'))!.activityId;
    expect([canonical.get(tieRecording), phone.get(tieRecording)! > 0]).toEqual([0, true]);
    expect(canonical.get(tieImport)).toBeGreaterThan(0);
    expect(phone.get(tieImport)!).toBeLessThan(canonical.get(tieImport)!);
  });
});
