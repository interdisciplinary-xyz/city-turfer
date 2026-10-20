import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { trackHashOf } from '../backup/hashing';
import { defaultDeps, silentLog } from '../deps';
import { backupApp, TOKENS, track, upload } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
});
afterEach(async () => {
  await h.close();
});

const grant = (token: string = TOKENS.admin, purpose = 'cloud-sync') =>
  h.call('PUT', `/v1/me/consents/${purpose}`, { token, body: { granted: true, policyVersion: '2026-10' } });

const put = (id: string, body: unknown, headers: Record<string, string> = {}, token: string = TOKENS.admin) =>
  h.call('PUT', `/v1/activities/${id}`, { body, headers, token });

describe('auth', () => {
  it('answers 401 auth.missing without a token and auth.invalid for an unknown one', async () => {
    const missing = await h.call('GET', '/v1/me', { token: null });
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ code: 'auth.missing' });
    const unknown = await h.call('GET', '/v1/me', { token: 'not-a-token' });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toMatchObject({ code: 'auth.invalid' });
  });

  it('creates the user on first sight and answers /v1/me from the token configuration', async () => {
    const admin = await h.call('GET', '/v1/me');
    expect(await admin.json()).toEqual({ id: 'admin', email: 'admin@cityturfer.com', displayName: 'Admin' });
    const other = await h.call('GET', '/v1/me', { token: TOKENS.other });
    expect(await other.json()).toEqual({ id: 'other', email: null, displayName: 'other' });
  });

  it('answers live data routes 503 storage.unavailable without a database', async () => {
    const noDb = createApp(
      defaultDeps({
        log: silentLog,
        auth: { verify: () => Promise.resolve({ userId: 'admin', verified: true }) },
      })
    );
    const res = await noDb.request('/v1/me', { headers: { Authorization: 'Bearer x' } });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'storage.unavailable' });
    const health = await noDb.request('/v1/health');
    expect(await health.json()).toMatchObject({ status: 'ok', database: 'not-configured' });
  });

  it('reports a reachable database in /v1/health', async () => {
    expect(await (await h.call('GET', '/v1/health', { token: null })).json()).toMatchObject({ database: 'ok' });
  });
});

describe('consents', () => {
  it('lists, gives and withdraws consents with the policy version and server time', async () => {
    expect(await (await h.call('GET', '/v1/me/consents')).json()).toEqual({ items: [] });
    await grant();
    h.clock.t += 60_000;
    const res = await h.call('PUT', '/v1/me/consents/cloud-sync', {
      body: { granted: false, policyVersion: '2026-11' },
    });
    expect(await res.json()).toEqual({
      items: [{ purpose: 'cloud-sync', granted: false, policyVersion: '2026-11', at: '2026-10-20T08:01:00.000Z' }],
    });
  });

  it('refuses activity and Home City writes without cloud-sync (403), and after it is withdrawn', async () => {
    expect((await put('a1', upload())).status).toBe(403);
    const home = await h.call('PUT', '/v1/turf/home-city', {
      body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' },
    });
    expect(home.status).toBe(403);
    expect(await home.json()).toMatchObject({ code: 'consent.required' });

    await grant();
    expect((await put('a1', upload())).status).toBe(201);
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: false, policyVersion: '2026-10' } });
    expect((await put('a2', upload())).status).toBe(403);
    // Withdrawing erases nothing.
    expect((await h.call('GET', '/v1/activities/a1')).status).toBe(200);
  });

  it('needs apple-health-in-cloud-sync for Apple Health activities', async () => {
    await grant();
    expect((await put('hk-1', upload({ source: 'apple-health' }))).status).toBe(403);
    await grant(TOKENS.admin, 'apple-health-in-cloud-sync');
    expect((await put('hk-1', upload({ source: 'apple-health' }))).status).toBe(201);
  });
});

describe('PUT /v1/activities/{id}', () => {
  beforeEach(async () => {
    await grant();
  });

  it('creates (201 + ETag + Location) with the summary computed by the core', async () => {
    const res = await put('run-1', upload());
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"v1"');
    expect(res.headers.get('location')).toBe('/v1/activities/run-1');
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'run-1',
      type: 'run',
      name: 'Morning run',
      version: 1,
      pointCount: 40,
      elapsedS: 117,
      estimatedDistanceM: 0,
      trackHash: trackHashOf(track()),
      coreVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
    });
    // 39 steps of 1e-4° longitude at 52.23° N ≈ 6.82 m each.
    expect(body.distanceM).toBeGreaterThan(260);
    expect(body.distanceM).toBeLessThan(272);
    expect(body.movingS).toBe(117);
  });

  it('treats an identical replay as 200, unchanged, even without If-Match', async () => {
    await put('run-1', upload());
    const replay = await put('run-1', upload({ trackHash: trackHashOf(track()) }));
    expect(replay.status).toBe(200);
    expect(replay.headers.get('etag')).toBe('"v1"');
    expect((await replay.json()).version).toBe(1);
  });

  it('needs If-Match for different content: 428 without, 412 stale, 200 and version + 1 when current', async () => {
    await put('run-1', upload());
    const renamed = upload({ name: 'Evening run' });
    const missing = await put('run-1', renamed);
    expect(missing.status).toBe(428);
    expect(await missing.json()).toMatchObject({ code: 'precondition-required' });
    const stale = await put('run-1', renamed, { 'If-Match': '"v7"' });
    expect(stale.status).toBe(412);
    expect(stale.headers.get('etag')).toBe('"v1"');
    const ok = await put('run-1', renamed, { 'If-Match': '"v1"' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('etag')).toBe('"v2"');
    expect(await ok.json()).toMatchObject({ name: 'Evening run', version: 2 });
  });

  it('checks a trackHash the client sends against the canonical one (422)', async () => {
    const res = await put('run-1', upload({ trackHash: 'a'.repeat(64) }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'activity.track-hash-mismatch' });
  });

  it('documents the canonical hash: sha256 of JSON.stringify(points)', () => {
    const points = track(3);
    expect(trackHashOf(points)).toBe(createHash('sha256').update(JSON.stringify(points)).digest('hex'));
  });

  it('answers domain rules from the core as 422', async () => {
    const res = await put('run-1', upload({ endedAt: '2026-10-19T07:00:00Z' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'activity.ends-before-start' });
  });

  it('accepts a gzipped upload', async () => {
    const res = await h.call('PUT', '/v1/activities/run-gz', {
      raw: gzipSync(JSON.stringify(upload())),
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).trackHash).toBe(trackHashOf(track()));
  });

  it('refuses 7-column points without echoing coordinates', async () => {
    const points = track(2).map((p) => [...p, 5, 2.9]);
    const res = await put('run-1', upload({ track: { points } }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('52.2297');
  });
});

describe('DELETE and tombstones', () => {
  beforeEach(async () => {
    await grant();
  });

  it('deletes into a tombstone: 204 always, then 410 on upload, read and track', async () => {
    await put('run-1', upload());
    expect((await h.call('DELETE', '/v1/activities/run-1')).status).toBe(204);
    expect((await h.call('DELETE', '/v1/activities/run-1')).status).toBe(204);
    expect((await h.call('DELETE', '/v1/activities/never-uploaded')).status).toBe(204);
    const again = await put('run-1', upload(), { 'If-Match': '"v1"' });
    expect(again.status).toBe(410);
    expect(await again.json()).toMatchObject({ code: 'activity.deleted' });
    expect((await h.call('GET', '/v1/activities/run-1')).status).toBe(410);
    expect((await h.call('GET', '/v1/activities/run-1/track')).status).toBe(410);
  });
});

describe('reads', () => {
  beforeEach(async () => {
    await grant();
  });

  it('answers the detail with splits and bbox, and the track with an ETag and 304', async () => {
    await put('run-1', upload());
    const detail = await h.call('GET', '/v1/activities/run-1');
    expect(detail.status).toBe(200);
    expect(detail.headers.get('etag')).toBe('"v1"');
    const body = await detail.json();
    expect(body.bbox).toHaveLength(4);
    expect(body).toMatchObject({ splits: [], gapRoutes: [], resumedSegments: null });

    const t = await h.call('GET', '/v1/activities/run-1/track');
    const etag = `"${trackHashOf(track())}"`;
    expect(t.headers.get('etag')).toBe(etag);
    expect(t.headers.get('cache-control')).toBe('private, no-cache');
    expect((await t.json()).points).toEqual(track());
    const cached = await h.call('GET', '/v1/activities/run-1/track', { headers: { 'If-None-Match': etag } });
    expect(cached.status).toBe(304);
  });

  it('lists newest first with an opaque cursor and a type filter', async () => {
    for (const [i, type] of ['walk', 'run', 'cycle'].entries()) {
      const points = track(10, Date.parse('2026-10-1' + (i + 1) + 'T07:00:00Z'));
      await put(`a${i}`, {
        ...upload({ type, track: { points } }),
        startedAt: new Date(points[0][2]).toISOString(),
        endedAt: new Date(points[9][2]).toISOString(),
      });
    }
    const first = await (await h.call('GET', '/v1/activities?limit=2')).json();
    expect(first.items.map((a: { id: string }) => a.id)).toEqual(['a2', 'a1']);
    const second = await (await h.call('GET', `/v1/activities?limit=2&cursor=${first.nextCursor}`)).json();
    expect(second).toMatchObject({ items: [{ id: 'a0' }], nextCursor: null });
    const runs = await (await h.call('GET', '/v1/activities?type=run')).json();
    expect(runs.items.map((a: { id: string }) => a.id)).toEqual(['a1']);
  });
});

describe('gap routes', () => {
  beforeEach(async () => {
    await grant();
    await put('run-1', upload());
  });

  const routes = {
    checkedAt: '2026-10-19T08:00:00Z',
    routes: [
      {
        afterSegment: 0,
        distanceM: 240,
        movingS: 85,
        coords: [
          [21.0129, 52.2301],
          [21.0141, 52.2307],
        ],
      },
    ],
  };

  it('stores the estimates, adds them to the totals and bumps the version once', async () => {
    const before = await (await h.call('GET', '/v1/activities/run-1')).json();
    const res = await h.call('PUT', '/v1/activities/run-1/gap-routes', { body: routes });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"v2"');
    const body = await res.json();
    expect(body.estimatedDistanceM).toBe(240);
    expect(body.distanceM).toBeCloseTo(before.distanceM + 240);
    expect(body.movingS).toBe(before.movingS + 85);
    const replay = await h.call('PUT', '/v1/activities/run-1/gap-routes', { body: routes });
    expect(replay.headers.get('etag')).toBe('"v2"');
    expect((await (await h.call('GET', '/v1/activities/run-1')).json()).gapRoutes).toEqual(routes.routes);
  });

  it('answers 404 for an unknown activity', async () => {
    expect((await h.call('PUT', '/v1/activities/nope/gap-routes', { body: routes })).status).toBe(404);
  });
});

describe('GET /v1/sync/changes', () => {
  beforeEach(async () => {
    await grant();
  });

  it('is the manifest without a cursor, pages in server order, and continues from the cursor', async () => {
    await put('a1', upload());
    await put('a2', upload());
    await put('a3', upload());
    await h.call('DELETE', '/v1/activities/a2');
    await h.call('PUT', '/v1/turf/home-city', { body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' } });

    const page1 = await (await h.call('GET', '/v1/sync/changes?limit=2')).json();
    expect(page1.hasMore).toBe(true);
    expect(page1.changes.map((c: { type: string }) => c.type)).toEqual(['activity.upserted', 'activity.upserted']);
    expect(page1.changes.map((c: { activity: { id: string } }) => c.activity.id)).toEqual(['a1', 'a3']);
    const page2 = await (await h.call('GET', `/v1/sync/changes?limit=2&cursor=${page1.nextCursor}`)).json();
    expect(page2.hasMore).toBe(false);
    expect(page2.changes).toEqual([
      expect.objectContaining({ type: 'activity.deleted', activityId: 'a2' }),
      expect.objectContaining({ type: 'home-city.chosen', cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00.000Z' }),
    ]);
    const empty = await (await h.call('GET', `/v1/sync/changes?cursor=${page2.nextCursor}`)).json();
    expect(empty).toEqual({ changes: [], nextCursor: page2.nextCursor, hasMore: false });

    await put('a1', upload({ name: 'Renamed' }), { 'If-Match': '"v1"' });
    const next = await (await h.call('GET', `/v1/sync/changes?cursor=${page2.nextCursor}`)).json();
    expect(next.changes).toEqual([
      expect.objectContaining({
        type: 'activity.upserted',
        activity: expect.objectContaining({ id: 'a1', version: 2 }),
      }),
    ]);
  });

  it('answers 410 sync.cursor-expired for a cursor it never handed out', async () => {
    const res = await h.call('GET', '/v1/sync/changes?cursor=bm9wZQ');
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ code: 'sync.cursor-expired' });
  });
});

describe('Home City', () => {
  beforeEach(async () => {
    await grant();
  });

  const choose = (cityId: string | null, chosenAt: string) =>
    h.call('PUT', '/v1/turf/home-city', { body: { cityId, chosenAt } });

  it('keeps the latest chosenAt (last write wins), clears with null, refuses unknown cities', async () => {
    expect(await (await h.call('GET', '/v1/turf/home-city')).json()).toEqual({ city: null, chosenAt: null });
    await choose('pl-krakow', '2026-10-19T08:00:00Z');
    const older = await (await choose('pl-warsaw', '2026-10-19T07:00:00Z')).json();
    expect(older).toMatchObject({ city: { id: 'pl-krakow' }, chosenAt: '2026-10-19T08:00:00.000Z' });
    const cleared = await (await choose(null, '2026-10-19T09:00:00Z')).json();
    expect(cleared).toEqual({ city: null, chosenAt: '2026-10-19T09:00:00.000Z' });
    const unknown = await choose('xx-nowhere', '2026-10-19T10:00:00Z');
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toMatchObject({ code: 'home-city.unknown' });
  });
});

describe('user isolation', () => {
  it("never lets one token see or touch another user's data", async () => {
    await grant();
    await grant(TOKENS.other);
    await put('mine', upload());
    await h.call('PUT', '/v1/turf/home-city', { body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' } });
    const other = TOKENS.other;
    expect((await h.call('GET', '/v1/activities/mine', { token: other })).status).toBe(404);
    expect((await h.call('GET', '/v1/activities/mine/track', { token: other })).status).toBe(404);
    expect(
      (
        await h.call('PUT', '/v1/activities/mine/gap-routes', {
          token: other,
          body: { checkedAt: '2026-10-19T08:00:00Z', routes: [] },
        })
      ).status
    ).toBe(404);
    expect(await (await h.call('GET', '/v1/activities', { token: other })).json()).toEqual({
      items: [],
      nextCursor: null,
    });
    expect((await (await h.call('GET', '/v1/sync/changes', { token: other })).json()).changes).toEqual([]);
    expect(await (await h.call('GET', '/v1/turf/home-city', { token: other })).json()).toEqual({
      city: null,
      chosenAt: null,
    });
    // The other user's delete and upload of the same id are theirs alone.
    expect((await h.call('DELETE', '/v1/activities/mine', { token: other })).status).toBe(204);
    expect((await h.call('GET', '/v1/activities/mine')).status).toBe(200);
    expect((await put('mine', upload(), {}, other)).status).toBe(410);
  });
});
