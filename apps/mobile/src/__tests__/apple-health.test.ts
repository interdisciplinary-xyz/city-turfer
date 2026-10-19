/**
 * Apple Health end to end through the real wiring and SQL: import → Activities → turf, no duplicates,
 * deleted imports stay deleted, recordings are exported once, imports and our own workouts are not.
 */
import { IMPORT_PAGE_SIZE } from '@/contexts/health-sync/application/use-cases';
import { FakeHealthStore, straightRoute } from '@/contexts/health-sync/test-support/fake-health-store';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

const T0 = Date.parse('2026-10-01T07:00:00Z');
const DAY = 86_400_000;

function setup() {
  const db = openNodeDatabase();
  const health = new FakeHealthStore();
  let now = Date.parse('2026-10-18T12:00:00Z');
  let n = 0;
  let running = false;
  const app = { foreground: true };
  const adapters = {
    tracker: {
      start: async () => void (running = true),
      stop: async () => void (running = false),
      isRunning: async () => running,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => `session-${++n}` },
    clock: { now: () => now },
    health,
    isForeground: () => app.foreground,
  };
  return {
    db,
    health,
    app,
    advance: (ms: number) => void (now += ms),
    now: () => now,
    async container() {
      await migrate(db);
      return wire('test', db, adapters);
    },
  };
}

const walk = (day: number) => straightRoute({ lat: 52.25 + day * 0.001, lon: 21.01, t: T0 + day * DAY }, 20);

const activityIds = async (c: Awaited<ReturnType<ReturnType<typeof setup>['container']>>) =>
  (await c.activityLog.list.execute(100)).map((a) => a.id).sort();

describe('Apple Health import', () => {
  it('does nothing until connected', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1' }, walk(0));
    expect(await c.syncHealth()).toBeNull();
    expect(await activityIds(c)).toEqual([]);
  });

  it('imports walks, runs and rides with routes as Activities that claim turf', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1', kind: 'walking' }, walk(0));
    t.health.add({ uuid: 'r1', kind: 'running' }, straightRoute({ lat: 52.3, lon: 21.0, t: T0 + DAY }, 20, 3));
    t.health.add({ uuid: 'c1', kind: 'cycling' }, straightRoute({ lat: 52.2, lon: 21.1, t: T0 + 2 * DAY }, 20, 6));
    t.health.add({ uuid: 'h1', kind: 'hiking' }, walk(3));
    t.health.add({ uuid: 'treadmill', kind: 'running' }, []);
    t.health.add({ uuid: 'yoga', kind: 'other' }, []);

    await c.healthSync.connect.execute();
    expect(t.health.accessRequests).toBe(1);
    const report = await c.syncHealth();
    expect(report).toMatchObject({ imported: 4, withoutRoute: 1, skipped: 1 });
    await c.dispatcher.dispatchPending();

    expect(await activityIds(c)).toEqual(['hk-c1', 'hk-h1', 'hk-r1', 'hk-w1']);
    const types = Object.fromEntries((await c.activityLog.list.execute(100)).map((a) => [a.id, a.type]));
    expect(types).toEqual({ 'hk-w1': 'walk', 'hk-h1': 'walk', 'hk-r1': 'run', 'hk-c1': 'cycle' });
    expect((await c.territory.summary.execute()).cellCount).toBeGreaterThan(0);
    expect((await c.healthSync.status.execute()).lastImport).toMatchObject({ imported: 4 });
  });

  it('continues where it stopped: a second import only brings new workouts', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1' }, walk(0));
    await c.healthSync.connect.execute();
    expect(await c.syncHealth()).toMatchObject({ imported: 1 });

    t.health.add({ uuid: 'w2' }, walk(1));
    expect(await c.syncHealth()).toMatchObject({ imported: 1, skipped: 0 });
    expect(await activityIds(c)).toEqual(['hk-w1', 'hk-w2']);
  });

  it('pages through a long history', async () => {
    const t = setup();
    const c = await t.container();
    const total = IMPORT_PAGE_SIZE * 2 + 3;
    for (let i = 0; i < total; i++) {
      t.health.add({ uuid: `w${i}` }, straightRoute({ lat: 52.25, lon: 21.01, t: T0 - i * DAY }, 3));
    }
    await c.healthSync.connect.execute();
    expect(await c.syncHealth()).toMatchObject({ imported: total });
    expect((await activityIds(c)).length).toBe(total);
  });

  it('never imports a workout twice, nor one the user deleted', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1' }, walk(0));
    await c.healthSync.connect.execute();
    await c.syncHealth();
    await c.dispatcher.dispatchPending();
    await c.activityLog.remove.execute('hk-w1');
    await c.dispatcher.dispatchPending();

    // Apple Health starts over (e.g. the anchor was lost): the link still remembers the workout.
    await c.healthSync.disconnect.execute();
    await c.healthSync.connect.execute();
    await t.db.run('UPDATE hs_state SET anchor = NULL');
    expect(await c.syncHealth()).toMatchObject({ imported: 0, skipped: 1 });
    expect(await activityIds(c)).toEqual([]);
  });

  it('retries a workout whose route arrives later (Apple Watch still syncing)', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    const recent = straightRoute({ lat: 52.25, lon: 21.01, t: t.now() - 3_600_000 }, 20);
    t.health.add({ uuid: 'late', startedAt: recent[0].t, endedAt: recent[recent.length - 1].t }, []);
    expect(await c.syncHealth()).toMatchObject({ imported: 0, withoutRoute: 1 });

    t.health.setRoute('late', recent);
    expect(await c.syncHealth()).toMatchObject({ imported: 1 });
    expect(await activityIds(c)).toEqual(['hk-late']);
    expect(await t.db.all('SELECT * FROM hs_pending_imports')).toEqual([]);
  });

  it('gives up on a route-less workout once it is a few days old', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.health.add(
      { uuid: 'treadmill', kind: 'running', startedAt: t.now() - 7_200_000, endedAt: t.now() - 3_600_000 },
      []
    );
    await c.syncHealth();
    expect(await t.db.all('SELECT health_uuid FROM hs_pending_imports')).toEqual([{ health_uuid: 'treadmill' }]);
    t.advance(4 * DAY);
    await c.syncHealth();
    expect(await t.db.all('SELECT * FROM hs_pending_imports')).toEqual([]);
  });

  it('skips an outing that is already in CityTurfer from another source', async () => {
    const t = setup();
    const c = await t.container();
    const route = walk(0);
    t.health.add({ uuid: 'watch', kind: 'walking' }, route);
    t.health.add({ uuid: 'other-app', kind: 'walking', startedAt: route[0].t + 60_000 }, route.slice(12));
    await c.healthSync.connect.execute();
    expect(await c.syncHealth()).toMatchObject({ imported: 1, duplicates: 1 });
    expect(await activityIds(c)).toEqual(['hk-watch']);
  });

  it('a full scan (Import now) finds workouts behind the anchor', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.health.add({ uuid: 'old-no-route' }, []);
    await c.syncHealth(); // not recent: no retry, anchor moves past it
    t.health.setRoute('old-no-route', walk(0));
    expect(await c.syncHealth()).toMatchObject({ imported: 0 });
    expect(await c.healthSync.importWorkouts.execute({ full: true })).toMatchObject({ imported: 1 });
  });

  it('stops importing when disconnected or sent to the background', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1' }, walk(0));
    await c.healthSync.connect.execute();
    t.app.foreground = false;
    expect(await c.syncHealth()).toBeNull();
    t.app.foreground = true;
    await c.healthSync.disconnect.execute();
    expect(await c.syncHealth()).toBeNull();
    expect(await activityIds(c)).toEqual([]);
  });

  it('respects the import switch', async () => {
    const t = setup();
    const c = await t.container();
    t.health.add({ uuid: 'w1' }, walk(0));
    await c.healthSync.connect.execute();
    await c.healthSync.setDirections.execute({ importEnabled: false });
    expect(await c.syncHealth()).toBeNull();
    expect(await activityIds(c)).toEqual([]);
  });

  it('is not available without Apple Health', async () => {
    const t = setup();
    t.health.available = false;
    const c = await t.container();
    await expect(c.healthSync.connect.execute()).rejects.toThrow('health.unavailable');
    expect((await c.healthSync.status.execute()).available).toBe(false);
  });
});

describe('Apple Health export', () => {
  async function record(t: ReturnType<typeof setup>, c: Awaited<ReturnType<ReturnType<typeof setup>['container']>>) {
    expect((await c.recording.start.execute('walk')).kind).toBe('started');
    const start = t.now();
    const fixes = straightRoute({ lat: 52.25, lon: 21.01, t: start }, 5, 1.4, 2).map((p) => ({
      lat: p.lat,
      lon: p.lon,
      t: p.t,
      alt: p.alt,
      accuracy: p.accuracy,
      speed: p.speed,
      heading: null,
    }));
    await c.recording.ingestFixes.execute(fixes);
    t.advance(5 * 60_000);
    await c.recording.finish.execute();
    await c.dispatcher.dispatchPending();
    await c.dispatcher.dispatchPending();
  }

  it('saves a new recording to Apple Health once, with its route', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.advance(1000);
    await record(t, c);

    expect(t.health.saved).toHaveLength(1);
    const [w] = t.health.saved;
    expect(w.kind).toBe('walking');
    expect(w.route.length).toBeGreaterThan(10);
    expect(w.distanceM).toBeGreaterThan(300);

    // Replayed event: no second workout. And the next import skips our own workout.
    await c.healthSync.exportActivity.execute({ activityId: w.activityId, at: t.now(), origin: 'recording' });
    expect(t.health.saved).toHaveLength(1);
    expect(await c.syncHealth()).toMatchObject({ imported: 0, skipped: 1, duplicates: 0 });
  });

  it('does not export imports, or anything when the switch is off or not connected', async () => {
    const t = setup();
    const c = await t.container();
    await record(t, c); // not connected yet
    expect(t.health.saved).toHaveLength(0);

    t.health.add({ uuid: 'w1' }, walk(0));
    await c.healthSync.connect.execute();
    await c.syncHealth();
    await c.dispatcher.dispatchPending();
    expect(t.health.saved).toHaveLength(0); // imported workouts go nowhere

    await c.healthSync.setDirections.execute({ exportEnabled: false });
    t.advance(1000);
    await record(t, c);
    expect(t.health.saved).toHaveLength(0);
  });

  it('a failed save does not hold up turf and is retried on the next sync', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.health.failSaves = true;
    t.advance(1000);
    await record(t, c);
    expect(t.health.saved).toHaveLength(0);
    expect((await c.territory.summary.execute()).cellCount).toBeGreaterThan(0);
    const errors = await t.db.all<{ data: string }>("SELECT data FROM sys_diagnostics WHERE kind = 'task-error'");
    expect(errors.map((e) => JSON.parse(e.data).code)).toContain('health.export-failed');
    const pending = await t.db.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sys_outbox WHERE processed_at IS NULL AND dead_lettered_at IS NULL'
    );
    expect(pending!.n).toBe(0);

    t.health.failSaves = false;
    await c.syncHealth();
    expect(t.health.saved).toHaveLength(1);
    expect(await t.db.all('SELECT * FROM hs_pending_exports')).toEqual([]);
  });

  it('gives up after repeated failures', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.health.failSaves = true;
    t.advance(1000);
    await record(t, c);
    for (let i = 0; i < 6; i++) {
      await c.syncHealth();
    }
    expect(await t.db.all('SELECT * FROM hs_pending_exports')).toEqual([]);
  });

  it('waits for the foreground: a recording finished headless is saved when the app opens', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.app.foreground = false;
    t.advance(1000);
    await record(t, c);
    expect(t.health.saved).toHaveLength(0);
    t.app.foreground = true;
    await c.syncHealth();
    expect(t.health.saved).toHaveLength(1);
  });

  it('never writes a second workout when the app died before storing the link', async () => {
    const t = setup();
    const c = await t.container();
    await c.healthSync.connect.execute();
    t.app.foreground = false;
    t.advance(1000);
    await record(t, c);
    const [{ activity_id: id }] = await t.db.all<{ activity_id: string }>('SELECT activity_id FROM hs_pending_exports');
    // The save reached Apple Health, then the app was killed before the link was written.
    await t.health.saveWorkout({ activityId: id, kind: 'walking', startedAt: 1, endedAt: 2, distanceM: 1, route: [] });
    t.app.foreground = true;
    await c.syncHealth();
    expect(t.health.saved).toHaveLength(1);
    expect(await t.db.all('SELECT direction FROM hs_links')).toEqual([{ direction: 'export' }]);
  });
});
