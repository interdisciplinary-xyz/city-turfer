import { createIdentityApi } from '@/contexts/identity';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/mock-auth-gateway';
import type { Fix } from '@/contexts/recording/domain/fix';
import {
  type BatchContainer,
  createLocationBatchHandler,
} from '@/contexts/recording/infrastructure/location-batch-handler';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const fix = (i: number): Fix => ({
  lat: 52.2 + (i * 5) / 111_195,
  lon: 21,
  t: T0 + i * 1000,
  accuracy: 5,
  alt: null,
  speed: null,
});
const fixes = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => fix(from + k));

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  let running = false;
  let n = 0;
  const now = T0 + 3_600_000;
  const tracker = {
    start: async () => void (running = true),
    stop: async () => void (running = false),
    isRunning: async () => running,
    reacquire: async () => null,
  };
  const c = wire('test', db, {
    tracker,
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => ({ distanceM: 0, coords: [] }) },
    ids: { next: () => `id-${++n}` },
    clock: { now: () => now },
  });
  const diagnostics = async () =>
    (await db.all<{ kind: string; data: string }>('SELECT kind, data FROM sys_diagnostics ORDER BY id')).map((r) => ({
      kind: r.kind,
      ...(JSON.parse(r.data) as Record<string, unknown>),
    }));
  return { c, db, tracker, isRunning: () => running, diagnostics };
}

/** The task's handler wired like background-task.ts, with a scriptable container lookup. */
function handlerFor(lookup: () => Promise<BatchContainer | null>, timeoutMs = 1000) {
  const stopTracking = jest.fn(async () => undefined);
  const handle = createLocationBatchHandler<Fix>({
    getContainer: lookup,
    stopTracking,
    toFix: (f) => f,
    describe: (source, l) => ({ source, received: l.length }),
    timeoutMs,
    warn: () => undefined,
  });
  return { handle, stopTracking };
}

const flush = () => new Promise((r) => setTimeout(r, 5)); // diagnostics are written fire-and-forget

describe('background batches: headless container resilience', () => {
  it('a keychain read error skips the batch but keeps the session recording and the tracker running', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    let fail = true;
    const { handle, stopTracking } = handlerFor(async () => {
      if (fail) {
        throw new Error('errSecInteractionNotAllowed');
      }
      return t.c;
    });

    await expect(handle('task', fixes(0, 5))).resolves.toBeUndefined(); // never throws
    expect(stopTracking).not.toHaveBeenCalled();
    expect(t.isRunning()).toBe(true);
    expect((await t.c.recording.liveSnapshot.execute())?.status).toBe('recording');

    fail = false;
    await handle('task', fixes(5, 10));
    await flush();
    expect((await t.c.recording.liveSnapshot.execute())?.pointCount).toBe(5);
    const logged = await t.diagnostics();
    // The skipped batch is reported once a container is available again, without coordinates.
    expect(logged[0]).toEqual(
      expect.objectContaining({ kind: 'task-error', code: 'session-read-task', skippedFixes: 5 })
    );
    expect(logged[1]).toEqual(expect.objectContaining({ kind: 'batch', accepted: 5, status: 'recording' }));
    expect(JSON.stringify(logged)).not.toMatch(/52\.2|"lat"|"lon"/);
  });

  it('nobody signed in stops the orphaned tracker', async () => {
    const { handle, stopTracking } = handlerFor(async () => null);
    await handle('live', fixes(0, 3));
    expect(stopTracking).toHaveBeenCalledTimes(1);
  });

  it('a hung container lookup times out and does not stall later batches', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    let calls = 0;
    let release: (c: BatchContainer) => void = () => undefined;
    const { handle } = handlerFor(() => {
      calls++;
      return calls === 1 ? new Promise<BatchContainer>((r) => (release = r)) : Promise.resolve(t.c);
    }, 20);

    const hung = handle('task', fixes(0, 5));
    const next = handle('task', fixes(5, 10));
    await Promise.all([hung, next]);
    expect((await t.c.recording.liveSnapshot.execute())?.pointCount).toBe(5); // only the second batch

    release(t.c); // the lookup finally resolves: the expired batch must not be ingested out of order
    await flush();
    expect((await t.c.recording.liveSnapshot.execute())?.pointCount).toBe(5);
    expect(await t.diagnostics()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'task-error', code: 'container-timeout-task' })])
    );
  });

  it('a hung ingest times out and is logged; the handler returns', async () => {
    const logs: { kind: string; data: Record<string, unknown> }[] = [];
    const hungContainer: BatchContainer = {
      recording: { ingestFixes: { execute: () => new Promise(() => undefined) } },
      diagnostics: { log: (kind, data) => void logs.push({ kind, data }) },
    };
    const { handle } = handlerFor(async () => hungContainer, 20);
    await handle('live', fixes(0, 3));
    expect(logs).toEqual([{ kind: 'task-error', data: expect.objectContaining({ code: 'ingest-timeout-live' }) }]);
  });

  it('keeps delivery order even when container lookups resolve out of order', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    let calls = 0;
    const { handle } = handlerFor(
      () => new Promise((r) => setTimeout(() => r(t.c), ++calls === 1 ? 15 : 0)) // first lookup is slower
    );
    await Promise.all([handle('task', fixes(0, 5)), handle('live', fixes(5, 10))]);
    expect((await t.c.recording.liveSnapshot.execute())?.pointCount).toBe(10); // nothing dropped as out-of-order
  });
});

describe('sign-out is gated on the active Recording Session', () => {
  function identityFor(c: ReturnType<typeof wire>) {
    let id: string | null = 'admin';
    const sessions = {
      read: async () => id as never,
      write: async (v: string) => void (id = v),
      clear: async () => void (id = null),
    };
    return createIdentityApi({ auth: new MockAuthGateway(), sessions }, () => c.hasActiveSession());
  }

  it('refuses while a session is paused even though the OS tracker is not running', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    await t.c.recording.pause.execute();
    await t.tracker.stop(); // e.g. the OS killed location updates
    expect(await identityFor(t.c).signOut.execute()).toEqual({ kind: 'recording-in-progress' });
  });

  it('allows sign-out with an orphaned tracker but no active session', async () => {
    const t = await setup();
    await t.tracker.start();
    expect(await identityFor(t.c).signOut.execute()).toEqual({ kind: 'signed-out' });
  });

  it('allows sign-out once the session is discarded', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    const identity = identityFor(t.c);
    expect((await identity.signOut.execute()).kind).toBe('recording-in-progress');
    await t.c.recording.discard.execute();
    expect((await identity.signOut.execute()).kind).toBe('signed-out');
  });
});

describe('launch maintenance', () => {
  it('runLaunchMaintenance runs the repair jobs and delivers pending outbox events', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    await t.c.recording.ingestFixes.execute(fixes(0, 10));
    const finished = await t.c.recording.finish.execute();
    if (finished.kind !== 'finished') {
      throw new Error(finished.kind);
    }
    await t.c.runLaunchMaintenance();
    expect(await t.db.first('SELECT 1 AS x FROM sys_outbox WHERE processed_at IS NULL')).toBeNull();
    expect(await t.c.activityLog.detail.execute(finished.sessionId)).not.toBeNull();
    expect(await t.db.first("SELECT 1 AS x FROM sys_jobs WHERE name = 'split-track-gaps-v1'")).not.toBeNull();
  });
});
