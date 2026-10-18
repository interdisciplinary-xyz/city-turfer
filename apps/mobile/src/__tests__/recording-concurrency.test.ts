import type { Fix } from '@/contexts/recording/domain/fix';
import type { Database } from '@/platform/database';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

/**
 * A background IngestFixes batch that overlaps a user command (Finish, Pause,
 * Discard) must never overwrite the command's outcome: every Recording command
 * runs through one serial executor per container.
 */

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

/** Wraps a Database so the next transaction is held back for a while (a slow background ingest). */
function slowable(db: Database) {
  let delayNextTxMs = 0;
  const wrapped: Database = {
    run: (sql, p) => db.run(sql, p),
    all: (sql, p) => db.all(sql, p),
    first: (sql, p) => db.first(sql, p),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
    transaction: async (work) => {
      const ms = delayNextTxMs;
      delayNextTxMs = 0;
      if (ms) {
        await new Promise((r) => setTimeout(r, ms));
      }
      return db.transaction(work);
    },
  };
  return { db: wrapped, delayNextTransaction: (ms: number) => void (delayNextTxMs = ms) };
}

async function setup() {
  const raw = openNodeDatabase();
  await migrate(raw);
  const { db, delayNextTransaction } = slowable(raw);
  let running = false;
  let now = T0;
  let n = 0;
  const tracker = {
    starts: 0,
    start: async () => {
      tracker.starts++;
      running = true;
    },
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
  const status = async (id: string) =>
    (await raw.first<{ status: string }>('SELECT status FROM rec_sessions WHERE id = ?', [id]))?.status;
  return { c, raw, tracker, status, delayNextTransaction, advance: (ms: number) => void (now += ms) };
}

describe('Recording commands are serialized per container', () => {
  it('a deferred ingest overlapping Finish cannot revive the session; the activity is recorded', async () => {
    const t = await setup();
    const started = await t.c.recording.start.execute('run');
    if (started.kind !== 'started') {
      throw new Error(started.kind);
    }
    const id = started.snapshot.sessionId;
    await t.c.recording.ingestFixes.execute(fixes(0, 10));
    t.advance(20_000);

    t.delayNextTransaction(30); // the background batch commits late
    const ingest = t.c.recording.ingestFixes.execute(fixes(10, 15));
    const finish = t.c.recording.finish.execute();
    const [ingested, finished] = await Promise.all([ingest, finish]);

    expect(ingested.kind).toBe('ingested'); // queued first, so it ran first
    expect(finished).toEqual({ kind: 'finished', sessionId: id });
    expect(await t.status(id)).toBe('finished');
    expect(await t.c.recording.liveSnapshot.execute()).toBeNull();

    await t.c.dispatcher.dispatchPending();
    const detail = await t.c.activityLog.detail.execute(id);
    expect(detail).not.toBeNull();
    expect(detail!.distanceM).toBeCloseTo(70, 0); // both batches: 15 points 5 m apart

    // App relaunch: nothing to recover, GPS stays off.
    const starts = t.tracker.starts;
    expect(await t.c.recording.recover.execute()).toEqual({ kind: 'nothing' });
    expect(t.tracker.starts).toBe(starts);
    expect(await t.tracker.isRunning()).toBe(false);
  });

  it('a late ingest after Finish finds no active session and stops the orphaned tracker', async () => {
    const t = await setup();
    const started = await t.c.recording.start.execute('run');
    if (started.kind !== 'started') {
      throw new Error(started.kind);
    }
    await t.c.recording.ingestFixes.execute(fixes(0, 10));

    const finish = t.c.recording.finish.execute();
    await t.tracker.start(); // the OS still delivers locations to a running task
    const late = t.c.recording.ingestFixes.execute(fixes(10, 15));
    expect((await finish).kind).toBe('finished');
    expect((await late).kind).toBe('no-active-session');
    expect(await t.status(started.snapshot.sessionId)).toBe('finished');
    expect(await t.tracker.isRunning()).toBe(false);
  });

  it('a deferred ingest overlapping Pause leaves the session paused', async () => {
    const t = await setup();
    const started = await t.c.recording.start.execute('run');
    if (started.kind !== 'started') {
      throw new Error(started.kind);
    }
    await t.c.recording.ingestFixes.execute(fixes(0, 5));

    t.delayNextTransaction(30);
    const ingest = t.c.recording.ingestFixes.execute(fixes(5, 10));
    const pause = t.c.recording.pause.execute();
    const [, paused] = await Promise.all([ingest, pause]);

    expect(paused?.status).toBe('paused');
    expect(paused?.pointCount).toBe(10);
    expect(await t.status(started.snapshot.sessionId)).toBe('paused');
    expect((await t.c.recording.liveSnapshot.execute())?.status).toBe('paused');
  });

  it('a deferred ingest overlapping Discard leaves the session discarded with no points', async () => {
    const t = await setup();
    const started = await t.c.recording.start.execute('run');
    if (started.kind !== 'started') {
      throw new Error(started.kind);
    }
    const id = started.snapshot.sessionId;
    await t.c.recording.ingestFixes.execute(fixes(0, 5));

    t.delayNextTransaction(30);
    const ingest = t.c.recording.ingestFixes.execute(fixes(5, 10));
    const discard = t.c.recording.discard.execute();
    await Promise.all([ingest, discard]);

    expect(await t.status(id)).toBe('discarded');
    expect(await t.raw.first('SELECT 1 AS x FROM rec_track_points WHERE session_id = ?', [id])).toBeNull();
    expect(await t.c.recording.liveSnapshot.execute()).toBeNull();
    expect(await t.tracker.isRunning()).toBe(false);
    await t.c.dispatcher.dispatchPending();
    expect(await t.c.activityLog.detail.execute(id)).toBeNull();
  });

  it('a failing command does not block the commands queued behind it', async () => {
    const t = await setup();
    await t.c.recording.start.execute('run');
    const tooShort = t.c.recording.finish.execute(); // no points yet
    const discard = t.c.recording.discard.execute();
    expect(await tooShort).toEqual({ kind: 'too-short' });
    await discard;
    expect(await t.c.recording.liveSnapshot.execute()).toBeNull();
  });
});
