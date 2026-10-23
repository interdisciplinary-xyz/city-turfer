/**
 * The turf reads and activity totals of contract 0.6.0 (docs/decisions/api-server-turf-2026-10-23.md):
 * `GET /v1/turf/cells` (paged download, version-bound cursor, ETag / 304), `/v1/turf/summary`,
 * `/v1/turf/claims/{activityId}`, `GET /v1/activity-totals` and the `startedAfter` /
 * `startedBefore` filters of `GET /v1/activities`. No Turf Cell id or coordinate in any URL or log.
 */
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { CompactPoint } from '../backup/model';
import type { BackupStore, UserReader } from '../backup/ports';
import { type ApiLog, DEV_WEB_ORIGIN } from '../deps';
import { TurfService } from '../territory/turf-service';
import { backupApp, closeSharedDb, codeIn, TOKENS } from './support';

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
afterAll(closeSharedDb);

const H3_ID = /8b[0-9a-f]{13}/;
const T0 = Date.parse('2026-10-19T07:12:00Z');
const iso = (t: number) => new Date(t).toISOString();

/** A made-up straight line near Warsaw Old Town (public landmark), 3 s between points. */
function line(o: { n?: number; lon?: number; lat?: number; step?: number; start?: number } = {}): CompactPoint[] {
  const { n = 30, lon = 21.0122, lat = 52.2297, step = 1e-4, start = T0 } = o;
  return Array.from({ length: n }, (_, i) => [Number((lon + i * step).toFixed(7)), lat, start + i * 3000, 0, null]);
}

const body = (points: CompactPoint[], overrides: Record<string, unknown> = {}) => ({
  type: 'walk',
  name: 'Walk',
  source: 'recording',
  startedAt: iso(points[0][2]),
  endedAt: iso(points.at(-1)![2]),
  timeZone: 'Europe/Warsaw',
  resumedSegments: null,
  track: { points },
  ...overrides,
});

const grant = (token: string = TOKENS.admin) =>
  h.call('PUT', '/v1/me/consents/cloud-sync', { token, body: { granted: true, policyVersion: '2026-10' } });

async function putOk(id: string, b: unknown, token: string = TOKENS.admin) {
  const res = await h.call('PUT', `/v1/activities/${id}`, { body: b, token });
  expect(res.status, await res.clone().text()).toBeLessThan(300);
  return res;
}

const rows = async <T>(query: SQL) => ((await h.db.execute(query)) as unknown as { rows: T[] }).rows;

/** The stored projection, as the route must list it: `[cell, walk, run, cycle]` in JS string order. */
async function storedCells(userId = 'admin') {
  const r = await rows<{ cell: string; walk: number; run: number; cycle: number }>(
    sql`SELECT cell, walk, run, cycle FROM turf_cells WHERE user_id = ${userId}`
  );
  return r.map((x) => [x.cell, x.walk, x.run, x.cycle]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

interface CellsPage {
  turfVersion: number;
  total: number;
  cells: [string, number, number, number][];
  nextCursor: string | null;
}

/** Follows `nextCursor` to the end; every URL requested is kept. */
async function download(limit: number, urls: string[] = []) {
  const pages: CellsPage[] = [];
  let cursor: string | null = null;
  do {
    const url: string = `/v1/turf/cells?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
    urls.push(url);
    const res = await h.call('GET', url);
    expect(res.status, await res.clone().text()).toBe(200);
    const page = (await res.json()) as CellsPage;
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor);
  return pages;
}

/** Three overlapping made-up activities (walk, run, cycle). */
async function seed() {
  await grant();
  await putOk('w1', body(line({})));
  await putOk('r1', body(line({ lon: 21.0125, start: T0 + 3_600_000 }), { type: 'run' }));
  await putOk('c1', body(line({ lat: 52.2301, start: T0 + 7_200_000, n: 60 }), { type: 'cycle' }));
}

describe('GET /v1/turf/cells', () => {
  it('pages through every cell in id order; the pages add up to the stored projection', async () => {
    await seed();
    const expected = await storedCells();
    expect(expected.length).toBeGreaterThan(10);
    const pages = await download(3);
    expect(pages.length).toBe(Math.ceil(expected.length / 3));
    expect(pages.flatMap((p) => p.cells)).toEqual(expected);
    const version = await h.store.read('admin').turf.version();
    for (const p of pages) {
      expect(p).toMatchObject({ turfVersion: version, total: expected.length });
    }
    // One page with the default limit is the same download.
    expect((await download(50_000)).flatMap((p) => p.cells)).toEqual(expected);
  });

  it('answers an empty turf with one empty page', async () => {
    await grant();
    const res = await h.call('GET', '/v1/turf/cells');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ turfVersion: 0, total: 0, cells: [], nextCursor: null });
  });

  it('tags the version (ETag "t<v>-<epoch>"), answers 304 to If-None-Match, 200 after a change', async () => {
    await seed();
    const first = await h.call('GET', '/v1/turf/cells');
    const etag = first.headers.get('etag')!;
    const version = await h.store.read('admin').turf.version();
    expect(etag).toMatch(new RegExp(`^"t${version}-[A-Za-z0-9_-]{12}"$`));
    // The epoch is opaque: not the account's creation time (it would travel in every cursor).
    const [user] = await rows<{ created_at: Date }>(sql`SELECT created_at FROM users WHERE id = 'admin'`);
    expect(etag).not.toContain(new Date(user.created_at).getTime().toString(36));
    expect(first.headers.get('cache-control')).toBe('private, no-store');

    const again = await h.call('GET', '/v1/turf/cells', { headers: { 'If-None-Match': etag } });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(again.headers.get('etag')).toBe(etag);
    expect(again.headers.get('cache-control')).toBe('private, no-store');
    expect((await h.call('GET', '/v1/turf/cells', { headers: { 'If-None-Match': `W/${etag}` } })).status).toBe(304);

    await putOk('w2', body(line({ lat: 52.2305, start: T0 + 86_400_000 })));
    const changed = await h.call('GET', '/v1/turf/cells', { headers: { 'If-None-Match': etag } });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('etag')).not.toBe(etag);
  });

  it('reads the version first: a 304 loads no cell', async () => {
    await seed();
    let loads = 0;
    const counting = Object.assign(Object.create(h.store) as BackupStore, {
      read: (userId: string): UserReader => {
        const reader = h.store.read(userId);
        const turf = Object.assign(Object.create(reader.turf) as UserReader['turf'], {
          cellCounts: (page: Parameters<UserReader['turf']['cellCounts']>[0]) => {
            loads++;
            return reader.turf.cellCounts(page);
          },
        });
        return Object.assign(Object.create(reader) as UserReader, { turf });
      },
    });
    const service = new TurfService(counting, h.clock, h.grid);
    const page = await service.cells('admin', { limit: 10 });
    expect(loads).toBe(1);
    const answer = await service.cells('admin', { limit: 10, ifNoneMatch: page.etag });
    expect(answer).toEqual({ notModified: true, etag: page.etag });
    expect(loads).toBe(1);
  });

  it('only the first page answers 304: a later page with the shared tag still gets its cells', async () => {
    await seed();
    const first = await h.call('GET', '/v1/turf/cells?limit=3');
    const etag = first.headers.get('etag')!;
    const { nextCursor } = (await first.json()) as CellsPage;
    const second = await h.call('GET', `/v1/turf/cells?limit=3&cursor=${nextCursor}`, {
      headers: { 'If-None-Match': etag },
    });
    expect(second.status).toBe(200);
    expect(((await second.json()) as CellsPage).cells).toEqual((await storedCells()).slice(3, 6));
  });

  /** A TurfService whose page read lets `during(call)` commit a write while the page is read. */
  function racing(during: (call: number) => Promise<unknown>) {
    let calls = 0;
    const store = Object.assign(Object.create(h.store) as BackupStore, {
      read: (userId: string): UserReader => {
        const reader = h.store.read(userId);
        const turf = Object.assign(Object.create(reader.turf) as UserReader['turf'], {
          cellCounts: async (page: Parameters<UserReader['turf']['cellCounts']>[0]) => {
            const result = await reader.turf.cellCounts(page);
            await during(++calls);
            return result;
          },
        });
        return Object.assign(Object.create(reader) as UserReader, { turf });
      },
    });
    return new TurfService(store, h.clock, h.grid);
  }
  let moved = 0;
  // Starts in the past: a future start would be left unclaimed and change no turf.
  const upload = () =>
    putOk(`m${++moved}`, body(line({ lat: 52.2309 + moved * 1e-4, start: T0 - moved * 86_400_000 })));

  it('a page never mixes two versions: a write during the read is re-read, 410 with a cursor', async () => {
    await seed();
    const once = racing(async (call) => {
      if (call === 1) {
        await upload();
      }
    });
    const before = await h.store.read('admin').turf.version();
    const page = await once.cells('admin', { limit: 3 });
    const version = await h.store.read('admin').turf.version();
    expect(version).toBeGreaterThan(before);
    expect(page).toMatchObject({ notModified: false, turfVersion: version });
    expect(page.notModified === false && page.cells).toEqual((await storedCells()).slice(0, 3));

    const always = racing(upload);
    const cursor = page.notModified === false ? page.nextCursor! : '';
    await expect(always.cells('admin', { limit: 3, cursor })).rejects.toMatchObject({ code: 'turf.changed' });
  });

  it('a first page the turf keeps changing under is 503 turf.busy with Retry-After', async () => {
    await seed();
    await expect(racing(upload).cells('admin', { limit: 3 })).rejects.toMatchObject({
      code: 'turf.busy',
      headers: { 'Retry-After': '5' },
    });
  });

  it('a page reads only its rows, never the whole projection', async () => {
    await seed();
    const store = Object.assign(Object.create(h.store) as BackupStore, {
      read: (userId: string): UserReader => {
        const reader = h.store.read(userId);
        const turf = Object.assign(Object.create(reader.turf) as UserReader['turf'], {
          allCells: () => Promise.reject(new Error('a page must not load every cell')),
        });
        return Object.assign(Object.create(reader) as UserReader, { turf });
      },
    });
    const page = await new TurfService(store, h.clock, h.grid).cells('admin', { limit: 3 });
    expect(page.notModified === false && page.cells).toEqual((await storedCells()).slice(0, 3));
  });

  it('a cursor of an older version is 410 turf.changed; a malformed one 400', async () => {
    await seed();
    const page = (await (await h.call('GET', '/v1/turf/cells?limit=5')).json()) as CellsPage;
    expect(page.nextCursor).toBeTruthy();
    await putOk('w2', body(line({ lat: 52.2305, start: T0 + 86_400_000 })));
    const stale = await h.call('GET', `/v1/turf/cells?limit=5&cursor=${page.nextCursor}`);
    expect(stale.status).toBe(410);
    expect(await stale.json()).toMatchObject({ status: 410, code: 'turf.changed' });

    for (const cursor of ['not-base64-json', Buffer.from('{"o":5}').toString('base64url')]) {
      const res = await h.call('GET', `/v1/turf/cells?cursor=${cursor}`);
      expect([cursor, res.status]).toEqual([cursor, 400]);
    }
    // Another account's creation time (an erased and re-created account) is stale too.
    const decoded = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString()) as Record<string, unknown>;
    const version = await h.store.read('admin').turf.version();
    const forged = Buffer.from(JSON.stringify({ ...decoded, v: version, c: 'zzz' })).toString('base64url');
    expect((await h.call('GET', `/v1/turf/cells?cursor=${forged}`)).status).toBe(410);
  });

  it('bounds the limit (1–50,000) and validates before reading', async () => {
    await grant();
    for (const limit of ['0', '50001', 'abc']) {
      expect((await h.call('GET', `/v1/turf/cells?limit=${limit}`)).status).toBe(400);
    }
    expect((await h.call('GET', '/v1/turf/cells?limit=50000')).status).toBe(200);
    expect((await h.call('GET', '/v1/turf/cells', { token: null })).status).toBe(401);
  });

  it("never lists another user's cells", async () => {
    await seed();
    await grant(TOKENS.other);
    const res = await h.call('GET', '/v1/turf/cells', { token: TOKENS.other });
    expect(await res.json()).toMatchObject({ total: 0, cells: [] });
  });

  it('no Turf Cell id or coordinate in any URL, cursor or log line', async () => {
    await seed();
    const urls: string[] = [];
    await download(4, urls);
    const decodedCursors = urls
      .map((u) => /cursor=([^&]+)/.exec(u)?.[1])
      .filter((c): c is string => !!c)
      .map((c) => Buffer.from(c, 'base64url').toString());
    expect(decodedCursors.length).toBeGreaterThan(2);
    for (const c of decodedCursors) {
      expect(Object.keys(JSON.parse(c) as object).sort()).toEqual(['c', 'o', 'v']);
    }
    const text = [...urls, ...decodedCursors, ...logged].join('\n');
    expect(text).not.toMatch(H3_ID);
    expect(text).not.toMatch(/21\.01|52\.2/);
    expect(logged.some((l) => l.includes('/v1/turf/cells'))).toBe(true);
  });

  it('a 50,000-cell page stays under the 4.5 MB response limit', { timeout: 120_000 }, async () => {
    await grant();
    // Made-up cell ids (not real places), straight into the projection.
    await h.db.execute(sql`
      INSERT INTO turf_cells (user_id, cell, walk, run, cycle, first_at, first_activity_id)
      SELECT 'admin', '8b' || lpad(to_hex(i), 13, '0'), 999, 999, 999, now(), 'seed'
      FROM generate_series(1, 50000) AS i`);
    await h.db.execute(sql`UPDATE users SET turf_version = 7 WHERE id = 'admin'`);
    const res = await h.call('GET', '/v1/turf/cells?limit=50000');
    expect(res.status).toBe(200);
    const bytes = (await res.clone().arrayBuffer()).byteLength;
    const page = (await res.json()) as CellsPage;
    expect(page).toMatchObject({ turfVersion: 7, total: 50_000, nextCursor: null });
    expect(page.cells).toHaveLength(50_000);
    expect(bytes).toBeLessThan(4.5 * 1024 * 1024);
  });

  it('works with the website session cookie (a read: no CSRF headers needed)', async () => {
    await seed();
    const email = 'ania@example.com';
    const ip = { 'X-Real-IP': '203.0.113.9' };
    const web = { Origin: DEV_WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'CityTurfer-Client': 'web/0.10.0' };
    await h.call('POST', '/v1/auth/codes', { token: null, body: { email }, headers: ip });
    const signIn = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email, code: codeIn(h.mailer.lastTo(email)?.text), client: 'browser' },
      headers: { ...web, ...ip },
    });
    const cookie = /^(__Host-ct_session=[^;]*)/.exec(signIn.headers.get('set-cookie') ?? '')?.[1];
    expect(cookie).toBeTruthy();
    for (const path of ['/v1/turf/cells', '/v1/turf/summary', '/v1/activity-totals']) {
      const res = await h.call('GET', path, { token: null, headers: { Cookie: cookie! } });
      expect([path, res.status]).toEqual([path, 200]);
    }
  });
});

describe('GET /v1/turf/summary', () => {
  it('summarises the stored projection at the server clock, never cached', async () => {
    await seed();
    const res = await h.call('GET', '/v1/turf/summary');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const s = (await res.json()) as Record<string, unknown>;
    const cells = await storedCells();
    expect(s).toMatchObject({
      cellCount: cells.length,
      byType: {
        walk: cells.filter((c) => (c[1] as number) > 0).length,
        run: cells.filter((c) => (c[2] as number) > 0).length,
        cycle: cells.filter((c) => (c[3] as number) > 0).length,
      },
    });
    // All of it is new this week at the upload time; none of it a year later.
    expect(s.newThisWeekKm2).toBeCloseTo(s.areaKm2 as number, 12);
    h.clock.t += 365 * 86_400_000;
    expect(await (await h.call('GET', '/v1/turf/summary')).json()).toMatchObject({
      newThisWeekKm2: 0,
      newThisMonthKm2: 0,
    });
    expect(JSON.stringify(s)).not.toMatch(H3_ID);
  });
});

describe('GET /v1/turf/claims/{activityId}', () => {
  it('answers the claim with canonical new cells, sorted by id, never cached', async () => {
    await seed();
    const res = await h.call('GET', '/v1/turf/claims/r1');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const claim = (await res.json()) as {
      activityId: string;
      cellCount: number;
      newCellCount: number;
      newAreaKm2: number;
      cells: { id: string; isNew: boolean }[];
    };
    const ids = claim.cells.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
    expect(Object.keys(claim.cells[0]).sort()).toEqual(['id', 'isNew']);
    expect(claim.activityId).toBe('r1');
    expect(claim.cellCount).toBe(ids.length);
    expect(claim.newCellCount).toBe(claim.cells.filter((c) => c.isNew).length);
    // r1 overlaps the earlier w1: some of its cells are not new (D4).
    expect(claim.newCellCount).toBeLessThan(claim.cellCount);
    const w1 = (await (await h.call('GET', '/v1/turf/claims/w1')).json()) as {
      cellCount: number;
      newCellCount: number;
    };
    expect(w1.newCellCount).toBe(w1.cellCount);
  });

  it('404 for an unknown or unclaimed activity, 410 after a delete, 404 for another user', async () => {
    await seed();
    const unknown = await h.call('GET', '/v1/turf/claims/never-uploaded');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'not-found' });

    await putOk('future', body(line({ start: h.clock.t + 3_600_000 })));
    const unclaimed = await h.call('GET', '/v1/turf/claims/future');
    expect(unclaimed.status).toBe(404);
    expect(await unclaimed.json()).toMatchObject({ code: 'not-found' });

    await h.call('DELETE', '/v1/activities/w1');
    const deleted = await h.call('GET', '/v1/turf/claims/w1');
    expect(deleted.status).toBe(410);
    expect(await deleted.json()).toMatchObject({ code: 'activity.deleted' });

    const theirs = await h.call('GET', '/v1/turf/claims/r1', { token: TOKENS.other });
    expect(theirs.status).toBe(404);
    expect((await h.call('GET', '/v1/turf/claims/not%20an%20id')).status).toBe(400);
  });
});

describe('GET /v1/activity-totals', () => {
  it('counts all time and per type, gap estimates included, as the phone does', async () => {
    await seed();
    await putOk('w2', body(line({ lat: 52.2305, start: T0 + 86_400_000, n: 80 })));
    await h.call('PUT', '/v1/activities/w2/gap-routes', {
      body: {
        checkedAt: iso(T0 + 90_000_000),
        routes: [
          {
            afterSegment: 0,
            distanceM: 240.5,
            movingS: 85,
            coords: [
              [21.0129, 52.2301],
              [21.0141, 52.2307],
            ],
          },
        ],
      },
    });
    await putOk('gone', body(line({ start: T0 + 2 * 86_400_000 }), { type: 'run' }));
    await h.call('DELETE', '/v1/activities/gone');

    // By hand: each activity's detail (recorded + estimated), summed per type.
    const want = {
      walk: { count: 0, distanceM: 0, movingS: 0 },
      run: { count: 0, distanceM: 0, movingS: 0 },
      cycle: { count: 0, distanceM: 0, movingS: 0 },
    };
    for (const id of ['w1', 'w2', 'r1', 'c1']) {
      const a = (await (await h.call('GET', `/v1/activities/${id}`)).json()) as {
        type: keyof typeof want;
        distanceM: number;
        movingS: number;
        estimatedDistanceM: number;
      };
      want[a.type].count++;
      want[a.type].distanceM += a.distanceM;
      want[a.type].movingS += a.movingS;
      if (id === 'w2') {
        expect(a.estimatedDistanceM).toBe(240.5);
      }
    }
    const res = await h.call('GET', '/v1/activity-totals');
    expect(res.status).toBe(200);
    const got = (await res.json()) as { allTime: typeof want.walk; byType: typeof want };
    for (const t of ['walk', 'run', 'cycle'] as const) {
      expect(got.byType[t].count).toBe(want[t].count);
      expect(got.byType[t].distanceM).toBeCloseTo(want[t].distanceM, 6);
      expect(got.byType[t].movingS).toBeCloseTo(want[t].movingS, 6);
    }
    expect(got.allTime.count).toBe(4);
    expect(got.allTime.distanceM).toBeCloseTo(want.walk.distanceM + want.run.distanceM + want.cycle.distanceM, 6);
    expect(got.allTime.movingS).toBeCloseTo(want.walk.movingS + want.run.movingS + want.cycle.movingS, 6);
  });

  it('is all zeros for a new user', async () => {
    const zero = { count: 0, distanceM: 0, movingS: 0 };
    expect(await (await h.call('GET', '/v1/activity-totals', { token: TOKENS.other })).json()).toEqual({
      allTime: zero,
      byType: { walk: zero, run: zero, cycle: zero },
    });
  });
});

describe('GET /v1/activities?startedAfter=&startedBefore=', () => {
  it('bounds startedAt (after inclusive, before exclusive) and pages with the same cursor', async () => {
    await grant();
    const day = 86_400_000;
    for (let i = 0; i < 5; i++) {
      await putOk(`d${i}`, body(line({ start: T0 + i * day })));
    }
    const ids = async (query: string) => {
      const out: string[] = [];
      let cursor: string | null = null;
      do {
        const url: string = `/v1/activities?limit=1${query}${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await h.call('GET', url);
        expect(res.status, url).toBe(200);
        const page = (await res.json()) as { items: { id: string }[]; nextCursor: string | null };
        out.push(...page.items.map((x) => x.id));
        cursor = page.nextCursor;
      } while (cursor);
      return out;
    };
    expect(await ids('')).toEqual(['d4', 'd3', 'd2', 'd1', 'd0']);
    expect(await ids(`&startedAfter=${iso(T0 + day)}`)).toEqual(['d4', 'd3', 'd2', 'd1']);
    expect(await ids(`&startedBefore=${iso(T0 + 3 * day)}`)).toEqual(['d2', 'd1', 'd0']);
    expect(await ids(`&startedAfter=${iso(T0 + day)}&startedBefore=${iso(T0 + 3 * day)}`)).toEqual(['d2', 'd1']);
    expect(await ids(`&startedAfter=${iso(T0 + 9 * day)}`)).toEqual([]);
    expect(await ids(`&type=run&startedAfter=${iso(T0)}`)).toEqual([]);
    expect((await h.call('GET', '/v1/activities?startedAfter=yesterday')).status).toBe(400);
  });
});
