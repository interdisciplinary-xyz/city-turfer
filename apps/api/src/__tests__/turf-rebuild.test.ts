/**
 * TurfRebuild (`scripts/turf-rebuild.ts` → `rebuildTurf`): after a rollback to an API that did not
 * maintain the projection, deletes and withdrawals cascaded claims away but left their Turf Cells,
 * and replaces changed the track, type or start in place under the old claim. The rebuild
 * recomputes the cells from the claims that remain and re-claims stale claims, per user, under the
 * user lock, only where needed; counts only; never re-creates an erased account.
 */
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { trackHashOf } from '../backup/hashing';
import type { CompactPoint } from '../backup/model';
import type { BackupStore } from '../backup/ports';
import { BackupService } from '../backup/use-cases';
import { rebuildTurf } from '../territory/rebuild';
import { backupApp, closeSharedDb, TOKENS } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
});
afterAll(closeSharedDb);

const H3_ID = /8b[0-9a-f]{13}/;
const T0 = Date.parse('2026-10-19T07:12:00Z');
const iso = (t: number) => new Date(t).toISOString();

/** A made-up line near Warsaw Old Town (public landmark), `i` shifts it north. */
function line(i: number): CompactPoint[] {
  const start = T0 + i * 600_000;
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

const cellsOf = (userId: string) =>
  rows<Record<string, unknown>>(sql`
    SELECT cell, walk, run, cycle, first_at, first_activity_id FROM turf_cells
    WHERE user_id = ${userId} ORDER BY cell COLLATE "C"`);

async function upload(token: string, ids: number[]) {
  await h.call('PUT', '/v1/me/consents/cloud-sync', { token, body: { granted: true, policyVersion: '2026-10' } });
  for (const i of ids) {
    expect((await h.call('PUT', `/v1/activities/a${i}`, { token, body: body(line(i)) })).status).toBe(201);
  }
}

/**
 * What an API without server turf did on a delete (and what a withdrawal did in bulk): the activity
 * row went and its claim with it (foreign key cascade), its Turf Cells stayed.
 */
const deleteLikeOldApi = (userId: string, activityId: string) =>
  h.db.execute(sql`DELETE FROM activities WHERE user_id = ${userId} AND id = ${activityId}`);

/**
 * What an API without server turf did on a replace: the activity row and its track were updated in
 * place (an UPDATE, so no cascade), and the claim kept the old cells, type and start.
 */
async function replaceLikeOldApi(userId: string, activityId: string, points: CompactPoint[], type = 'walk') {
  await h.db.execute(sql`
    UPDATE activities SET type = ${type}, track_hash = ${trackHashOf(points)},
      started_at = ${iso(points[0][2])}::timestamptz, ended_at = ${iso(points.at(-1)![2])}::timestamptz
    WHERE user_id = ${userId} AND id = ${activityId}`);
  await h.db.execute(sql`
    UPDATE activity_tracks SET points = ${JSON.stringify(points)}::jsonb
    WHERE user_id = ${userId} AND activity_id = ${activityId}`);
}

const service = () => new BackupService(h.store, h.clock, h.grid);
const run = (options: Parameters<typeof rebuildTurf>[1] = {}, store: BackupStore = h.store) =>
  rebuildTurf({ store, backup: new BackupService(store, h.clock, h.grid) }, options);

/** admin: a1 and a2 kept, a0 (the earliest: first claimer of shared cells) deleted the old way; other: everything deleted the old way. */
async function staleAfterRollback() {
  await upload(TOKENS.admin, [1, 2]);
  const expected = await cellsOf('admin');
  await upload(TOKENS.admin, [0]);
  await upload(TOKENS.other, [0]);
  expect(await cellsOf('admin')).not.toEqual(expected);
  await deleteLikeOldApi('admin', 'a0');
  await deleteLikeOldApi('other', 'a0');
  expect((await cellsOf('other')).length).toBeGreaterThan(0);
  return expected;
}

describe('turf rebuild', () => {
  it('recomputes the cells from the claims that remain; a user without claims loses every cell', async () => {
    const expected = await staleAfterRollback();
    const staleAdmin = await cellsOf('admin');

    const dry = await run({ dryRun: true });
    expect(dry).toMatchObject({ users: 2, stale: 2, gone: 0, failed: 0, dryRun: true });
    expect(dry.drift).toBeGreaterThan(0);
    expect(await cellsOf('admin')).toEqual(staleAdmin);

    const v = await h.store.read('admin').turf.version();
    expect(await run()).toMatchObject({ users: 2, stale: 2, drift: dry.drift, gone: 0, failed: 0, dryRun: false });
    expect(await cellsOf('admin')).toEqual(expected);
    expect(await cellsOf('other')).toEqual([]);
    expect(await h.store.read('admin').turf.version()).toBeGreaterThan(v);

    // Idempotent: nothing differs any more, nothing is written (the turf ETag stays).
    const after = await h.store.read('admin').turf.version();
    expect(await run()).toMatchObject({ users: 1, stale: 0, drift: 0 });
    expect(await h.store.read('admin').turf.version()).toBe(after);
  });

  it('re-claims a claim whose activity an older API replaced in place (track, type, start)', async () => {
    // The same activities uploaded the 0.6.0 way: what admin's turf must be after the repair.
    await upload(TOKENS.other, [2]);
    await h.call('PUT', '/v1/activities/a1', { token: TOKENS.other, body: { ...body(line(7)), type: 'run' } });
    const expected = await cellsOf('other');

    await upload(TOKENS.admin, [1, 2]);
    const before = await cellsOf('admin');
    await replaceLikeOldApi('admin', 'a1', line(7), 'run');
    // The old claim survives the in-place replace: no drift, so the cell recompute alone misses it.
    expect(await cellsOf('admin')).toEqual(before);
    expect(await h.store.read('admin').turf.version()).toBeGreaterThan(0);

    const dry = await run({ dryRun: true, userId: 'admin' });
    expect(dry).toMatchObject({ users: 1, stale: 1, drift: 0, staleClaims: 1 });
    expect(await cellsOf('admin')).toEqual(before);

    expect(await run({ userId: 'admin' })).toMatchObject({ users: 1, stale: 1, drift: 0, staleClaims: 1, failed: 0 });
    expect(await cellsOf('admin')).toEqual(expected);
    expect(await run({ userId: 'admin' })).toMatchObject({ stale: 0, drift: 0, staleClaims: 0 });
  });

  it('leaves a consistent projection alone', async () => {
    await upload(TOKENS.admin, [0, 1, 2]);
    const v = await h.store.read('admin').turf.version();
    const before = await cellsOf('admin');
    expect(await run()).toMatchObject({ users: 1, stale: 0, drift: 0, staleClaims: 0 });
    expect(await cellsOf('admin')).toEqual(before);
    expect(await h.store.read('admin').turf.version()).toBe(v);
  });

  it('--user rebuilds that user only', async () => {
    await staleAfterRollback();
    expect(await run({ userId: 'other' })).toMatchObject({ users: 1, stale: 1 });
    expect(await cellsOf('other')).toEqual([]);
    expect(await run({ dryRun: true })).toMatchObject({ users: 1, stale: 1 });
  });

  it('never re-creates an account erased between the listing and its rebuild', async () => {
    await staleAfterRollback();
    const erasing = Object.assign(Object.create(h.store) as BackupStore, {
      turfUsers: async (q: Parameters<BackupStore['turfUsers']>[0]) => {
        const page = await h.store.turfUsers(q);
        await h.store.eraseAccount('admin');
        return page;
      },
    });
    expect(await run({}, erasing)).toMatchObject({ users: 2, stale: 1, gone: 1, failed: 0 });
    expect(await rows(sql`SELECT id FROM users WHERE id = 'admin'`)).toEqual([]);
    expect(await service().rebuildTurf('admin')).toEqual({ drift: 0, staleClaims: 0, gone: true });
    expect(await rows(sql`SELECT id FROM users WHERE id = 'admin'`)).toEqual([]);
  });

  it('reports counts only: no user, activity or cell id, no coordinate', async () => {
    await staleAfterRollback();
    const progress: unknown[] = [];
    const errors: string[] = [];
    const report = await rebuildTurf({
      store: h.store,
      backup: service(),
      onProgress: (p) => progress.push(p),
      onFailure: (e) => errors.push(e),
    });
    const text = JSON.stringify([progress, report, errors]);
    expect(text).not.toMatch(H3_ID);
    expect(text).not.toMatch(/admin|other|a\d|21\.01|52\.2/);
  });
});
