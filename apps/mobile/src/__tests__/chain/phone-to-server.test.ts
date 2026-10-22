/**
 * Sync chain, phone → server (docs/plans/sync-chain-testing-2026-10-22.md, scenarios S1–S13).
 * Every change starts on a phone; the server is checked from outside, the way the web portal and
 * the admin will read it. Runs against the FakeApiServer always, and against a real API when
 * CITYTURFER_LIVE_API names one (`pnpm test:chain` starts one on throwaway data).
 */
import {
  CHAIN_SERVERS,
  type ChainPhone,
  type ChainServer,
  isPending,
  LIVE_API,
  liveServer,
} from '@/test-support/chain/chain-server';
import { addActivity, notYet, phoneSnapshot } from '@/test-support/chain/scenario';
import { loadFixes } from '@/test-support/fixtures';

jest.setTimeout(180_000);

const WALK = 'walk-2k.gpx';
const RUN = 'run-5k-outliers-pause.gpx';
const RIDE = 'cycle-20k.gpx';

async function backupOn(p: ChainPhone) {
  expect(await p.c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
  return p.c.cloudBackup.run.execute({ now: true });
}

async function backUp(p: ChainPhone) {
  const r = await p.c.cloudBackup.run.execute({ now: true });
  expect(r.kind).toBe('done');
  return r.kind === 'done' ? r.report : null;
}

/** The server holds exactly the phone's activities, with the same names and (live) numbers. */
async function expectServerMatchesPhone(p: ChainPhone, ids: string[]) {
  const phone = (await phoneSnapshot(p.c)).activities.filter((a) => ids.includes(a.id));
  const server = (await p.server.activities()).sort((a, b) => a.id.localeCompare(b.id));
  expect(server.map((a) => [a.id, a.name, a.type])).toEqual(phone.map((a) => [a.id, a.name, a.type]));
  server.forEach((s, i) => {
    if (s.distanceM != null) {
      // Phone and API compute with the same @cityturfer/core: any gap is a bug, not rounding.
      expect(Math.abs(s.distanceM - phone[i].distanceM)).toBeLessThan(1);
      expect(Math.abs(s.movingS! - phone[i].movingS)).toBeLessThanOrEqual(1);
    }
  });
}

async function expectTurfMatches(name: string, check: string, p: ChainPhone) {
  const server = await p.server.turfCellCount();
  if (isPending(server)) {
    notYet(name, check, server);
    return;
  }
  expect(server).toBe((await phoneSnapshot(p.c)).cells);
}

describe.each(CHAIN_SERVERS)('sync chain, phone → %s', (name, make) => {
  let server: ChainServer;
  let n = 0;
  const account = (label: string) => `${label}-${++n}`;

  beforeAll(() => {
    server = make();
  });

  it('S1: turning backup on puts every activity on the server, same numbers; a second run sends nothing', async () => {
    const p = await server.phone(account('s1'), 'phone');
    await addActivity(p.c, 'rec-walk', 'walk', WALK);
    await addActivity(p.c, 'rec-run', 'run', RUN);
    await addActivity(p.c, 'rec-ride', 'cycle', RIDE);

    const run = await backupOn(p);
    expect(run).toMatchObject({ kind: 'done', report: { uploaded: 3, failed: 0, refused: 0, error: null } });
    expect(await p.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 3, total: 3 });
    await expectServerMatchesPhone(p, ['rec-walk', 'rec-run', 'rec-ride']);
    expect(await p.server.consents()).toMatchObject({ 'cloud-sync': true });
    await expectTurfMatches(name, 'S1 turf cells', p);

    // No upload was refused and retried behind an "ok" (a 412/428/422 would show here).
    expect(p.refusedWrites()).toEqual([]);

    const before = p.writes();
    expect(await backUp(p)).toMatchObject({ uploaded: 0, deleted: 0, failed: 0 });
    expect(await p.server.activities()).toHaveLength(3);
    // Idempotent: a second run writes nothing.
    expect(p.writes()).toBe(before);
  });

  // S13 (the headless GPS task stays offline) is headless-offline.test.ts plus a device check:
  // a foreground container can't prove it.
  it('S2: nothing is written while recording; the finished activity reaches the server on its own', async () => {
    const p = await server.phone(account('s2'), 'phone');
    await addActivity(p.c, 'rec-walk', 'walk', WALK);
    await backupOn(p);
    await p.c.cloudBackup.run.whenIdle();

    const before = p.writes();
    const fixes = loadFixes(RUN);
    expect((await p.c.recording.start.execute('run')).kind).toBe('started');
    for (let i = 0; i < fixes.length; i += 25) {
      await p.c.recording.ingestFixes.execute(fixes.slice(i, i + 25));
    }
    await p.c.dispatcher.dispatchPending();
    await p.c.cloudBackup.run.whenIdle();
    expect(p.writes()).toBe(before);
    expect(await p.server.activities()).toHaveLength(1);

    const finished = await p.c.recording.finish.execute();
    expect(finished.kind).toBe('finished');
    const id = (finished as { sessionId: string }).sessionId;
    await p.c.dispatcher.dispatchPending();
    // Saving the activity queues it, and the outbox starts a foreground backup run.
    await p.c.cloudBackup.run.whenIdle();
    await expectServerMatchesPhone(p, ['rec-walk', id]);
    expect(await p.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 2, total: 2, unsynced: 0 });
    expect(p.refusedWrites()).toEqual([]);
  });

  it('S3 + S4 + S5: rename, delete and Home City reach the server', async () => {
    const p = await server.phone(account('s3'), 'phone');
    await addActivity(p.c, 'rec-walk', 'walk', WALK);
    await addActivity(p.c, 'rec-run', 'run', RUN);
    expect(await backupOn(p)).toMatchObject({ kind: 'done', report: { uploaded: 2, failed: 0 } });
    expect(await p.server.isGone('rec-run')).toBe(false);

    await p.c.activityLog.rename.execute('rec-walk', 'Lunch loop');
    await p.c.activityLog.remove.execute('rec-run');
    await p.c.territory.chooseHomeCity.execute('pl-warsaw');
    await p.c.dispatcher.dispatchPending();
    expect(await backUp(p)).toMatchObject({ failed: 0, refused: 0, error: null });

    expect(await p.server.tombstoned('rec-run')).toBe(true);
    await expectServerMatchesPhone(p, ['rec-walk']);
    expect((await p.server.activities()).find((a) => a.id === 'rec-walk')!.name).toBe('Lunch loop');
    expect(await p.server.homeCityId()).toBe('pl-warsaw');
    await expectTurfMatches(name, 'S4 turf after delete', p);
  });

  it('S6 + S7: Apple Health workouts reach the server only while shared; turning sharing off keeps them on the phone', async () => {
    const p = await server.phone(account('s6'), 'phone');
    await addActivity(p.c, 'rec-walk', 'walk', WALK);
    await addActivity(p.c, 'hk-w1', 'walk', WALK);
    await backupOn(p);
    expect(await p.server.isGone('hk-w1')).toBe(true);
    await expectServerMatchesPhone(p, ['rec-walk']);

    expect(await p.c.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'ok' });
    await backUp(p);
    const hk = (await p.server.activities()).find((a) => a.id === 'hk-w1');
    expect(hk?.source).toBe('apple-health');
    expect(await p.server.consents()).toMatchObject({ 'apple-health-in-cloud-sync': true });

    const phoneBefore = await phoneSnapshot(p.c);
    expect(await p.c.cloudBackup.includeHealth.execute(false)).toEqual({ kind: 'ok' });
    expect(await p.server.isGone('hk-w1')).toBe(true);
    await expectServerMatchesPhone(p, ['rec-walk']);
    expect(await phoneSnapshot(p.c)).toEqual(phoneBefore);
  });

  it('S8: turning backup off erases the server copy and nothing on the phone', async () => {
    const p = await server.phone(account('s8'), 'phone');
    await addActivity(p.c, 'rec-walk', 'walk', WALK);
    await addActivity(p.c, 'rec-run', 'run', RUN);
    await p.c.territory.chooseHomeCity.execute('pl-gdansk');
    await p.c.dispatcher.dispatchPending();
    await backupOn(p);
    expect(await p.server.activities()).toHaveLength(2);
    expect(await p.server.homeCityId()).toBe('pl-gdansk');

    const phoneBefore = await phoneSnapshot(p.c);
    expect(await p.c.cloudBackup.disable.execute()).toEqual({ kind: 'ok' });
    expect(await p.server.activities()).toEqual([]);
    expect(await p.server.homeCityId()).toBeNull();
    expect(await p.server.consents()).toMatchObject({ 'cloud-sync': false });
    expect(await phoneSnapshot(p.c)).toEqual(phoneBefore);
  });

  it('S11: a new phone on the same account restores the same history', async () => {
    const shared = account('s11');
    const a = await server.phone(shared, 'phone-a');
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    await addActivity(a.c, 'rec-ride', 'cycle', RIDE);
    await a.c.activityLog.rename.execute('rec-ride', 'Coast ride');
    await a.c.territory.chooseHomeCity.execute('pl-warsaw');
    await a.c.dispatcher.dispatchPending();
    await backupOn(a);

    // Live: a second code for the same address waits out the one-a-minute limit, as a user would.
    const b = await server.phone(shared, 'phone-b');
    expect(await b.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 2 });
    expect(await b.c.cloudBackup.restore.execute()).toEqual({
      kind: 'done',
      restored: 2,
      skipped: 0,
      backupOn: true,
      healthOffered: false,
    });
    await b.c.dispatcher.dispatchPending();

    const mine = await phoneSnapshot(a.c);
    const theirs = await phoneSnapshot(b.c);
    expect(theirs.activities.map((x) => [x.id, x.type, x.name, x.points])).toEqual(
      mine.activities.map((x) => [x.id, x.type, x.name, x.points])
    );
    mine.activities.forEach((x, i) => expect(Math.abs(theirs.activities[i].distanceM - x.distanceM)).toBeLessThan(1));
    expect(theirs.cells).toBe(mine.cells);
    expect(theirs.cells).toBeGreaterThan(0);
    expect(theirs.homeCity).toBe('pl-warsaw');
    // Restore only reads: the server still holds the same two, and nothing was refused on either phone.
    await expectServerMatchesPhone(a, ['rec-walk', 'rec-ride']);
    expect(a.refusedWrites()).toEqual([]);
    expect(b.refusedWrites()).toEqual([]);
  });
});

const describeLive = LIVE_API ? describe : describe.skip;

describeLive('sync chain, live API only', () => {
  let server: ChainServer;
  beforeAll(() => {
    server = liveServer(LIVE_API!);
  });

  it('S10 + R2: deleting the account signs every session out; backup stops with an auth error; the phone keeps everything', async () => {
    const a = await server.phone('s10', 'phone-a');
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    await backupOn(a);
    const b = await server.phone('s10', 'phone-b'); // a second session (waits out the code limit)
    expect(await a.server.signedIn()).toBe(true);
    expect(await b.server.signedIn()).toBe(true);

    const phoneBefore = await phoneSnapshot(a.c);
    await a.deleteAccount!(); // what the web portal's "Delete account" will call
    expect(await a.server.signedIn()).toBe(false);
    expect(await b.server.signedIn()).toBe(false);

    // The new activity's outbox run meets the 401: backup keeps its setting, notes the auth error
    // and waits for a new sign-in instead of retrying with a dead token.
    await addActivity(a.c, 'rec-run', 'run', RUN);
    await a.c.cloudBackup.run.whenIdle();
    expect(await a.c.cloudBackup.status.execute()).toMatchObject({ lastError: 'auth', unsynced: 1, backedUp: 1 });
    expect(await a.c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'waiting-for-token' });
    const now = await phoneSnapshot(a.c);
    expect(now.activities.filter((x) => x.id !== 'rec-run')).toEqual(phoneBefore.activities);
    expect(now.activities.map((x) => x.id)).toContain('rec-run');
  });

  it.each(['before-send', 'response-lost'] as const)(
    'S12 (%s): a network drop mid-backup never leaves half an activity; the retry completes it',
    async (mode) => {
      const p = await server.phone(`s12-${mode}`, 'phone');
      await addActivity(p.c, 'rec-walk', 'walk', WALK);
      await addActivity(p.c, 'rec-run', 'run', RUN);
      await addActivity(p.c, 'rec-ride', 'cycle', RIDE);
      expect(await p.c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
      await p.c.cloudBackup.run.whenIdle();

      p.dropNetworkAfter!(1, mode);
      const dropped = await p.c.cloudBackup.run.execute({ now: true });
      expect(dropped).toMatchObject({ kind: 'done', report: { error: 'offline' } });
      const partial = await p.server.activities();
      expect(dropped).toMatchObject({ report: { uploaded: 1 } });
      if (mode === 'before-send') {
        // The run stops at the first dropped write: one activity on the server.
        expect(partial).toHaveLength(1);
      } else {
        // Every write reached the server; the phone heard back about one.
        expect(partial.length).toBeGreaterThan(1);
      }
      // Whatever arrived is whole: same numbers as on the phone.
      await expectServerMatchesPhone(
        p,
        partial.map((a) => a.id)
      );

      p.restoreNetwork!();
      expect(await backUp(p)).toMatchObject({ failed: 0, refused: 0, error: null });
      await expectServerMatchesPhone(p, ['rec-walk', 'rec-run', 'rec-ride']);
      expect(p.refusedWrites()).toEqual([]);
      expect(await p.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 3, total: 3, unsynced: 0 });
    }
  );
});
