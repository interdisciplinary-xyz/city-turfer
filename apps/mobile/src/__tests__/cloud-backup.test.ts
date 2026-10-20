/**
 * Cloud Backup end to end through the real wiring, outbox and SQL, against an in-memory API server:
 * consent first, first upload (manifest, order, skips, resume), outbox-driven pushes, conflicts and
 * every error path, Apple Health consent, Home City, and nothing at all while off or headless.
 */
import type { ActivityRecorded } from '@/contexts/activity-log';
import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/sqlite-activity-repository';
import { FakeApiServer, InMemoryDeviceTokenStore } from '@/contexts/cloud-backup/test-support/fake-api-server';
import { migrate } from '@/platform/migrations';
import type { TrackPoint } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

const T0 = Date.parse('2026-10-01T07:00:00Z');
const DAY = 86_400_000;

/** A short walk on day `day` (20 points, 5 s apart); `gapAt` puts a 10-minute pause inside segment 0. */
function walk(day: number, gapAt?: number): TrackPoint[] {
  return Array.from({ length: 20 }, (_, i) => ({
    lat: 52.25 + day * 0.001 + i * 0.00005,
    lon: 21.01 + i * 0.00005,
    t: T0 + day * DAY + i * 5_000 + (gapAt != null && i >= gapAt ? 600_000 : 0),
    segment: 0,
    alt: i === 0 ? null : 100,
    accuracy: 5,
    speed: 1.4,
  }));
}

function setup(options: { token?: string | null } = {}) {
  const db = openNodeDatabase();
  const server = new FakeApiServer();
  const tokens = new InMemoryDeviceTokenStore(options.token === undefined ? 'secret-token' : options.token);
  let now = Date.parse('2026-10-20T12:00:00Z');
  const app = { foreground: true };
  let n = 0;
  const adapters = {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => `session-${++n}` },
    clock: { now: () => now },
    isForeground: () => app.foreground,
    cloudBackup: { api: server.factory, tokens: () => tokens, timeZone: () => 'Europe/Warsaw' },
  };
  return {
    db,
    server,
    tokens,
    app,
    advance: (ms: number) => void (now += ms),
    async container() {
      await migrate(db);
      const c = wire('test', db, adapters);
      /** Import and let the outbox deliver (claims turf, queues backup work). */
      const add = async (id: string, points: TrackPoint[]) => {
        await c.activityLog.importActivity.execute({ id, type: 'walk', points });
        await c.dispatcher.dispatchPending();
      };
      return Object.assign(c, { add });
    },
  };
}

type Setup = ReturnType<typeof setup>;
type C = Awaited<ReturnType<Setup['container']>>;

/** Turn backup on and wait for the first run to finish. */
async function enable(c: C) {
  expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
  return c.cloudBackup.run.execute();
}

describe('Cloud Backup: off', () => {
  it('sends nothing at all while off, also for new activities and Home City choices', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.territory.chooseHomeCity.execute('pl-krakow');
    await c.dispatcher.dispatchPending();
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'off' });
    await c.runLaunchMaintenance();
    expect(t.server.requests).toEqual([]);
    expect(await t.db.first('SELECT COUNT(*) AS n FROM cb_activities')).toEqual({ n: 0 });
  });

  it('cannot be turned on without a device token', async () => {
    const t = setup({ token: null });
    const c = await t.container();
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    expect((await c.cloudBackup.status.execute()).enabled).toBe(false);
    expect(t.server.requests).toEqual([]);
  });

  it('stays off when the server refuses the token or cannot be reached', async () => {
    const t = setup({ token: 'wrong' });
    const c = await t.container();
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'auth' });
    await c.cloudBackup.saveToken.execute('  secret-token  ');
    expect(t.tokens.token).toBe('secret-token');
    t.server.failNext('setConsent', { kind: 'offline' });
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'offline' });
    expect((await c.cloudBackup.status.execute()).enabled).toBe(false);
  });
});

describe('Cloud Backup: first upload', () => {
  it('records the consent first, then uploads oldest first; never demo-*, hk-* only with consent', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-late', walk(3));
    await c.add('demo-1', walk(0));
    await c.add('hk-1', walk(1));
    await c.add('rec-early', walk(2));

    const result = await enable(c);
    expect(t.server.consentLog).toEqual([{ purpose: 'cloud-sync', granted: true, policyVersion: '2026-10' }]);
    expect(t.server.requests[0].method).toBe('setConsent');
    expect(result).toEqual({ kind: 'done', report: { uploaded: 2, deleted: 0, failed: 0, refused: 0, error: null } });
    expect(t.server.uploads()).toEqual(['rec-early', 'rec-late']);
    expect(t.server.activities.get('rec-early')).toMatchObject({
      version: 1,
      source: 'recording',
      timeZone: 'Europe/Warsaw',
      pointCount: 20,
    });
    expect(await c.cloudBackup.status.execute()).toMatchObject({
      enabled: true,
      hasToken: true,
      backedUp: 2,
      total: 2,
      lastError: null,
      lastRunAt: expect.any(Number),
    });
  });

  it('skips what the server already has and never resurrects what it deleted (manifest, paged)', async () => {
    const t = setup();
    t.server.pageSize = 1;
    t.server.seed('rec-a', 4);
    t.server.tombstones.add('rec-b');
    const c = await t.container();
    await c.add('rec-a', walk(0));
    await c.add('rec-b', walk(1));
    await c.add('rec-c', walk(2));

    await enable(c);
    expect(t.server.requests.filter((r) => r.method === 'changes')).toHaveLength(2);
    expect(t.server.uploads()).toEqual(['rec-c']);
    expect(
      await t.db.all('SELECT activity_id AS id, status, server_version AS v FROM cb_activities ORDER BY started_at')
    ).toEqual([
      { id: 'rec-a', status: 'backed-up', v: 4 },
      { id: 'rec-b', status: 'gone', v: null },
      { id: 'rec-c', status: 'backed-up', v: 1 },
    ]);
    // A later correction of the tombstoned one is not uploaded either: delete wins.
    await c.cloudBackup.queue.trackCorrected({
      type: 'ActivityTrackCorrected',
      v: 1,
      at: 0,
      activityId: 'rec-b',
      activityType: 'walk',
      startedAt: 0,
    });
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toEqual(['rec-c']);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ backedUp: 2, total: 3 });
  });

  it('resumes after an interruption without uploading anything twice', async () => {
    const t = setup();
    const c = await t.container();
    for (let d = 0; d < 5; d++) {
      await c.add(`rec-${d}`, walk(d));
    }
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    t.server.failNext('putActivity', { kind: 'offline' }, 1);
    // First upload: the very first request finds no network: the run stops.
    const first = await c.cloudBackup.run.execute();
    expect(first).toMatchObject({ kind: 'done', report: { error: 'offline' } });
    expect((await c.cloudBackup.status.execute()).lastError).toBe('offline');
    const before = t.server.activities.size;
    expect(before).toBeLessThan(5);

    const second = await c.cloudBackup.run.execute();
    expect(second).toMatchObject({ kind: 'done', report: { error: null } });
    expect(t.server.activities.size).toBe(5);
    const counts = t.server.uploads().reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});
    // Only the one that failed was tried twice; the comparison was not repeated.
    expect(Object.values(counts).filter((n) => n > 1)).toHaveLength(1);
    expect(t.server.requests.filter((r) => r.method === 'changes')).toHaveLength(1);
  });

  it('uploads at most two activities at a time', async () => {
    const t = setup();
    const c = await t.container();
    for (let d = 0; d < 6; d++) {
      await c.add(`rec-${d}`, walk(d));
    }
    await enable(c);
    expect(t.server.activities.size).toBe(6);
    expect(t.server.maxInFlight).toBe(2);
  });

  it('does no network work in the background (headless launch), and runs once foregrounded', async () => {
    const t = setup();
    const c = await t.container();
    await c.cloudBackup.enable.execute();
    const consentCalls = t.server.requests.length;
    t.app.foreground = false;
    await c.add('rec-1', walk(0));
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'background' });
    expect(t.server.requests).toHaveLength(consentCalls);
    t.app.foreground = true;
    await c.backUp();
    expect(t.server.uploads()).toEqual(['rec-1']);
  });
});

describe('Cloud Backup: pushes from the outbox', () => {
  it('uploads a new activity after its events are delivered, once, even when the event is replayed', async () => {
    const t = setup();
    const c = await t.container();
    await enable(c);
    await c.add('rec-1', walk(0));
    await c.backUp(); // the dispatcher already started one; this joins or repeats it
    expect(t.server.uploads()).toEqual(['rec-1']);

    const replay: ActivityRecorded = {
      type: 'ActivityRecorded',
      v: 1,
      at: 0,
      activityId: 'rec-1',
      activityType: 'walk' as const,
      startedAt: T0,
      endedAt: T0 + 1,
    };
    await c.cloudBackup.queue.activityRecorded(replay);
    await c.cloudBackup.queue.activityRecorded(replay);
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toEqual(['rec-1']);
  });

  it('deletes on the server what is deleted on the phone; a server tombstone (410) is never re-uploaded', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.add('rec-2', walk(1));
    await enable(c);

    await c.activityLog.remove.execute('rec-1');
    await c.dispatcher.dispatchPending();
    await c.backUp();
    expect(t.server.requests.filter((r) => r.method === 'deleteActivity').map((r) => r.id)).toEqual(['rec-1']);
    expect(t.server.tombstones.has('rec-1')).toBe(true);

    // Deleted on the server by someone else: the next replacement answers 410 → gone, never resurrected.
    t.server.activities.delete('rec-2');
    t.server.tombstones.add('rec-2');
    await c.cloudBackup.queue.trackCorrected({
      type: 'ActivityTrackCorrected',
      v: 1,
      at: 0,
      activityId: 'rec-2',
      activityType: 'walk',
      startedAt: T0 + DAY,
    });
    await c.cloudBackup.run.execute();
    expect(await t.db.first("SELECT status, op FROM cb_activities WHERE activity_id = 'rec-2'")).toEqual({
      status: 'gone',
      op: null,
    });
    await c.cloudBackup.queue.activityRecorded({
      type: 'ActivityRecorded',
      v: 1,
      at: 0,
      activityId: 'rec-2',
      activityType: 'walk',
      startedAt: T0 + DAY,
      endedAt: T0 + DAY,
    });
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads().filter((id) => id === 'rec-2')).toHaveLength(2); // the first upload + the one 410
  });

  it('replaces a corrected track with If-Match; on 412 re-reads the version and retries once', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0, 10)); // a 10-minute GPS gap inside one segment
    await enable(c);
    expect(t.server.activities.get('rec-1')!.version).toBe(1);

    // Someone else changed it on the server meanwhile (version 2): our If-Match "v1" is stale.
    t.server.activities.set('rec-1', { ...t.server.activities.get('rec-1')!, version: 2 });
    await c.activityLog.splitTrackGaps.execute(); // corrects the track → ActivityTrackCorrected
    await c.dispatcher.dispatchPending();
    await c.backUp();

    const puts = t.server.requests.filter((r) => r.method === 'putActivity');
    expect(puts.map((r) => r.ifMatch)).toEqual([null, 1, 2]);
    expect(t.server.requests.some((r) => r.method === 'activityVersion')).toBe(true);
    expect(t.server.activities.get('rec-1')!.version).toBe(3);
    expect(
      await t.db.first("SELECT status, op, server_version AS v FROM cb_activities WHERE activity_id = 'rec-1'")
    ).toEqual({
      status: 'backed-up',
      op: null,
      v: 3,
    });
  });

  it('sends gap routes after the activity, when they are estimated', async () => {
    const t = setup();
    const c = await t.container();
    await enable(c);
    await c.add('rec-1', walk(0));
    await c.backUp();
    const coords: [number, number][] = [
      [21.01, 52.25],
      [21.02, 52.26],
    ];
    await new SqliteActivityRepository(t.db).saveGapRoutes(
      'rec-1',
      [{ afterSegment: 0, distanceM: 300, movingS: 200, coords }],
      T0 + 5
    );
    await c.dispatcher.dispatchPending();
    await c.backUp();
    expect(t.server.activities.get('rec-1')!.gapRoutes).toEqual({ checkedAt: T0 + 5, count: 1 });
    expect(
      await t.db.first("SELECT gaps_pending AS g, server_version AS v FROM cb_activities WHERE activity_id = 'rec-1'")
    ).toEqual({ g: 0, v: 2 });
  });

  it('sends the Home City with when it was chosen', async () => {
    const t = setup();
    const c = await t.container();
    await c.territory.chooseHomeCity.execute('pl-gdansk'); // before backup: sent with the first upload
    await c.dispatcher.dispatchPending();
    await enable(c);
    expect(t.server.homeCity).toEqual({ cityId: 'pl-gdansk', chosenAt: expect.any(Number) });

    t.advance(60_000);
    await c.territory.chooseHomeCity.execute(null);
    await c.dispatcher.dispatchPending();
    await c.backUp();
    expect(t.server.homeCity).toMatchObject({ cityId: null });
  });
});

describe('Cloud Backup: errors', () => {
  it('401: stops, says so, and waits for a new token', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    t.server.validToken = 'rotated';
    expect(await c.cloudBackup.run.execute()).toMatchObject({ report: { error: 'auth' } });
    expect((await c.cloudBackup.status.execute()).lastError).toBe('auth');
    const calls = t.server.requests.length;
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'waiting-for-token' });
    expect(t.server.requests).toHaveLength(calls);

    await c.cloudBackup.saveToken.execute('rotated');
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toContain('rec-1');
    expect((await c.cloudBackup.status.execute()).lastError).toBeNull();
  });

  it('403: no consent on the server: stops and says so', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.cloudBackup.enable.execute();
    t.server.consents.clear();
    expect(await c.cloudBackup.run.execute()).toMatchObject({ report: { error: 'consent' } });
    expect((await c.cloudBackup.status.execute()).lastError).toBe('consent');
  });

  it('413 and 422: marked as refused, not retried; the rest still goes up', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-big', walk(0));
    await c.add('rec-bad', walk(1));
    await c.add('rec-ok', walk(2));
    await c.cloudBackup.enable.execute();
    t.server.failNext('putActivity', { kind: 'too-large' });
    t.server.failNext('putActivity', { kind: 'rejected', code: 'activity.track-too-short' });
    expect(await c.cloudBackup.run.execute()).toMatchObject({ report: { uploaded: 1, refused: 2, error: null } });
    expect(
      await t.db.all('SELECT activity_id AS id, status, error_code AS code FROM cb_activities ORDER BY started_at')
    ).toEqual([
      { id: 'rec-big', status: 'too-large', code: 'payload-too-large' },
      { id: 'rec-bad', status: 'rejected', code: 'activity.track-too-short' },
      { id: 'rec-ok', status: 'backed-up', code: null },
    ]);
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toHaveLength(3);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 3, refused: 2 });
  });

  it('server errors back off per activity; "Back up now" retries at once', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.cloudBackup.enable.execute();
    t.server.failNext('putActivity', { kind: 'unavailable', reason: 'server' });
    expect(await c.cloudBackup.run.execute()).toMatchObject({ report: { failed: 1, error: 'server' } });
    await c.cloudBackup.run.execute(); // still backing off: nothing sent
    expect(t.server.uploads()).toEqual(['rec-1']);
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toEqual(['rec-1', 'rec-1']);
    expect(t.server.activities.has('rec-1')).toBe(true);
  });

  it('501 (server not ready yet): stops quietly and keeps everything queued', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.cloudBackup.enable.execute();
    t.server.failNext('changes', { kind: 'unavailable', reason: 'not-ready' });
    expect(await c.cloudBackup.run.execute()).toMatchObject({ report: { error: 'not-ready' } });
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toEqual(['rec-1']);
  });
});

describe('Cloud Backup: Apple Health and turning off', () => {
  it('uploads Apple Health imports only after their own consent, with source apple-health', async () => {
    const t = setup();
    const c = await t.container();
    await c.add('hk-1', walk(0));
    await c.add('rec-1', walk(1));
    await enable(c);
    expect(t.server.uploads()).toEqual(['rec-1']);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ healthIncluded: false, backedUp: 1, total: 1 });

    expect(await c.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'ok' });
    expect(t.server.consentLog.at(-1)).toEqual({
      purpose: 'apple-health-in-cloud-sync',
      granted: true,
      policyVersion: '2026-10',
    });
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toEqual(['rec-1', 'hk-1']);
    expect(t.server.activities.get('hk-1')!.source).toBe('apple-health');

    // Off again: new imports stay on the phone.
    expect(await c.cloudBackup.includeHealth.execute(false)).toEqual({ kind: 'ok' });
    await c.add('hk-2', walk(2));
    await c.backUp();
    expect(t.server.uploads()).not.toContain('hk-2');
  });

  it('off: stops at once and withdraws both consents; offline, the withdrawal is delivered later', async () => {
    const t = setup();
    const c = await t.container();
    await enable(c);
    t.server.failNext('setConsent', { kind: 'offline' }, 2);
    expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'failed', error: 'offline' });
    expect((await c.cloudBackup.status.execute()).enabled).toBe(false);

    await c.add('rec-1', walk(0));
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'off' });
    expect(t.server.uploads()).toEqual([]);
    expect(t.server.consents.get('cloud-sync')).toMatchObject({ granted: false });
    expect(t.server.consents.get('apple-health-in-cloud-sync')).toMatchObject({ granted: false });
    expect(await t.db.first('SELECT withdrawals_pending AS w FROM cb_state')).toEqual({ w: null });
  });

  it('keeps the token while backup is on; a testing server URL is validated and used', async () => {
    const t = setup();
    const c = await t.container();
    await expect(c.cloudBackup.useServer.execute('not a url')).rejects.toMatchObject({
      code: 'backup.invalid-server-url',
    });
    await c.cloudBackup.useServer.execute('http://192.168.1.20:8787/');
    expect(await c.cloudBackup.status.execute()).toMatchObject({
      serverUrl: 'http://192.168.1.20:8787',
      serverUrlOverridden: true,
    });
    await enable(c);
    expect(t.server.requests.every((r) => r.baseUrl === 'http://192.168.1.20:8787')).toBe(true);
    await expect(c.cloudBackup.removeToken.execute()).rejects.toMatchObject({ code: 'backup.on' });
    await c.cloudBackup.disable.execute();
    await c.cloudBackup.removeToken.execute();
    expect(t.tokens.token).toBeNull();
    await c.cloudBackup.useServer.execute(null);
    expect((await c.cloudBackup.status.execute()).serverUrlOverridden).toBe(false);
  });
});
