import type { Fix } from '@/contexts/recording/domain/fix';
import type { Database, SqlExecutor } from '@/platform/database';
import { migrate } from '@/platform/migrations';
import { loadFixes } from '@/test-support/fixtures';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

const DAY = 86_400_000;

function fakes() {
  let running = false;
  let n = 0;
  let now = Date.parse('2026-01-01T07:00:00Z');
  return {
    tracker: {
      start: async () => void (running = true),
      stop: async () => void (running = false),
      isRunning: async () => running,
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
    clock: { now: () => now },
    advance: (ms: number) => void (now += ms),
  };
}

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  const f = fakes();
  return { c: wire('test', db, f), f, db };
}

async function recordFixture(c: ReturnType<typeof wire>, fixes: Fix[], type: 'walk' | 'run' | 'cycle' = 'run') {
  expect((await c.recording.start.execute(type)).kind).toBe('started');
  for (let i = 0; i < fixes.length; i += 25) {
    await c.recording.ingestFixes.execute(fixes.slice(i, i + 25));
  }
  const finished = await c.recording.finish.execute();
  expect(finished.kind).toBe('finished');
  await c.dispatcher.dispatchPending();
  return (finished as { sessionId: string }).sessionId;
}

const sessionRow = (db: Database, id: string) =>
  db.first<{ status: string; state: string }>('SELECT status, state FROM rec_sessions WHERE id = ?', [id]);
const pointCount = async (db: Database, id: string) =>
  (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM rec_track_points WHERE session_id = ?', [id]))!.n;
const flushDiagnostics = () => new Promise((r) => setImmediate(r)); // Diagnostics.log is fire-and-forget

describe('Outbox: a poisoned event does not block later ones', () => {
  it('dead-letters an import with a skewed clock and still records the next session', async () => {
    const { c, f, db } = await setup();
    // An imported track dated two days ahead: Claim.fromTrack throws claim.in-future, every time.
    const walk = loadFixes('walk-2k.gpx');
    const shift = f.clock.now() + 2 * DAY - walk[0].t;
    const future = walk.map((x) => ({ ...x, t: x.t + shift, segment: 0 }));
    expect(await c.activityLog.importActivity.execute({ id: 'skewed', type: 'walk', points: future })).toBe(true);
    await c.dispatcher.dispatchPending();

    const id = await recordFixture(c, loadFixes('run-5k-outliers-pause.gpx'));
    expect(await c.activityLog.detail.execute(id)).not.toBeNull(); // not "Saving your activity…" forever
    expect(await c.territory.claimOf.execute(id)).not.toBeNull();
    expect(await c.territory.claimOf.execute('skewed')).toBeNull();
    expect(await pointCount(db, id)).toBe(0); // the rest of the chain ran too

    const dead = await db.all<{ type: string; attempts: number }>(
      'SELECT type, attempts FROM sys_outbox WHERE dead_lettered_at IS NOT NULL'
    );
    expect(dead).toEqual([{ type: 'ActivityRecorded', attempts: 1 }]);

    await flushDiagnostics();
    const diag = await db.all<{ data: string }>("SELECT data FROM sys_diagnostics WHERE kind = 'task-error'");
    expect(diag).toHaveLength(1);
    expect(JSON.parse(diag[0].data)).toMatchObject({
      code: 'outbox.dead-letter',
      type: 'ActivityRecorded',
      attempts: 1,
      errorCode: 'claim.in-future',
    });
    expect(diag[0].data).not.toMatch(/lat|lon|\d+\.\d{3,}/);
  });
});

describe('Retention of recording data', () => {
  it('keeps no position in a recorded session', async () => {
    const { c, db } = await setup();
    const id = await recordFixture(c, loadFixes('walk-2k.gpx'), 'walk');
    const row = (await sessionRow(db, id))!;
    expect(row.status).toBe('finished');
    expect(JSON.parse(row.state)).toMatchObject({ tail: null, recent: [] });
    expect(row.state).not.toMatch(/"lat"|"lon"/);
    expect(await pointCount(db, id)).toBe(0);
  });

  it('discards a session and its points in one transaction', async () => {
    const { c, db } = await setup();
    await c.recording.start.execute('walk');
    await c.recording.ingestFixes.execute(loadFixes('walk-2k.gpx').slice(0, 50));
    const id = (await c.recording.liveSnapshot.execute())!.sessionId;
    const before = await pointCount(db, id);
    expect(before).toBeGreaterThan(0);

    // A commit that fails after all the work ran: neither the status change nor the purge may persist.
    const failing: Database = {
      ...db,
      transaction: <T>(work: (tx: SqlExecutor) => Promise<T>) =>
        db.transaction(async (tx) => {
          await work(tx);
          throw new Error('disk full');
        }),
    };
    await expect(wire('test', failing, fakes()).recording.discard.execute()).rejects.toThrow('disk full');
    expect((await sessionRow(db, id))!.status).toBe('recording');
    expect(await pointCount(db, id)).toBe(before);

    await c.recording.discard.execute();
    const row = (await sessionRow(db, id))!;
    expect(row.status).toBe('discarded');
    expect(JSON.parse(row.state).tail).toBeNull();
    expect(await pointCount(db, id)).toBe(0);
  });

  it('scrubs positions left in sessions closed before this release, once', async () => {
    const { c, db } = await setup();
    const tail = { lat: 52.2297, lon: 21.0122, t: 1 };
    const legacy = (id: string, status: string) =>
      db.run('INSERT INTO rec_sessions (id, type, status, state, started_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)', [
        id,
        'walk',
        status,
        JSON.stringify({ id, status, tail, recent: [{ t: 1, d: 0 }] }),
      ]);
    await legacy('done', 'finished');
    await legacy('gone', 'discarded');
    await legacy('live', 'recording');
    await db.run(
      "INSERT INTO rec_track_points (session_id, seq, segment, t, lat, lon) VALUES ('gone', 0, 0, 1, 52.2, 21.0), ('live', 0, 0, 1, 52.2, 21.0)"
    );

    await c.runMaintenance();
    expect(JSON.parse((await sessionRow(db, 'done'))!.state)).toMatchObject({ tail: null, recent: [] });
    expect(JSON.parse((await sessionRow(db, 'gone'))!.state)).toMatchObject({ tail: null, recent: [] });
    expect(JSON.parse((await sessionRow(db, 'live'))!.state).tail).toEqual(tail); // an active session keeps it
    expect(await pointCount(db, 'gone')).toBe(0);
    expect(await pointCount(db, 'live')).toBe(1);
    await flushDiagnostics();
    expect(
      await db.first<{ data: string }>(
        "SELECT data FROM sys_diagnostics WHERE kind = 'maintenance' AND data LIKE '%scrub%'"
      )
    ).toMatchObject({ data: JSON.stringify({ job: 'scrub-closed-sessions-v2', scrubbed: 2 }) });
  });

  it('prunes delivered outbox events at launch after 30 days', async () => {
    const { c, f, db } = await setup();
    await recordFixture(c, loadFixes('walk-2k.gpx'), 'walk');
    const delivered = async () =>
      (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sys_outbox WHERE processed_at IS NOT NULL'))!.n;
    expect(await delivered()).toBeGreaterThan(0);
    await c.runMaintenance();
    expect(await delivered()).toBeGreaterThan(0); // recent: kept
    f.advance(31 * DAY);
    await c.runMaintenance();
    expect(await delivered()).toBe(0);
  });
});
