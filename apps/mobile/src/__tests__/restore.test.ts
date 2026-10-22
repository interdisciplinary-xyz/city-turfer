/**
 * Restore from the cloud backup, two phones against one server: phone A backs up its history (GPX
 * fixtures, a rename, checked gap routes, a Home City), phone B — a new phone signed in to the same
 * account — restores it. Same activities, distances, names, turf and Home City; nothing exported to
 * Apple Health, the street router never asked, nothing uploaded back; a restore killed half-way
 * resumes without duplicates.
 */
import { SqliteBackupRepository } from '@/contexts/cloud-backup/infrastructure/sqlite-backup-repository';
import { FakeHealthStore } from '@/contexts/health-sync/test-support/fake-health-store';
import type { TrackPoint } from '@/shared-kernel';
import { DAY, phone, type PhoneContainer, T0, walk } from '@/test-support/backup-phone';
import { loadFixes } from '@/test-support/fixtures';

/** 2 km of walking with a 5-minute, 300 m GPS gap in the middle (far from start and end). */
function gappyWalk(): TrackPoint[] {
  const start = T0 + 9 * DAY;
  return Array.from({ length: 200 }, (_, i) => {
    const after = i >= 100;
    return {
      lat: 52.3 + i * 0.00009 + (after ? 0.0027 : 0),
      lon: 21.05,
      t: start + i * 5_000 + (after ? 300_000 : 0),
      segment: after ? 1 : 0,
      alt: null,
      accuracy: 5,
      speed: 2,
    };
  });
}

const ACCOUNT = { token: 'secret-token', accountId: 'acct-1' };
const NEW_PHONE_PROFILE = 'a-acct-1';

const points = (gpx: string): TrackPoint[] =>
  loadFixes(gpx).map((f) => ({ ...f, segment: 0, accuracy: 5, speed: null }));

/** A street route across every gap (phone A only). */
const route = async (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => ({
  distanceM: 400,
  coords: [
    [from.lon, from.lat],
    [to.lon, to.lat],
  ] as [number, number][],
});

async function backedUpPhoneA() {
  const a = phone({ account: ACCOUNT, gapRouting: true, route });
  const c = await a.container();
  await c.activityLog.importActivity.execute({ id: 'rec-walk', type: 'walk', points: points('walk-2k.gpx') });
  await c.activityLog.importActivity.execute({
    id: 'rec-run',
    type: 'run',
    points: points('run-5k-outliers-pause.gpx'),
  });
  await c.activityLog.importActivity.execute({ id: 'rec-ride', type: 'cycle', points: points('cycle-20k.gpx') });
  await c.add('rec-gap', gappyWalk()); // a GPS gap mid-walk: routed along streets
  await c.add('demo-1', walk(11)); // generated demo history: never backed up
  await c.dispatcher.dispatchPending();
  await c.activityLog.splitTrackGaps.execute();
  await c.dispatcher.dispatchPending();
  await c.estimateGaps();
  await c.activityLog.rename.execute('rec-run', 'Riverside 5k');
  await c.territory.chooseHomeCity.execute('pl-warsaw');
  await c.dispatcher.dispatchPending();
  expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
  await c.cloudBackup.run.execute();
  expect(a.server.activities.size).toBe(4);
  return { a, c };
}

async function snapshot(c: PhoneContainer) {
  const list = (await c.activityLog.list.execute(100)).filter((x) => !x.id.startsWith('demo-'));
  const details = await Promise.all(list.map((x) => c.activityLog.detail.execute(x.id)));
  return {
    activities: details
      .map((d) => ({
        id: d!.id,
        type: d!.type,
        name: d!.name,
        startedAt: d!.startedAt,
        endedAt: d!.endedAt,
        distanceM: d!.distanceM,
        estimatedDistanceM: d!.estimatedDistanceM,
        points: d!.track.length,
        gapRoutes: d!.gapRoutes.length,
      }))
      .sort((x, y) => x.id.localeCompare(y.id)),
    homeCity: await c.territory.homeCityChoice.execute(),
  };
}

/** Phone B: a new phone, signed in to the same account, Apple Health connected (export on). */
async function newPhone(a: { server: ReturnType<typeof phone>['server'] }) {
  const health = new FakeHealthStore();
  const b = phone({
    account: ACCOUNT,
    server: a.server,
    profile: NEW_PHONE_PROFILE,
    gapRouting: true,
    extra: { health },
  });
  const c = await b.container();
  await c.healthSync.connect.execute();
  return { b, c, health };
}

describe('Restore from the cloud backup', () => {
  it('phone B gets phone A’s history: activities, distances, names, turf, Home City', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    const { b, c, health } = await newPhone(a);
    const uploadsBefore = a.server.uploads().length;

    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 4 });
    const progress: number[] = [];
    expect(await c.cloudBackup.restore.execute((p) => progress.push(p.done))).toEqual({
      kind: 'done',
      restored: 4,
      skipped: 0,
      backupOn: true, // the server's consents turned backup on here too
    });
    expect(a.server.calls('consents')).toHaveLength(1);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, healthIncluded: false });
    await c.dispatcher.dispatchPending();
    expect(progress.at(-1)).toBe(4);

    const mine = await snapshot(phoneA);
    const theirs = await snapshot(c);
    expect(theirs).toEqual(mine);
    expect(theirs.activities.find((x) => x.id === 'rec-run')!.name).toBe('Riverside 5k');
    expect(theirs.activities.find((x) => x.id === 'rec-gap')!.gapRoutes).toBeGreaterThan(0);
    expect((await c.territory.summary.execute()).cellCount).toBe(
      (await phoneA.territory.summary.execute()).cellCount - (await turfOfDemo(phoneA))
    );

    // Nothing exported to Apple Health, the router never asked, nothing uploaded back.
    await c.estimateGaps();
    await c.syncHealth();
    expect(await b.db.all('SELECT * FROM hs_pending_exports')).toEqual([]);
    expect(health.saved).toEqual([]);
    expect(b.routerCalls.n).toBe(0);
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    await c.cloudBackup.run.execute();
    expect(a.server.uploads().length).toBe(uploadsBefore);
    expect(a.server.calls('putHomeCity').length).toBe(1); // phone A's only
    expect(await c.cloudBackup.status.execute()).toMatchObject({ backedUp: 4, total: 4 });
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });
  });

  it('one walk recorded first, three on the server: offers the three, merges them, keeps the walk', async () => {
    const a = phone({ account: ACCOUNT });
    const phoneA = await a.container();
    for (const [i, id] of ['rec-a', 'rec-b', 'rec-c'].entries()) {
      await phoneA.add(id, walk(i + 1));
    }
    await phoneA.dispatcher.dispatchPending();
    expect(await phoneA.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    await phoneA.cloudBackup.run.execute();
    expect(a.server.activities.size).toBe(3);

    const b = phone({ account: ACCOUNT, server: a.server, profile: NEW_PHONE_PROFILE });
    const c = await b.container();
    await c.add('rec-mine', walk(15)); // recorded on the new phone before restoring
    await c.activityLog.rename.execute('rec-mine', 'First walk here');
    await c.dispatcher.dispatchPending();

    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 3 });
    expect(await c.cloudBackup.restore.execute()).toEqual({ kind: 'done', restored: 3, skipped: 0, backupOn: true });
    await c.dispatcher.dispatchPending();
    const ids = (await c.activityLog.list.execute(100)).map((x) => x.id).sort();
    expect(ids).toEqual(['rec-a', 'rec-b', 'rec-c', 'rec-mine']);
    expect((await c.activityLog.detail.execute('rec-mine'))!.name).toBe('First walk here');
    expect(
      a.server
        .calls('activityCopy')
        .map((r) => r.id)
        .sort()
    ).toEqual(['rec-a', 'rec-b', 'rec-c']);
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });

    // Backup is on now: only the new phone's own walk goes up.
    const uploads = a.server.uploads().length;
    await c.cloudBackup.run.execute();
    expect(a.server.uploads().slice(uploads)).toEqual(['rec-mine']);
    expect(a.server.calls('deleteActivity')).toEqual([]);

    // Restoring again (the always-available action) changes nothing and duplicates nothing.
    const copies = a.server.calls('activityCopy').length;
    expect(await c.cloudBackup.restore.execute()).toEqual({ kind: 'done', restored: 0, skipped: 0, backupOn: true });
    expect(a.server.calls('activityCopy')).toHaveLength(copies);
    expect(await b.db.first('SELECT COUNT(*) AS n FROM log_activities')).toEqual({ n: 4 });
  });

  it('is not offered when nothing is on the server, or everything already is on the phone', async () => {
    const empty = phone({ account: ACCOUNT, profile: NEW_PHONE_PROFILE });
    expect(await (await empty.container()).cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });

    const { a, c: phoneA } = await backedUpPhoneA();
    expect(await phoneA.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' }); // the phone that backed up
    expect(a.server.activities.size).toBe(4);
  });

  it('never brings back an Activity deleted on this phone, even before the server heard of it', async () => {
    const { a } = await backedUpPhoneA();
    const { b, c } = await newPhone(a);
    await c.cloudBackup.restore.execute();
    await c.dispatcher.dispatchPending();
    a.server.failNext('deleteActivity', { kind: 'offline' }, 10); // the delete can't reach the server
    await c.activityLog.remove.execute('rec-run');
    await c.dispatcher.dispatchPending();
    await c.cloudBackup.run.execute();
    expect(a.server.activities.has('rec-run')).toBe(true);

    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 0 });
    expect(await c.activityLog.detail.execute('rec-run')).toBeNull();
    expect(await b.db.first('SELECT COUNT(*) AS n FROM log_activities')).toEqual({ n: 3 });
  });

  it('an Activity deleted here stays deleted after switching to another account and back', async () => {
    const { a, c } = await backedUpPhoneA();
    a.server.failNext('deleteActivity', { kind: 'offline' }, 10); // the delete never reaches account 1
    await c.activityLog.remove.execute('rec-run');
    await c.dispatcher.dispatchPending();
    await c.cloudBackup.run.execute();
    expect(a.server.activities.has('rec-run')).toBe(true);

    // Account 2 on this profile, then account 1 again: each switch clears the backup rows.
    const repo = new SqliteBackupRepository(a.db);
    const key = (await repo.settings()).toState().accountKey!;
    await repo.useAccount('https://elsewhere|acct-2');
    await repo.useAccount(key);
    expect(await repo.backups()).toEqual([]);

    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 0 });
    expect(await c.activityLog.detail.execute('rec-run')).toBeNull();
  });

  it('"Not now" hides the offer until the server holds something new', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    const { b, c } = await newPhone(a);
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 4 });
    await c.cloudBackup.dismissRestore.execute();
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });
    expect(await (await b.container()).cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' }); // relaunch

    const good = (await phoneA.activityLog.archive.of('rec-walk'))!;
    a.server.seedCopy({ ...good, id: 'rec-later', startedAt: good.startedAt + DAY, endedAt: good.endedAt + DAY }, 1);
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 5 });
    // The action still restores everything the phone lacks, declined or not.
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 5 });
  });

  it('turns backup and the Apple Health option on to match the server’s consents', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    expect(await phoneA.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'ok' });
    const { c } = await newPhone(a);
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', backupOn: true });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, healthIncluded: true });
  });

  it('leaves backup off when the consents can’t be read; turning it on then works', async () => {
    const { a } = await backedUpPhoneA();
    const { c } = await newPhone(a);
    a.server.failNext('consents', { kind: 'offline' });
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 4, backupOn: false });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: false });
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
  });

  it('a restore killed half-way resumes where it stopped, without duplicates', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    const { b, c } = await newPhone(a);
    let copies = 0;
    a.server.onRequest = (r) => {
      if (r.method === 'activityCopy' && ++copies === 3) {
        throw new Error('app killed');
      }
    };
    await expect(c.cloudBackup.restore.execute()).rejects.toThrow('app killed');
    expect((await c.activityLog.list.execute(100)).length).toBe(2);

    // Relaunch: a new container on the same database.
    a.server.onRequest = null;
    const relaunched = await b.container();
    expect(await relaunched.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'resume', done: 2, total: 4 });
    expect(await relaunched.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 2 });
    await relaunched.dispatcher.dispatchPending();
    expect(await snapshot(relaunched)).toEqual(await snapshot(phoneA));
    expect(await b.db.first('SELECT COUNT(*) AS n FROM log_activities')).toEqual({ n: 4 });
    // Only the copy that was cut off was fetched again.
    const copied = a.server.calls('activityCopy').map((r) => r.id);
    expect(copied).toHaveLength(5);
    expect(new Set(copied).size).toBe(4);
  });

  it('an item this phone cannot hold gets no backup row, so backing up never deletes it on the server', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    const good = (await phoneA.activityLog.archive.of('rec-walk'))!;
    a.server.seedCopy({ ...good, id: 'rec-bad', name: 'x'.repeat(81) }, 2);
    const { b, c } = await newPhone(a);
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 4, skipped: 1 });
    expect(await b.db.first("SELECT COUNT(*) AS n FROM cb_activities WHERE activity_id = 'rec-bad'")).toEqual({ n: 0 });
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' }); // skipped: not offered again
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    await c.cloudBackup.run.execute();
    expect(a.server.calls('deleteActivity')).toEqual([]);
    expect(a.server.activities.has('rec-bad')).toBe(true);
  });

  it('killed between an import and its backup row: backing up later sends nothing, deletes nothing', async () => {
    const { a } = await backedUpPhoneA();
    const { b, c } = await newPhone(a);
    await c.cloudBackup.restore.execute();
    await c.dispatcher.dispatchPending();
    await b.db.run("DELETE FROM cb_activities WHERE activity_id = 'rec-run'"); // the row never got written
    const uploads = a.server.uploads().length;
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    await c.cloudBackup.run.execute();
    expect(a.server.uploads().length).toBe(uploads);
    expect(a.server.calls('deleteActivity')).toEqual([]);
  });

  it('an interrupted restore never holds up backups, and they never delete what is still to restore', async () => {
    const { a, c: phoneA } = await backedUpPhoneA();
    const { b, c } = await newPhone(a);
    let copies = 0;
    a.server.onRequest = (r) => {
      if (r.method === 'activityCopy' && ++copies === 2) {
        throw new Error('app killed');
      }
    };
    await expect(c.cloudBackup.restore.execute()).rejects.toThrow('app killed');
    a.server.onRequest = null;
    const relaunched = await b.container();
    await relaunched.cloudBackup.enable.execute();
    // A walk recorded before the restore is resumed (the Turfer said "Not now" to the offer).
    await relaunched.add('rec-new', walk(14));
    expect(await relaunched.cloudBackup.restoreOffer.execute()).toMatchObject({ kind: 'resume' });
    const uploads = a.server.uploads().length;
    expect(await relaunched.cloudBackup.run.execute()).toMatchObject({ kind: 'done', report: { error: null } });
    expect(a.server.uploads().slice(uploads)).toEqual(['rec-new']);
    expect(a.server.calls('deleteActivity')).toEqual([]);
    expect(await relaunched.cloudBackup.restore.execute()).toMatchObject({ kind: 'done' });
    await relaunched.dispatcher.dispatchPending();
    await relaunched.cloudBackup.run.execute();
    expect(a.server.calls('deleteActivity')).toEqual([]);
    expect(a.server.uploads().slice(uploads)).toEqual(['rec-new']); // nothing restored goes back up
    const ids = (await relaunched.activityLog.list.execute(100)).map((x) => x.id).sort();
    expect(ids).toEqual([...(await snapshot(phoneA)).activities.map((x) => x.id), 'rec-new'].sort());
  });

  it('backup skips as busy only while a restore is running right now', async () => {
    const { a } = await backedUpPhoneA();
    const { c } = await newPhone(a);
    await c.cloudBackup.enable.execute();
    const restoring = c.cloudBackup.restore.execute();
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'busy' });
    expect(await restoring).toMatchObject({ kind: 'done', restored: 4 });
    expect(await c.cloudBackup.run.execute()).toMatchObject({ kind: 'done', report: { error: null } });
  });

  it('a Home City this version does not know is skipped; the restore still finishes', async () => {
    const { a } = await backedUpPhoneA();
    a.server.homeCity = { cityId: 'xx-nowhere', chosenAt: Date.parse('2026-10-19T07:00:00Z') };
    const { c } = await newPhone(a);
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 4 });
    expect(await c.territory.homeCity.execute()).toBeNull();
    expect(await c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'none' });
  });

  it('never runs during a recording; pauses and continues afterwards', async () => {
    const { a } = await backedUpPhoneA();
    const { c } = await newPhone(a);
    await c.recording.start.execute('walk');
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'paused', reason: 'recording' });
    expect(a.server.calls('activityCopy')).toEqual([]);
    await c.recording.discard.execute();
    expect(await c.cloudBackup.restore.execute()).toMatchObject({ kind: 'done', restored: 4 });
  });

  it('Apple Health import waits while a restore runs', async () => {
    const { a } = await backedUpPhoneA();
    const { c, health } = await newPhone(a);
    health.add({ uuid: 'w1', kind: 'walking' }, []);
    const running = c.cloudBackup.restore.execute();
    expect(await c.healthSync.importWorkouts.execute()).toBeNull();
    await running;
  });
});

/** Turf cells only the demo activity claimed on phone A (demo history is never backed up). */
async function turfOfDemo(c: PhoneContainer): Promise<number> {
  const before = (await c.territory.summary.execute()).cellCount;
  await c.activityLog.remove.execute('demo-1');
  await c.dispatcher.dispatchPending();
  const after = (await c.territory.summary.execute()).cellCount;
  return before - after;
}
