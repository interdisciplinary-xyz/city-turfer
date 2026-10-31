/**
 * The server's turf projection (docs/decisions/api-server-turf-2026-10-23.md): claims made in the
 * upload's transaction with @cityturfer/core, released before a delete, erased or rebuilt on
 * consent withdrawals, canonical first claimers (D4). After every scenario the projection equals
 * an independent recomputation from the claims (and `rebuildAll` changes nothing).
 */
import { H3CellGrid } from '@cityturfer/core/h3';
import { trackFromPoints } from '@cityturfer/core/shared-kernel';
import { Claim } from '@cityturfer/core/territory/ports';
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CompactPoint } from '../backup/model';
import type { BackupStore, UserWriter } from '../backup/ports';
import { toTrackPoints } from '../backup/summary';
import { BackupService, type UploadInput } from '../backup/use-cases';
import type { ApiLog } from '../deps';
import { recomputedRows, textArray } from '../territory/drizzle-territory-repository';
import { TurfProjection } from '../territory/projection';
import { backupApp, closeSharedDb, TOKENS } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;
const logged: string[] = [];
const log: ApiLog = {
  request: (e) => logged.push(JSON.stringify(e)),
  event: (e) => logged.push(JSON.stringify(e)),
};

beforeEach(async () => {
  logged.length = 0;
  h = await backupApp({ log });
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

const grid = new H3CellGrid();
const H3_ID = /\b8b[0-9a-f]{13}\b/;
const T0 = Date.parse('2026-10-19T07:12:00Z');

// ------------------------------------------------------------------ Tracks and uploads

/**
 * A made-up straight line near Warsaw Old Town (public landmark): `n` points `step` degrees of
 * longitude (and `dLat` of latitude) apart, 3 s apart, segment 0 unless `segmentEvery` splits it.
 */
function line(o: {
  n?: number;
  lon?: number;
  lat?: number;
  step?: number;
  dLat?: number;
  start?: number;
  segmentEvery?: number;
}): CompactPoint[] {
  const { n = 30, lon = 21.0122, lat = 52.2297, step = 1e-4, dLat = 0, start = T0, segmentEvery } = o;
  return Array.from({ length: n }, (_, i) => [
    Number((lon + i * step).toFixed(7)),
    Number((lat + i * dLat).toFixed(7)),
    start + i * 3000,
    segmentEvery ? Math.floor(i / segmentEvery) : 0,
    null,
  ]);
}

const iso = (t: number) => new Date(t).toISOString();

function body(points: CompactPoint[], overrides: Record<string, unknown> = {}) {
  return {
    type: 'walk',
    name: 'Walk',
    source: 'recording',
    startedAt: iso(points[0][2]),
    endedAt: iso(points.at(-1)![2]),
    timeZone: 'Europe/Warsaw',
    resumedSegments: null,
    track: { points },
    ...overrides,
  };
}

const grant = (purpose = 'cloud-sync', granted = true, token: string = TOKENS.admin) =>
  h.call('PUT', `/v1/me/consents/${purpose}`, { token, body: { granted, policyVersion: '2026-10' } });

const put = (id: string, b: unknown, ifMatch?: string, token: string = TOKENS.admin) =>
  h.call('PUT', `/v1/activities/${id}`, { body: b, token, headers: ifMatch ? { 'If-Match': ifMatch } : {} });

async function putOk(id: string, b: unknown, ifMatch?: string, token: string = TOKENS.admin) {
  const res = await put(id, b, ifMatch, token);
  expect(res.status, await res.clone().text()).toBeLessThan(300);
  return res.headers.get('ETag') ?? '';
}

// ------------------------------------------------------------------ Reading the projection

const rows = async <T>(query: SQL) => ((await h.db.execute(query)) as unknown as { rows: T[] }).rows;

type CellTuple = [cell: string, walk: number, run: number, cycle: number, firstAt: number, firstId: string];

async function cellsOf(userId = 'admin'): Promise<CellTuple[]> {
  const r = await rows<{ cell: string; walk: number; run: number; cycle: number; at: number; first: string }>(sql`
    SELECT cell, walk, run, cycle, (extract(epoch FROM first_at) * 1000)::float8 AS at, first_activity_id AS first
    FROM turf_cells WHERE user_id = ${userId} ORDER BY cell COLLATE "C"`);
  return r.map((x) => [x.cell, x.walk, x.run, x.cycle, x.at, x.first]);
}

async function claimsOf(userId = 'admin') {
  return rows<{ id: string; type: 'walk' | 'run' | 'cycle'; at: number; cells: string[] }>(sql`
    SELECT activity_id AS id, type, (extract(epoch FROM claimed_at) * 1000)::float8 AS at, cells
    FROM turf_claims WHERE user_id = ${userId} ORDER BY activity_id COLLATE "C"`);
}

const turfVersion = async (userId = 'admin') => h.store.read(userId).turf.version();

/** The projection recomputed in JS from the claims (D4 in JS string order): the oracle. */
function oracle(claims: Awaited<ReturnType<typeof claimsOf>>): CellTuple[] {
  const out = new Map<string, CellTuple>();
  for (const k of claims) {
    for (const c of k.cells) {
      const row = out.get(c) ?? [c, 0, 0, 0, k.at, k.id];
      const slot = ({ walk: 1, run: 2, cycle: 3 } as const)[k.type];
      row[slot] += 1;
      if (k.at < row[4] || (k.at === row[4] && k.id < row[5])) {
        row[4] = k.at;
        row[5] = k.id;
      }
      out.set(c, row);
    }
  }
  return [...out.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** The invariant: cells == recomputation from the claims, and `rebuildAll` changes nothing. */
async function expectConsistent(userId = 'admin') {
  const cells = await cellsOf(userId);
  expect(cells).toEqual(oracle(await claimsOf(userId)));
  await h.store.write(userId, async (tx) => {
    await tx.lock();
    await tx.turf.rebuildAll();
  });
  expect(await cellsOf(userId)).toEqual(cells);
  // No first claimer is an activity the server no longer has.
  const orphans = await rows<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM turf_cells t WHERE t.user_id = ${userId} AND NOT EXISTS
      (SELECT 1 FROM activities a WHERE a.user_id = t.user_id AND a.id = t.first_activity_id)`);
  expect(orphans[0].n).toBe(0);
  return cells;
}

/** The cells core's Claim covers for a track (what the claim must hold). */
const coreCells = (points: CompactPoint[]) =>
  [
    ...Claim.fromTrack(
      { activityId: 'x', type: 'walk', startedAt: points[0][2] },
      trackFromPoints(toTrackPoints(points)),
      grid,
      Number.MAX_SAFE_INTEGER
    ).state.cells,
  ].sort();

const claimOf = async (id: string, userId = 'admin') => (await claimsOf(userId)).find((k) => k.id === id);

// ------------------------------------------------------------------ Scenarios

describe('turf on upload', () => {
  it('claims on create, in the upload transaction; a replay does no turf work', async () => {
    await grant();
    const points = line({});
    await putOk('a1', body(points));
    const claim = await claimOf('a1');
    expect(claim).toMatchObject({ type: 'walk', at: points[0][2] });
    expect(claim!.cells).toEqual(coreCells(points));
    const v = await turfVersion();
    expect(v).toBeGreaterThan(0);

    const replay = await put('a1', body(points));
    expect(replay.status).toBe(200);
    expect(await turfVersion()).toBe(v);
    await expectConsistent();
  });

  it('a rename (PUT or PATCH) or new gap routes leave turf alone', async () => {
    await grant();
    const points = line({});
    const etag = await putOk('a1', body(points));
    const v = await turfVersion();
    const cells = await cellsOf();
    await putOk('a1', body(points, { name: 'Renamed walk' }), etag);
    await h.call('PATCH', '/v1/activities/a1', { body: { name: 'Again', renamedAt: '2026-10-19T09:00:00Z' } });
    await h.call('PUT', '/v1/activities/a1/gap-routes', {
      body: {
        checkedAt: '2026-10-19T09:00:00Z',
        routes: [
          {
            afterSegment: 0,
            distanceM: 120,
            movingS: 60,
            coords: [
              [21.013, 52.23],
              [21.014, 52.23],
            ],
          },
        ],
      },
    });
    expect(await turfVersion()).toBe(v);
    expect(await cellsOf()).toEqual(cells);
    await expectConsistent();
  });

  it('reclaims when the track, the type or the start changed', async () => {
    await grant();
    const first = line({});
    let etag = await putOk('a1', body(first));
    await putOk('b1', body(line({ start: T0 + 86_400_000 }), { type: 'run' }));

    // New track: the claim follows it, cells only the old track had are gone.
    const moved = line({ lat: 52.2305, dLat: 1e-5 });
    etag = await putOk('a1', body(moved), etag);
    expect((await claimOf('a1'))!.cells).toEqual(coreCells(moved));
    await expectConsistent();

    // Type: the visits move from walk to cycle.
    etag = await putOk('a1', body(moved, { type: 'cycle' }), etag);
    expect((await claimOf('a1'))!.type).toBe('cycle');
    const cells = await expectConsistent();
    expect(cells.filter(([id]) => coreCells(moved).includes(id)).every((c) => c[3] === 1)).toBe(true);

    // Start: claimed_at follows, so do the first claimers' times.
    const earlier = moved[0][2] - 2 * 86_400_000;
    await putOk('a1', body(moved, { type: 'cycle', startedAt: iso(earlier) }), etag);
    expect((await claimOf('a1'))!.at).toBe(earlier);
    await expectConsistent();
  });

  it('isNew is canonical: A then B equals B then A', async () => {
    const a = line({});
    const b = line({ lon: 21.0125, start: T0 + 3_600_000 });
    const run = async (order: ('A' | 'B')[]) => {
      h = await backupApp({ log });
      await grant();
      for (const which of order) {
        await putOk(which, body(which === 'A' ? a : b));
      }
      const views = [];
      for (const id of ['A', 'B']) {
        views.push(await h.store.read('admin').turf.claimOf(id));
      }
      return { views, cells: await expectConsistent() };
    };
    const ab = await run(['A', 'B']);
    const ba = await run(['B', 'A']);
    expect(ba).toEqual(ab);
    // The overlap is new for A only (the earlier start).
    const [viewA, viewB] = ab.views;
    expect(viewA!.newCellCount).toBe(viewA!.cellCount);
    expect(viewB!.newCellCount).toBeLessThan(viewB!.cellCount);
    expect(viewB!.newAreaM2).toBeGreaterThan(0);
  });

  it('a start in the future is stored unclaimed (2xx), and claimed by the catch-up once due', async () => {
    await grant();
    const start = h.clock.t + 10 * 60_000;
    const points = line({ start });
    const res = await put('f1', body(points));
    expect(res.status).toBe(201);
    expect(await claimOf('f1')).toBeUndefined();
    const service = new BackupService(h.store, h.clock, h.grid);
    expect(await service.catchUpTurf('admin', 25)).toEqual({ claimed: 0, deferred: 1, skipped: 0, gone: false });

    h.clock.t = start + 60_000;
    expect(await service.catchUpTurf('admin', 25)).toEqual({ claimed: 1, deferred: 0, skipped: 0, gone: false });
    expect((await claimOf('f1'))!.cells).toEqual(coreCells(points));
    expect(await service.catchUpTurf('admin', 25)).toEqual({ claimed: 0, deferred: 0, skipped: 0, gone: false });
    await expectConsistent();
  });

  it('a rename-only replace claims an activity that never was (catch-up on write)', async () => {
    await grant();
    const points = line({ start: h.clock.t + 10 * 60_000 });
    const etag = await putOk('f1', body(points));
    expect(await claimOf('f1')).toBeUndefined();
    h.clock.t += 20 * 60_000;
    await putOk('f1', body(points, { name: 'Later' }), etag);
    expect(await claimOf('f1')).toBeDefined();
    await expectConsistent();
  });

  it('big and odd tracks: 40k points, many segments, across ±180° — no 500', async () => {
    await grant();
    const big = line({ n: 40_000, step: 5e-5 });
    expect((await put('big', body(big))).status).toBe(201);
    const segments = line({ n: 600, segmentEvery: 7, dLat: 2e-5 });
    expect((await put('seg', body(segments, { type: 'run' }))).status).toBe(201);
    const dateLine = line({ n: 40, lon: 179.9988, lat: -16.5, step: 6e-5 }).map((p): CompactPoint => [
      p[0] > 180 ? Number((p[0] - 360).toFixed(7)) : p[0],
      p[1],
      p[2],
      p[3],
      p[4],
    ]);
    expect(dateLine.some((p) => p[0] < 0) && dateLine.some((p) => p[0] > 0)).toBe(true);
    expect((await put('dateline', body(dateLine, { type: 'cycle' }))).status).toBe(201);
    for (const id of ['big', 'seg', 'dateline']) {
      expect(await claimOf(id)).toBeDefined();
    }
    // Segment gaps are never bridged: the multi-segment claim is the union of its segments.
    expect((await claimOf('seg'))!.cells).toEqual(coreCells(segments));
    await expectConsistent();
  });
});

describe('turf on delete', () => {
  it('releases before the delete: survivors are recomputed, the first claimer moves on', async () => {
    await grant();
    const early = line({});
    const late = line({ start: T0 + 86_400_000 });
    await putOk('early', body(early));
    await putOk('late', body(late, { type: 'run' }));
    const before = await cellsOf();
    expect(before.every((c) => c[5] === 'early' && c[1] === 1 && c[2] === 1)).toBe(true);

    expect((await h.call('DELETE', '/v1/activities/early')).status).toBe(204);
    expect(await claimOf('early')).toBeUndefined();
    const after = await expectConsistent();
    expect(after.every((c) => c[5] === 'late' && c[4] === late[0][2] && c[1] === 0 && c[2] === 1)).toBe(true);

    // Deleting the last claimer of a cell removes the cell.
    await h.call('DELETE', '/v1/activities/late');
    expect(await cellsOf()).toEqual([]);
  });

  it('partial overlaps: recomputing only the released cells equals the old `&&`-filtered query', async () => {
    await grant();
    // A and B share half their cells; C is ~1 km away and shares none.
    const a = line({ n: 40 });
    const b = line({ n: 40, lon: 21.0122 + 20 * 1e-4, start: T0 + 3_600_000 });
    const c = line({ n: 40, lat: 52.2397, start: T0 - 3_600_000 });
    await putOk('a', body(a));
    await putOk('b', body(b, { type: 'run' }));
    await putOk('c', body(c, { type: 'cycle' }));
    const aCells = (await claimOf('a'))!.cells;
    const bCells = new Set((await claimOf('b'))!.cells);
    expect(aCells.some((x) => bCells.has(x)) && aCells.some((x) => !bCells.has(x))).toBe(true);

    // The query as it was before the `k.cells && only` pre-filter was dropped: the same rows.
    type Row = { cell: string; walk: number; run: number; cycle: number; first_at: unknown; first_activity_id: string };
    const only = textArray(aCells);
    const legacy = await rows<Row>(sql`
      SELECT c.cell,
        count(*) FILTER (WHERE k.type = 'walk')::int AS walk,
        count(*) FILTER (WHERE k.type = 'run')::int AS run,
        count(*) FILTER (WHERE k.type = 'cycle')::int AS cycle,
        min(k.claimed_at) AS first_at,
        (array_agg(k.activity_id ORDER BY k.claimed_at, k.activity_id COLLATE "C"))[1] AS first_activity_id
      FROM turf_claims k CROSS JOIN LATERAL unnest(k.cells) AS c(cell)
      WHERE k.user_id = 'admin' AND k.cells && ${only}::text[] AND c.cell IN (SELECT unnest(${only}::text[]))
      GROUP BY c.cell ORDER BY c.cell COLLATE "C"`);
    const current = await rows<Row>(sql`
      SELECT r.cell, r.walk, r.run, r.cycle, r.first_at, r.first_activity_id
      FROM (${recomputedRows('admin', only)}) r ORDER BY r.cell COLLATE "C"`);
    expect(legacy.length).toBe(aCells.length);
    expect(current).toEqual(legacy);

    const untouched = (await cellsOf()).filter((x) => !aCells.includes(x[0]));
    expect((await h.call('DELETE', '/v1/activities/a')).status).toBe(204);
    const after = await expectConsistent();
    // Cells only A had are gone; B's and C's other cells are exactly as they were.
    expect(after.filter((x) => !aCells.includes(x[0]))).toEqual(untouched);
    expect(after.filter((x) => aCells.includes(x[0])).every((x) => x[5] === 'b' && x[2] === 1)).toBe(true);
  });

  it('a delete of an unknown or already deleted id changes no turf', async () => {
    await grant();
    await putOk('a1', body(line({})));
    await h.call('DELETE', '/v1/activities/a1');
    const v = await turfVersion();
    expect((await h.call('DELETE', '/v1/activities/a1')).status).toBe(204);
    expect((await h.call('DELETE', '/v1/activities/never')).status).toBe(204);
    expect(await turfVersion()).toBe(v);
    await expectConsistent();
  });
});

describe('turf on consent withdrawal and erasure', () => {
  it('apple-health withdrawn: nothing derived from hk-* remains, first claimers included', async () => {
    await grant();
    await grant('apple-health-in-cloud-sync');
    const points = line({});
    await putOk('hk-0001', body(points, { source: 'apple-health' }));
    await putOk('rec-1', body(line({ start: T0 + 86_400_000 }), { type: 'run' }));
    expect((await cellsOf()).every((c) => c[5] === 'hk-0001')).toBe(true);

    await grant('apple-health-in-cloud-sync', false);
    expect((await claimsOf()).map((k) => k.id)).toEqual(['rec-1']);
    const cells = await expectConsistent();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c[5] === 'rec-1' && c[1] === 0)).toBe(true);
  });

  it('cloud-sync withdrawn: every claim and Turf Cell goes, the version moves', async () => {
    await grant();
    await putOk('a1', body(line({})));
    const v = await turfVersion();
    await grant('cloud-sync', false);
    expect(await claimsOf()).toEqual([]);
    expect(await cellsOf()).toEqual([]);
    expect(await turfVersion()).toBeGreaterThan(v);
  });

  it('DELETE /v1/me erases the turf with the account; another user keeps theirs', async () => {
    await grant();
    await grant('cloud-sync', true, TOKENS.other);
    await putOk('a1', body(line({})));
    await putOk('a1', body(line({})), undefined, TOKENS.other);
    expect((await h.call('DELETE', '/v1/me')).status).toBe(204);
    expect(await claimsOf('admin')).toEqual([]);
    expect(await cellsOf('admin')).toEqual([]);
    expect((await claimsOf('other')).length).toBe(1);
    await expectConsistent('other');
  });

  it("one user's turf never touches another's (same activity ids, same cells)", async () => {
    await grant();
    await grant('cloud-sync', true, TOKENS.other);
    const points = line({});
    await putOk('a1', body(points));
    await putOk('a1', body(points, { type: 'run' }), undefined, TOKENS.other);
    await h.call('DELETE', '/v1/activities/a1');
    expect(await cellsOf('admin')).toEqual([]);
    const others = await cellsOf('other');
    // Not vacuous: the other user keeps every cell of their run.
    expect(others.length).toBe(coreCells(points).length);
    expect(others.every((c) => c[2] === 1)).toBe(true);
    await expectConsistent('other');
  });
});

describe('D4 tie-break in JS string order (COLLATE "C")', () => {
  /** Ids compared linguistically (as on a database whose default collation is not C, like Neon's). */
  async function linguisticIds(on: boolean) {
    const collation = on ? '"und-x-icu"' : '"default"';
    await h.db.execute(sql.raw(`ALTER TABLE turf_claims ALTER COLUMN activity_id TYPE text COLLATE ${collation}`));
    await h.db.execute(sql.raw(`ALTER TABLE turf_cells ALTER COLUMN first_activity_id TYPE text COLLATE ${collation}`));
  }

  it('the same start picks the id that sorts first in JS, whatever the collation', async () => {
    // JS (and "C"): 'B…' < 'a…' and 'HK…' < 'hk-…'; linguistically the other way round.
    expect('B7E2F9A0' < 'a1d40c2e').toBe(true);
    const icu = await rows<{ lt: boolean }>(sql`SELECT ('a1d40c2e' < 'B7E2F9A0' COLLATE "und-x-icu") AS lt`);
    expect(icu[0].lt).toBe(true);
    await linguisticIds(true);
    try {
      await grant();
      await grant('apple-health-in-cloud-sync');
      const points = line({});
      await putOk('a1d40c2e-6b0f', body(points));
      await putOk('B7E2F9A0-3C4D', body(points, { type: 'run' }));
      expect((await cellsOf()).every((c) => c[5] === 'B7E2F9A0-3C4D')).toBe(true);
      await putOk('hk-AAAA', body(points, { source: 'apple-health', type: 'cycle' }));
      await putOk('HKBBBB', body(points, { type: 'cycle' }));
      expect((await cellsOf()).every((c) => c[5] === 'B7E2F9A0-3C4D')).toBe(true);

      // Release the winner: the recomputation must pick the next in JS order ('HKBBBB'), not 'a1…'.
      await h.call('DELETE', '/v1/activities/B7E2F9A0-3C4D');
      expect((await cellsOf()).every((c) => c[5] === 'HKBBBB')).toBe(true);
      await expectConsistent();
      const view = await h.store.read('admin').turf.claimOf('HKBBBB');
      expect(view!.newCellCount).toBe(view!.cellCount);
    } finally {
      await linguisticIds(false);
    }
  });
});

describe('privacy', () => {
  it('no Turf Cell id or coordinate in logs or problem bodies, even when turf fails', async () => {
    await grant();
    const points = line({});
    const etag = await putOk('a1', body(points));
    const stale = await put('a1', body(line({ lat: 52.24 })), '"v99"');
    const deleted = (await h.call('DELETE', '/v1/activities/a1'), await put('a1', body(points)));
    const problems = [await stale.text(), await deleted.text()];
    expect(stale.status).toBe(412);
    expect(deleted.status).toBe(410);
    expect(etag).toBe('"v1"');

    const text = [...logged, ...problems].join('\n');
    expect(text).not.toMatch(H3_ID);
    expect(text).not.toMatch(/21\.01|52\.2/);
  });

  it('a database failure inside the turf write: a 500 over HTTP that says and logs nothing of it', async () => {
    // The real routes and error handler over a store whose turf write fails with location data in
    // the error message (as a driver error might quote a value).
    h = await backupApp({
      log,
      wrapStore: (store) =>
        Object.assign(Object.create(store) as BackupStore, {
          write: <T>(userId: string, fn: (tx: UserWriter) => Promise<T>) =>
            store.write(userId, (tx) =>
              fn(
                Object.assign(Object.create(tx) as UserWriter, {
                  turf: Object.assign(Object.create(tx.turf), {
                    saveClaim: () => Promise.reject(new Error(`insert failed for 8b1f53c9a2b1fff at 21.0122,52.2297`)),
                  }),
                })
              )
            ),
        }),
    });
    await grant();
    const res = await put('a2', body(line({})));
    expect(res.status).toBe(500);
    const problem = await res.text();
    // Nothing of the failed upload was committed (the activity rolls back with its claim).
    expect(await h.store.read('admin').activity('a2')).toBeNull();
    expect(logged.some((l) => l.includes('500'))).toBe(true);
    const text = [problem, ...logged].join('\n');
    expect(text).not.toMatch(H3_ID);
    expect(text).not.toMatch(/21\.01|52\.2/);
  });

  it('the turf summary answers no Turf Cell id', async () => {
    await grant();
    await putOk('a1', body(line({})));
    const res = await h.call('GET', '/v1/turf/summary');
    expect(res.status).toBe(200);
    expect(await res.text()).not.toMatch(H3_ID);
  });
});

describe('performance', () => {
  it('claims a 40k-point upload on a user with ~50k cells within budget (PGlite)', { timeout: 300_000 }, async () => {
    await grant();
    const service = new BackupService(h.store, h.clock, h.grid);
    const input = (points: CompactPoint[]): UploadInput => ({
      type: 'walk',
      name: 'Long walk',
      source: 'recording',
      startedAt: points[0][2],
      endedAt: points.at(-1)![2],
      timeZone: null,
      resumedSegments: null,
      points,
    });
    // Parallel made-up lines ~220 m apart, ~7 m between points: ~7k cells each.
    const seeds: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t = performance.now();
      await service.upload('admin', `seed-${i}`, input(line({ n: 40_000, lat: 52.2297 + i * 0.002 })), undefined);
      seeds.push(Math.round(performance.now() - t));
    }
    const cellCount = (await cellsOf()).length;
    expect(cellCount).toBeGreaterThan(45_000);

    const points = line({ n: 40_000, lat: 52.2297 + 7 * 0.002 + 0.001, start: T0 + 86_400_000 });
    let t = performance.now();
    await service.upload('admin', 'big', input(points), undefined);
    const uploadMs = performance.now() - t;

    // The turf part alone: release + claim of the same activity in one locked transaction.
    const timings = await h.store.write('admin', async (tx) => {
      await tx.lock();
      const turf = new TurfProjection({
        repo: tx.turf,
        grid: h.grid,
        clock: h.clock,
        storedTrack: (id) => tx.track(id),
      });
      let s = performance.now();
      await turf.release('big');
      const releaseMs = performance.now() - s;
      s = performance.now();
      await turf.claim({ id: 'big', type: 'walk', startedAt: points[0][2] }, points);
      return { releaseMs, claimMs: performance.now() - s };
    });
    t = performance.now();
    const summary = await h.store.read('admin').turf.allCells();
    const allCellsMs = performance.now() - t;

    console.warn(
      JSON.stringify({
        msg: 'turf.perf',
        cells: cellCount,
        seedUploadMs: seeds,
        uploadMs: Math.round(uploadMs),
        claimMs: Math.round(timings.claimMs),
        releaseMs: Math.round(timings.releaseMs),
        allCellsMs: Math.round(allCellsMs),
        allCells: summary.length,
      })
    );
    // Budget from the plan (~500 ms on PGlite); a generous ceiling keeps a busy CI runner green.
    expect(timings.claimMs).toBeLessThan(1_500);
    // The un-indexed `cells && …` overlap made the release take 6–39 s; without it, tens of ms.
    expect(timings.releaseMs).toBeLessThan(3_000);
  });
});
