import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BackupService } from '../backup/use-cases';
import { backupApp, closeSharedDb, track, upload } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
  await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

/** A made-up activity `i` days after 2026-10-01, 20 points around Warsaw Old Town. */
function activity(i: number, name = `Walk ${i}`) {
  const points = track(20, Date.parse('2026-10-01T07:00:00Z') + i * 86_400_000);
  return upload({
    type: 'walk',
    name,
    startedAt: new Date(points[0][2]).toISOString(),
    endedAt: new Date(points.at(-1)![2]).toISOString(),
    track: { points },
  });
}

const GAPS = {
  checkedAt: '2026-10-02T08:00:00Z',
  routes: [
    {
      afterSegment: 0,
      distanceM: 120,
      movingS: 40,
      coords: [
        [21.0129, 52.2301],
        [21.0141, 52.2307],
      ],
    },
  ],
};

describe('GET /v1/sync/changes entries', () => {
  it('carry no preview or numbers, only what a restore plans with', async () => {
    await h.call('PUT', '/v1/activities/w1', { body: activity(1) });
    const page = await (await h.call('GET', '/v1/sync/changes')).json();
    expect(Object.keys(page.changes[0].activity).sort()).toEqual(
      ['id', 'name', 'source', 'startedAt', 'trackHash', 'type', 'updatedAt', 'version'].sort()
    );
  });

  it('end a page at the byte budget (at least one change), with hasMore', async () => {
    for (let i = 0; i < 5; i++) {
      await h.call('PUT', `/v1/activities/w${i}`, { body: activity(i) });
    }
    const service = new BackupService(h.store, h.clock);
    const budget = { maxBytes: 250, sizeOf: () => 100 };
    const first = await service.changes('admin', { limit: 50 }, budget);
    expect(first.changes).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const tiny = await service.changes('admin', { limit: 50 }, { maxBytes: 1, sizeOf: () => 100 });
    expect(tiny.changes).toHaveLength(1);
    let cursor = first.nextCursor;
    const ids = first.changes.map((c) => (c.kind === 'activity' ? c.activity.id : ''));
    for (;;) {
      const page = await service.changes('admin', { limit: 50, cursor }, budget);
      ids.push(...page.changes.map((c) => (c.kind === 'activity' ? c.activity.id : '')));
      cursor = page.nextCursor;
      if (!page.hasMore) {
        break;
      }
    }
    expect(ids).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
  });
});

describe('restore to a new phone', () => {
  it('rebuilds every activity, track, gap check and the Home City from the manifest', async () => {
    const uploaded = new Map<string, ReturnType<typeof activity>>();
    for (let i = 0; i < 7; i++) {
      const body = activity(i);
      uploaded.set(`w${i}`, body);
      expect((await h.call('PUT', `/v1/activities/w${i}`, { body })).status).toBe(201);
    }
    await h.call('PUT', '/v1/activities/w1/gap-routes', { body: GAPS });
    await h.call('PUT', '/v1/activities/w2/gap-routes', { body: { checkedAt: GAPS.checkedAt, routes: [] } });
    await h.call('DELETE', '/v1/activities/w3');
    uploaded.delete('w3');
    await h.call('PUT', '/v1/turf/home-city', { body: { cityId: 'pl-warsaw', chosenAt: '2026-10-05T07:00:00Z' } });

    // The new phone: page the manifest (small pages), then fetch detail + track per activity.
    const upserts = new Map<string, { version: number; trackHash: string }>();
    const deleted = new Set<string>();
    let homeCity: string | null = null;
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const q = cursor ? `?limit=3&cursor=${cursor}` : '?limit=3';
      const page = await (await h.call('GET', `/v1/sync/changes${q}`)).json();
      pages++;
      for (const change of page.changes) {
        if (change.type === 'activity.upserted') {
          upserts.set(change.activity.id, change.activity);
        } else if (change.type === 'activity.deleted') {
          deleted.add(change.activityId);
        } else {
          homeCity = change.cityId;
        }
      }
      cursor = page.nextCursor;
      if (!page.hasMore) {
        break;
      }
    }
    expect(pages).toBeGreaterThan(1);
    expect([...deleted]).toEqual(['w3']);
    expect(homeCity).toBe('pl-warsaw');
    expect([...upserts.keys()].sort()).toEqual([...uploaded.keys()].sort());

    for (const [id, entry] of upserts) {
      const detail = await (await h.call('GET', `/v1/activities/${id}`)).json();
      const t = await (await h.call('GET', `/v1/activities/${id}/track`)).json();
      const original = uploaded.get(id)!;
      expect(detail).toMatchObject({
        id,
        name: original.name,
        type: original.type,
        source: original.source,
        startedAt: new Date(original.startedAt).toISOString(),
        endedAt: new Date(original.endedAt).toISOString(),
        timeZone: original.timeZone,
        version: entry.version,
        trackHash: entry.trackHash,
      });
      expect(t.points).toEqual(original.track.points);
      if (id === 'w1') {
        expect(detail).toMatchObject({ gapRoutes: GAPS.routes, gapsCheckedAt: '2026-10-02T08:00:00.000Z' });
      } else if (id === 'w2') {
        expect(detail).toMatchObject({ gapRoutes: [], gapsCheckedAt: '2026-10-02T08:00:00.000Z' });
      } else {
        expect(detail.gapsCheckedAt).toBeNull();
      }
    }
    expect((await h.call('GET', '/v1/activities/w3')).status).toBe(410);
  });
});
