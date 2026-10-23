/**
 * TurfBackfill (`scripts/turf-backfill.ts` → `backfillTurf`) and the daily catch-up in the
 * retention cron: claims for activities uploaded before the server claimed turf, one locked
 * transaction per activity, idempotent, resumable, safe next to uploads, counts only.
 */
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { CompactPoint } from '../backup/model';
import type { BackupStore, UserWriter } from '../backup/ports';
import { BackupService } from '../backup/use-cases';
import { DrizzleRetentionStore } from '../db/retention';
import { findAccount } from '../db/support';
import { defaultDeps } from '../deps';
import { RetentionService } from '../privacy/retention';
import { RETENTION_CRON_PATH, TURF_CATCH_UP_ACTIVITIES } from '../routes/internal';
import { type BackfillProgress, backfillTurf } from '../territory/backfill';
import { backupApp, closeSharedDb, TEST_CRON_SECRET, TOKENS } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;
const logged: string[] = [];

beforeEach(async () => {
  logged.length = 0;
  h = await backupApp({
    log: { request: (e) => logged.push(JSON.stringify(e)), event: (e) => logged.push(JSON.stringify(e)) },
  });
});
afterAll(closeSharedDb);

const H3_ID = /8b[0-9a-f]{13}/;
const T0 = Date.parse('2026-10-19T07:12:00Z');
const iso = (t: number) => new Date(t).toISOString();

/** A made-up line near Warsaw Old Town (public landmark), `i` shifts it north. */
function line(i: number, start = T0 + i * 600_000): CompactPoint[] {
  return Array.from({ length: 30 }, (_, k) => [
    Number((21.0122 + k * 1e-4).toFixed(7)),
    Number((52.2297 + (i % 4) * 2e-4).toFixed(7)),
    start + k * 3000,
    0,
    null,
  ]);
}

const body = (points: CompactPoint[]) => ({
  type: 'walk',
  name: 'Walk',
  source: 'recording',
  startedAt: iso(points[0][2]),
  endedAt: iso(points.at(-1)![2]),
  resumedSegments: null,
  track: { points },
});

const rows = async <T>(query: SQL) => ((await h.db.execute(query)) as unknown as { rows: T[] }).rows;

const snapshot = async () =>
  rows<Record<string, unknown>>(sql`
    SELECT user_id, cell, walk, run, cycle, first_at, first_activity_id FROM turf_cells
    ORDER BY user_id COLLATE "C", cell COLLATE "C"`);

async function uploads(token: string, n: number, from = 0) {
  await h.call('PUT', '/v1/me/consents/cloud-sync', { token, body: { granted: true, policyVersion: '2026-10' } });
  for (let i = from; i < from + n; i++) {
    const res = await h.call('PUT', `/v1/activities/a${i}`, { token, body: body(line(i)) });
    expect(res.status).toBe(201);
  }
}

/** The state before server turf: activities stored, no claim and no Turf Cell. */
async function forgetTurf() {
  await h.db.execute(sql`DELETE FROM turf_claims`);
  await h.db.execute(sql`DELETE FROM turf_cells`);
}

const service = () => new BackupService(h.store, h.clock, h.grid);
const run = (options: Parameters<typeof backfillTurf>[1] = {}, progress: BackfillProgress[] = []) =>
  backfillTurf({ store: h.store, backup: service(), onProgress: (p) => progress.push(p) }, options);

describe('turf backfill', () => {
  it('claims every unclaimed activity, gives the projection the uploads gave, and a second run claims 0', async () => {
    await uploads(TOKENS.admin, 5);
    await uploads(TOKENS.other, 3);
    const live = await snapshot();
    await forgetTurf();

    const dry = await run({ dryRun: true });
    expect(dry).toMatchObject({ users: 2, pending: 8, claimed: 0, remaining: 8, stopped: 'dry-run' });
    expect(await snapshot()).toEqual([]);

    const progress: BackfillProgress[] = [];
    expect(await run({}, progress)).toEqual({
      users: 2,
      pending: 8,
      claimed: 8,
      deferred: 0,
      skipped: 0,
      failed: 0,
      remaining: 0,
      stopped: 'done',
    });
    expect(await snapshot()).toEqual(live);
    expect(progress.at(-1)).toEqual({ user: 2, users: 2, claimed: 8, deferred: 0, skipped: 0, failed: 0 });

    const v = await h.store.read('admin').turf.version();
    expect(await run()).toMatchObject({ users: 0, pending: 0, claimed: 0, remaining: 0, stopped: 'done' });
    expect(await h.store.read('admin').turf.version()).toBe(v);
  });

  it('--user claims that user only', async () => {
    await uploads(TOKENS.admin, 2);
    await uploads(TOKENS.other, 2);
    await forgetTurf();
    expect(await run({ userId: 'other' })).toMatchObject({ users: 1, claimed: 2, remaining: 0 });
    expect(await run({ dryRun: true })).toMatchObject({ users: 1, pending: 2 });
    expect((await findAccount(h.db, 'admin'))!.turf).toEqual({
      claims: 0,
      unclaimedActivities: 2,
      untrackedActivities: 0,
    });
    expect((await findAccount(h.db, 'other'))!.turf).toEqual({
      claims: 2,
      unclaimedActivities: 0,
      untrackedActivities: 0,
    });
  });

  it('is resumable: stopped by its budget, the next run continues where it stopped', async () => {
    await uploads(TOKENS.admin, 5);
    const live = await snapshot();
    await forgetTurf();
    expect(await run({ maxActivities: 2 })).toMatchObject({ claimed: 2, remaining: 3, stopped: 'budget' });
    // The oldest went first.
    const claimed = await rows<{ id: string }>(sql`SELECT activity_id AS id FROM turf_claims ORDER BY 1`);
    expect(claimed.map((r) => r.id)).toEqual(['a0', 'a1']);
    expect(await run({ deadlineAt: 0 })).toMatchObject({ claimed: 0, stopped: 'deadline' });
    expect(await run()).toMatchObject({ claimed: 3, remaining: 0, stopped: 'done' });
    expect(await snapshot()).toEqual(live);
  });

  it('defers a start in the future and claims it once due', async () => {
    await uploads(TOKENS.admin, 1);
    const start = h.clock.t + 3_600_000;
    await h.call('PUT', '/v1/activities/later', { body: body(line(1, start)) });
    await forgetTurf();
    expect(await run()).toMatchObject({ claimed: 1, deferred: 1, remaining: 1 });
    h.clock.t = start + 120_000;
    expect(await run()).toMatchObject({ claimed: 1, deferred: 0, remaining: 0 });
  });

  // Interleaving only: PGlite runs every transaction on one session behind a mutex, so these
  // transactions take turns and the user lock (`SELECT … FOR UPDATE`) never contends here. This
  // proves the end state for any order of whole transactions, not the lock: concurrent upload +
  // backfill is part of the Neon check (PR test plan).
  it('is safe alongside uploads: the same end state, no claim twice', async () => {
    await uploads(TOKENS.admin, 4);
    await forgetTurf();
    const [report] = await Promise.all([
      run(),
      (async () => {
        for (let i = 4; i < 7; i++) {
          expect((await h.call('PUT', `/v1/activities/a${i}`, { body: body(line(i)) })).status).toBe(201);
        }
      })(),
    ]);
    expect(report.failed).toBe(0);
    expect(await run({ dryRun: true })).toMatchObject({ pending: 0 });
    const claims = await rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM turf_claims`);
    expect(claims[0].n).toBe(7);
    // The projection equals a rebuild from the claims.
    const before = await snapshot();
    await h.store.write('admin', async (tx) => {
      await tx.lock();
      await tx.turf.rebuildAll();
    });
    expect(await snapshot()).toEqual(before);
  });

  it('skips a user whose claim fails and carries on; reports the error class only', async () => {
    await uploads(TOKENS.admin, 2);
    await uploads(TOKENS.other, 2);
    await forgetTurf();
    const failing = new BackupService(h.store, h.clock, h.grid);
    const real = failing.catchUpTurf.bind(failing);
    failing.catchUpTurf = (userId, limit, offset) =>
      userId === 'admin'
        ? Promise.reject(new TypeError('cell 8b1f53c9a2b1fff at 21.0122,52.2297'))
        : real(userId, limit, offset);
    const errors: string[] = [];
    const report = await backfillTurf({ store: h.store, backup: failing, onFailure: (e) => errors.push(e) });
    expect(report).toMatchObject({ claimed: 2, failed: 2, remaining: 2 });
    expect(errors).toEqual(['TypeError', 'TypeError']);
  });

  it("one activity that keeps failing doesn't hold back the user's newer ones", async () => {
    await uploads(TOKENS.admin, 3);
    await forgetTurf();
    // The oldest activity's claim fails inside its transaction (a statement timeout, say).
    const store = Object.assign(Object.create(h.store) as BackupStore, {
      write: <T>(userId: string, fn: (tx: UserWriter) => Promise<T>) =>
        h.store.write(userId, (tx) =>
          fn(
            Object.assign(Object.create(tx) as UserWriter, {
              turf: Object.assign(Object.create(tx.turf), {
                saveClaim: (...args: Parameters<UserWriter['turf']['saveClaim']>) =>
                  args[0].state.activityId === 'a0'
                    ? Promise.reject(new Error('statement timeout'))
                    : tx.turf.saveClaim(...args),
              }),
            })
          )
        ),
    });
    const report = await backfillTurf({ store, backup: new BackupService(store, h.clock, h.grid) });
    expect(report).toMatchObject({ claimed: 2, failed: 1, remaining: 1 });
    const claimed = await rows<{ id: string }>(sql`SELECT activity_id AS id FROM turf_claims ORDER BY 1`);
    expect(claimed.map((r) => r.id)).toEqual(['a1', 'a2']);
    // The next run tries it first again (and here it works).
    expect(await run()).toMatchObject({ claimed: 1, failed: 0, remaining: 0 });
  });

  it('an activity without a track is skipped once, never retried, and does not hold up other users', async () => {
    await uploads(TOKENS.admin, 3);
    await uploads(TOKENS.other, 2);
    await forgetTurf();
    // A repair case: the activity row is there, its track row is not (or holds no point).
    await h.db.execute(sql`DELETE FROM activity_tracks WHERE user_id = 'admin' AND activity_id = 'a0'`);
    await h.db.execute(
      sql`UPDATE activity_tracks SET points = '[]'::jsonb WHERE user_id = 'admin' AND activity_id = 'a1'`
    );
    const calls: string[] = [];
    const counting = service();
    const real = counting.catchUpTurf.bind(counting);
    counting.catchUpTurf = (userId, limit) => {
      calls.push(userId);
      return real(userId, limit);
    };
    const report = await backfillTurf({ store: h.store, backup: counting });
    expect(report).toMatchObject({
      users: 2,
      pending: 3,
      claimed: 3,
      skipped: 2,
      failed: 0,
      remaining: 0,
      stopped: 'done',
    });
    // One attempt per claimable activity: the trackless ones were never attempted.
    expect(calls).toHaveLength(3);
    const claimed = await rows<{ id: string }>(sql`
      SELECT user_id || '/' || activity_id AS id FROM turf_claims ORDER BY 1`);
    expect(claimed.map((r) => r.id)).toEqual(['admin/a2', 'other/a0', 'other/a1']);
    expect((await findAccount(h.db, 'admin'))!.turf).toEqual({
      claims: 1,
      unclaimedActivities: 0,
      untrackedActivities: 2,
    });
    // A second run reports them again but attempts nothing.
    calls.length = 0;
    expect(await backfillTurf({ store: h.store, backup: counting })).toMatchObject({
      users: 0,
      claimed: 0,
      skipped: 2,
      remaining: 0,
    });
    expect(calls).toEqual([]);
  });

  it('counts a claim only when it exists afterwards; a run always ends', async () => {
    await uploads(TOKENS.admin, 2);
    await forgetTurf();
    // A claim that returns without saving (what the core does for a track without a point).
    const hollow = service();
    hollow.catchUpTurf = () => Promise.resolve({ claimed: 0, deferred: 0, skipped: 1, gone: false });
    expect(await backfillTurf({ store: h.store, backup: hollow })).toMatchObject({
      claimed: 0,
      skipped: 2,
      remaining: 2,
      stopped: 'done',
    });
    // Even a claim that always says "claimed" (the old bug) stops after the user's pending count.
    let attempts = 0;
    const liar = service();
    liar.catchUpTurf = () => {
      attempts++;
      return Promise.resolve({ claimed: 1, deferred: 0, skipped: 0, gone: false });
    };
    await backfillTurf({ store: h.store, backup: liar });
    expect(attempts).toBe(2);
  });

  it('a claim that saves nothing is passed over, so it never holds back newer activities', async () => {
    await uploads(TOKENS.admin, 3);
    await forgetTurf();
    // The oldest activity saves no claim (offset 0); the rest claim normally.
    const offsets: number[] = [];
    const stuck = service();
    const real = stuck.catchUpTurf.bind(stuck);
    stuck.catchUpTurf = (userId, limit, offset = 0) => {
      offsets.push(offset);
      return offset === 0
        ? Promise.resolve({ claimed: 0, deferred: 0, skipped: 1, gone: false })
        : real(userId, limit, offset);
    };
    for (let run = 0; run < 2; run++) {
      offsets.length = 0;
      expect(await backfillTurf({ store: h.store, backup: stuck })).toMatchObject({
        claimed: run === 0 ? 2 : 0,
        skipped: 1,
        remaining: 1,
        stopped: 'done',
      });
      expect(offsets).toEqual(run === 0 ? [0, 1, 1] : [0]);
    }
    const claimed = await rows<{ id: string }>(sql`SELECT activity_id AS id FROM turf_claims ORDER BY 1`);
    expect(claimed.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('never re-creates an account erased between the backlog and the catch-up', async () => {
    await uploads(TOKENS.admin, 2);
    await uploads(TOKENS.other, 1);
    await forgetTurf();
    const erasing = Object.assign(Object.create(h.store) as BackupStore, {
      turfBacklog: async (q: Parameters<BackupStore['turfBacklog']>[0]) => {
        const page = await h.store.turfBacklog(q);
        await h.store.eraseAccount('admin');
        return page;
      },
    });
    const report = await backfillTurf({ store: erasing, backup: new BackupService(erasing, h.clock, h.grid) });
    expect(report).toMatchObject({ users: 2, claimed: 1, failed: 0 });
    const users = await rows<{ id: string }>(sql`SELECT id FROM users WHERE id = 'admin'`);
    expect(users).toEqual([]);
    expect(await rows(sql`SELECT 1 FROM turf_cells WHERE user_id = 'admin'`)).toEqual([]);
  });

  it('catchUpTurf skips an erased user without writing anything', async () => {
    await uploads(TOKENS.admin, 1);
    await forgetTurf();
    await h.store.eraseAccount('admin');
    expect(await service().catchUpTurf('admin', 5)).toEqual({ claimed: 0, deferred: 0, skipped: 0, gone: true });
    expect(await rows(sql`SELECT id FROM users WHERE id = 'admin'`)).toEqual([]);
  });

  it('progress and report hold counts only: no user, activity or cell id, no coordinate', async () => {
    await uploads(TOKENS.admin, 3);
    await forgetTurf();
    const progress: BackfillProgress[] = [];
    const report = await run({}, progress);
    const text = JSON.stringify([progress, report]);
    expect(text).not.toMatch(H3_ID);
    expect(text).not.toMatch(/admin|a\d|21\.01|52\.2/);
  });
});

describe('the retention cron catches up turf', () => {
  const cron = () => h.app.request(RETENTION_CRON_PATH, { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });

  it(`claims at most ${TURF_CATCH_UP_ACTIVITIES} activities per run, counts only in the answer and the log`, async () => {
    await uploads(TOKENS.admin, TURF_CATCH_UP_ACTIVITIES + 3);
    await forgetTurf();
    let res = await cron();
    expect(res.status).toBe(200);
    expect((await res.json()).turf).toEqual({
      claimed: TURF_CATCH_UP_ACTIVITIES,
      deferred: 0,
      skipped: 0,
      failed: 0,
      remaining: 3,
    });
    res = await cron();
    expect((await res.json()).turf).toEqual({ claimed: 3, deferred: 0, skipped: 0, failed: 0, remaining: 0 });
    const events = logged.map((l) => JSON.parse(l) as { msg: string }).filter((l) => l.msg === 'turf.caught-up');
    expect(events).toHaveLength(2);
    expect(logged.join('\n')).not.toMatch(H3_ID);
  }, 120_000);

  it('activities without a track never use up the cap: other users are still claimed', async () => {
    // More trackless activities than the cap, all on the user whose id sorts first.
    await uploads(TOKENS.admin, TURF_CATCH_UP_ACTIVITIES + 2);
    await uploads(TOKENS.other, 2);
    await forgetTurf();
    await h.db.execute(sql`DELETE FROM activity_tracks WHERE user_id = 'admin'`);
    const res = await cron();
    expect((await res.json()).turf).toEqual({
      claimed: 2,
      deferred: 0,
      skipped: TURF_CATCH_UP_ACTIVITIES + 2,
      failed: 0,
      remaining: 0,
    });
    expect(logged.join('\n')).not.toMatch(H3_ID);
  }, 120_000);

  it('a deferred start is claimed by the first run after it is due', async () => {
    await uploads(TOKENS.admin, 0);
    const start = h.clock.t + 3_600_000;
    await h.call('PUT', '/v1/activities/later', { body: body(line(0, start)) });
    expect((await (await cron()).json()).turf).toEqual({
      claimed: 0,
      deferred: 1,
      skipped: 0,
      failed: 0,
      remaining: 1,
    });
    h.clock.t = start + 86_400_000;
    expect((await (await cron()).json()).turf).toEqual({
      claimed: 1,
      deferred: 0,
      skipped: 0,
      failed: 0,
      remaining: 0,
    });
  });

  it('a turf failure never fails the retention run: logged by class, answered as null', async () => {
    await uploads(TOKENS.admin, 1);
    await forgetTurf();
    const broken = Object.assign(Object.create(h.store) as BackupStore, {
      turfBacklog: () => Promise.reject(new Error('connection reset near 21.0122,52.2297')),
    });
    const events: string[] = [];
    const eventLog = { request: () => undefined, event: (e: object) => events.push(JSON.stringify(e)) };
    const app = createApp(
      defaultDeps({
        store: broken,
        grid: h.grid,
        clock: h.clock,
        log: eventLog,
        cronSecret: TEST_CRON_SECRET,
        retention: new RetentionService(new DrizzleRetentionStore(h.db), h.clock, eventLog),
      })
    );
    const res = await app.request(RETENTION_CRON_PATH, { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect(res.status).toBe(200);
    expect((await res.json()).turf).toBeNull();
    expect(events.map((e) => JSON.parse(e) as { msg: string; error?: string })).toContainEqual({
      msg: 'turf.catch-up-failed',
      error: 'Error',
    });
    expect(events.join('\n')).not.toMatch(/21\.01|52\.2/);
  });
});
