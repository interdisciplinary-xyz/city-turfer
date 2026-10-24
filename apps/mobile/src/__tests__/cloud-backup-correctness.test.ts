/**
 * Cloud Backup correctness (contract 0.4.0) through the real wiring and SQL: changes made while
 * backup was off are reconciled, another account or server starts from scratch, renames go up as
 * PATCH, an empty gap-routes check goes up too, a withdrawn consent leaves "nothing on the server",
 * a retry after travelling sends the same content, the demo profile backs up its planned demo history
 * (only it, never its recordings or Apple Health imports, and only to its own account), a profile
 * without credentials never sends a request, and a build without a backup server sends nothing at all.
 */
import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/sqlite-activity-repository';
import { phone, type PhoneContainer, walk } from '@/test-support/backup-phone';

const ACCOUNT = { token: 'secret-token', accountId: 'acct-1' };

async function backedUp(c: PhoneContainer) {
  expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
  return c.cloudBackup.run.execute();
}

const rows = (t: ReturnType<typeof phone>) =>
  t.db.all<{ id: string; status: string; op: string | null }>(
    'SELECT activity_id AS id, status, op FROM cb_activities ORDER BY started_at'
  );

/** The withdrawals still to deliver and the account the state is about. */
const pending = async (t: ReturnType<typeof phone>) =>
  t.db.first<{ w: string | null; k: string | null }>('SELECT withdrawals_pending AS w, account_key AS k FROM cb_state');

describe('Cloud Backup: changes made while backup was off', () => {
  it('reconciles deletes, corrections, renames and gap checks on the next comparison', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-del', walk(0));
    await c.add('rec-ren', walk(1));
    await c.add('rec-fix', walk(2, 10)); // a 10-minute GPS gap inside segment 0: split later
    await c.add('rec-gap', walk(3));
    await c.add('rec-same', walk(4));
    await backedUp(c);
    expect(t.server.activities.size).toBe(5);
    const fixedVersion = t.server.activities.get('rec-fix')!.version;

    // Off, but the server can't be told (offline, then the app is in the background): its copy stays,
    // and nothing is queued meanwhile.
    t.server.failNext('setConsent', { kind: 'offline' }, 2);
    await c.cloudBackup.disable.execute();
    t.app.foreground = false;
    await c.activityLog.remove.execute('rec-del');
    await c.activityLog.rename.execute('rec-ren', 'Canal loop');
    await c.activityLog.splitTrackGaps.execute();
    await new SqliteActivityRepository(t.db).saveGapRoutes('rec-gap', [], Date.parse('2026-10-20T12:00:00Z'));
    await c.dispatcher.dispatchPending();
    expect(await rows(t)).toEqual(expect.arrayContaining([{ id: 'rec-del', status: 'backed-up', op: null }]));
    const before = t.server.requests.length;

    // On again before the withdrawal reached the server: compare everything.
    t.app.foreground = true;
    await backedUp(c);
    const sent = t.server.requests.slice(before).filter((r) => r.method !== 'changes' && r.method !== 'setConsent');
    expect(sent.map((r) => `${r.method} ${r.id}`).sort()).toEqual(
      [
        'deleteActivity rec-del',
        'activityVersion rec-fix', // the server's name, before replacing (a newer rename there is kept)
        'putActivity rec-fix',
        'putGapRoutes rec-gap',
        'renameActivity rec-ren',
      ].sort()
    );
    expect(t.server.tombstones.has('rec-del')).toBe(true);
    expect(t.server.activities.get('rec-ren')!.name).toBe('Canal loop');
    expect(t.server.activities.get('rec-fix')!.version).toBe(fixedVersion + 1);
    expect(
      t.server
        .calls('putActivity')
        .filter((r) => r.id === 'rec-fix')
        .at(-1)!.ifMatch
    ).toBe(fixedVersion);
    // "Checked, no gaps" is sent as an empty list.
    expect(t.server.activities.get('rec-gap')!.gapRoutes).toEqual({ checkedAt: expect.any(Number), count: 0 });
    expect(await rows(t)).toEqual([
      { id: 'rec-del', status: 'deleted', op: null },
      { id: 'rec-ren', status: 'backed-up', op: null },
      { id: 'rec-fix', status: 'backed-up', op: null },
      { id: 'rec-gap', status: 'backed-up', op: null },
      { id: 'rec-same', status: 'backed-up', op: null },
    ]);

    // Nothing left to do: another comparison sends nothing.
    await c.cloudBackup.useServer.execute(null);
    const after = t.server.requests.length;
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.requests.slice(after).filter((r) => r.method !== 'changes')).toEqual([]);
  });

  it('never deletes server copies this phone did not back up (e.g. before a restore)', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    t.server.seed('other-phone-1', 3);
    await backedUp(c);
    expect(t.server.calls('deleteActivity')).toEqual([]);
    expect(t.server.activities.has('other-phone-1')).toBe(true);
  });
});

describe('Cloud Backup: renames and gap checks while on', () => {
  it('sends a rename as PATCH with its time, after the upload; once', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    t.advance(60_000);
    await c.activityLog.rename.execute('rec-1', 'Sunrise walk');
    await c.dispatcher.dispatchPending();
    await c.backUp();
    expect(t.server.calls('renameActivity').map((r) => r.id)).toEqual(['rec-1']);
    expect(t.server.activities.get('rec-1')).toMatchObject({
      name: 'Sunrise walk',
      renamedAt: Date.parse('2026-10-20T12:01:00Z'),
    });
    expect(t.server.uploads()).toEqual(['rec-1']); // the track was not sent again
  });

  it('a rename before the first upload rides on the upload (no PATCH)', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.activityLog.rename.execute('rec-1', 'First light');
    await c.dispatcher.dispatchPending();
    await backedUp(c);
    expect(t.server.activities.get('rec-1')!.name).toBe('First light');
    expect(t.server.calls('renameActivity')).toEqual([]);
  });

  it('sends "checked, no gaps" (an empty list) right after the upload', async () => {
    const t = phone({ account: ACCOUNT, gapRouting: true });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.estimateGaps(); // no gaps worth routing: checked, empty
    await backedUp(c);
    expect(t.server.activities.get('rec-1')!.gapRoutes).toEqual({ checkedAt: expect.any(Number), count: 0 });
  });
});

describe('Cloud Backup: renames from another phone (last write wins on renamedAt)', () => {
  /** Another phone (e.g. after a restore) renames the server copy via PATCH. */
  function renamedElsewhere(t: ReturnType<typeof phone>, id: string, name: string, renamedAt: number) {
    const a = t.server.activities.get(id)!;
    t.server.activities.set(id, { ...a, version: a.version + 1, name, renamedAt });
  }

  it('comparing again never pushes a name this phone did not rename over a newer server rename', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    t.advance(60_000);
    renamedElsewhere(t, 'rec-1', 'Renamed on phone B', Date.parse('2026-10-20T12:01:00Z'));

    t.advance(60_000);
    await c.cloudBackup.useServer.execute(null); // compare with the manifest again
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.calls('renameActivity')).toEqual([]);
    expect(t.server.calls('putActivity').map((r) => r.id)).toEqual(['rec-1']); // only the first upload
    expect(t.server.activities.get('rec-1')).toMatchObject({
      name: 'Renamed on phone B',
      renamedAt: Date.parse('2026-10-20T12:01:00Z'),
    });
  });

  it("a rename made here later than the other phone's still wins", async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    renamedElsewhere(t, 'rec-1', 'Renamed on phone B', Date.parse('2026-10-20T12:00:30Z'));
    t.advance(60_000);
    await c.activityLog.rename.execute('rec-1', 'Renamed on phone A');
    await c.dispatcher.dispatchPending();
    await c.cloudBackup.useServer.execute(null);
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.activities.get('rec-1')).toMatchObject({
      name: 'Renamed on phone A',
      renamedAt: Date.parse('2026-10-20T12:01:00Z'),
    });
  });

  it('a replacement retried after 412 keeps the newer server rename', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0, 10)); // a 10-minute GPS gap inside one segment
    await backedUp(c);
    renamedElsewhere(t, 'rec-1', 'Renamed on phone B', Date.parse('2026-10-20T12:00:30Z')); // version 2
    t.advance(60_000);
    await c.activityLog.splitTrackGaps.execute(); // corrects the track → replace with If-Match "v1"
    await c.dispatcher.dispatchPending();
    await c.backUp();

    expect(t.server.calls('putActivity').map((r) => r.ifMatch)).toEqual([null, 1, 2]);
    expect(t.server.activities.get('rec-1')).toMatchObject({
      version: 3, // the corrected track is there…
      name: 'Renamed on phone B', // …with the other phone's newer name
      renamedAt: Date.parse('2026-10-20T12:00:30Z'),
    });
  });

  it('a replacement at the version the manifest listed keeps a rename it cannot see in the feed', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0, 10));
    await backedUp(c);
    renamedElsewhere(t, 'rec-1', 'Renamed on phone B', Date.parse('2026-10-20T12:00:30Z')); // version 2
    // As after comparing with the manifest: this phone knows version 2, but not who renamed it.
    await t.db.run("UPDATE cb_activities SET server_version = 2 WHERE activity_id = 'rec-1'");
    await c.activityLog.splitTrackGaps.execute();
    await c.dispatcher.dispatchPending();
    await c.backUp();

    expect(t.server.calls('putActivity').map((r) => r.ifMatch)).toEqual([null, 2]); // no 412
    expect(t.server.activities.get('rec-1')).toMatchObject({ version: 3, name: 'Renamed on phone B' });
  });

  it("a replacement carries this phone's name when its rename is the newer one", async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0, 10));
    await backedUp(c);
    renamedElsewhere(t, 'rec-1', 'Renamed on phone B', Date.parse('2026-10-20T12:00:30Z'));
    t.advance(60_000);
    await c.activityLog.rename.execute('rec-1', 'Renamed on phone A');
    await c.activityLog.splitTrackGaps.execute();
    await c.dispatcher.dispatchPending();
    await c.backUp();
    expect(t.server.activities.get('rec-1')!.name).toBe('Renamed on phone A');
  });
});

describe('Cloud Backup: another account or server', () => {
  it('state from a device token, then an email account with other data: that history goes up', async () => {
    const t = phone({ token: 'secret-token' });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.cloudBackup.enable.execute();
    await c.cloudBackup.run.execute();
    // Before migration 10 nothing said whose rows these were; the account now has nothing.
    await t.db.run('UPDATE cb_state SET account_key = NULL');
    t.server.activities.clear();
    t.account.value = { token: 'secret-token', accountId: 'acct-new' };
    await c.cloudBackup.run.execute();
    expect(t.server.activities.has('rec-1')).toBe(true);
  });

  it('starts from scratch: backup off, no rows kept from the other account', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    expect(await rows(t)).toHaveLength(1);

    t.account.value = { token: 'secret-token', accountId: 'acct-2' }; // another account on this profile
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'off' });
    expect(await rows(t)).toEqual([]);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: false, backedUp: 0, total: 1 });
  });

  it('the first account seen is adopted, after comparing (state from before accounts were tracked)', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    await t.db.run('UPDATE cb_state SET account_key = NULL');
    const feeds = t.server.calls('changes').length;
    await c.cloudBackup.run.execute();
    // Adopted, but compared with this account's manifest before "backed up" is trusted.
    expect(t.server.calls('changes').length).toBe(feeds + 1);
    expect(await rows(t)).toHaveLength(1);
    expect(await t.db.first('SELECT account_key AS k FROM cb_state')).toEqual({
      k: expect.stringContaining('|acct-1'),
    });
  });

  it('a device token asks the server whose it is; the same account keeps its state', async () => {
    const t = phone({ token: 'secret-token' });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    expect(t.server.calls('me').length).toBeGreaterThan(0);
    // Signing in with a code as the same account (the device-token user adopted the email).
    t.account.value = ACCOUNT;
    await c.cloudBackup.run.execute();
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, backedUp: 1 });
  });
});

describe('Cloud Backup: a withdrawal pending when the account changes', () => {
  it('is delivered to the previous account (its device token) before switching', async () => {
    const t = phone({ token: 'secret-token' });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    t.server.failNext('setConsent', { kind: 'offline' }, 2); // turned off while offline
    expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'failed', error: 'offline' });
    expect(t.server.activities.has('rec-1')).toBe(true);

    // Signs in by email as another account on this profile.
    t.server.moreTokens.set('token-y', 'acct-2');
    t.account.value = { token: 'token-y', accountId: 'acct-2' };
    await c.cloudBackup.run.execute();
    expect(t.server.consents.get('cloud-sync')).toMatchObject({ granted: false });
    expect(t.server.activities.size).toBe(0); // account 1's copy is gone
    expect(await pending(t)).toEqual({ w: null, k: expect.stringContaining('|acct-2') });
  });

  it('without a token for the previous account the switch waits, and the withdrawal is kept', async () => {
    const t = phone({ account: ACCOUNT, token: null });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    t.server.failNext('setConsent', { kind: 'offline' }, 2);
    await c.cloudBackup.disable.execute();

    t.server.moreTokens.set('token-y', 'acct-2');
    t.account.value = { token: 'token-y', accountId: 'acct-2' };
    expect(await c.cloudBackup.run.execute()).toMatchObject({ kind: 'done', report: { error: 'auth' } });
    expect(await pending(t)).toEqual({
      w: expect.stringContaining('cloud-sync'),
      k: expect.stringContaining('|acct-1'),
    });
    expect(await c.cloudBackup.enable.execute()).toMatchObject({ kind: 'failed' }); // not on account 2 yet
    expect(t.server.activities.has('rec-1')).toBe(true);

    t.account.value = ACCOUNT; // back on account 1: the withdrawal arrives
    await c.cloudBackup.run.execute();
    expect(t.server.activities.size).toBe(0);
    expect(await pending(t)).toEqual({ w: null, k: expect.stringContaining('|acct-1') });
  });
});

describe('Cloud Backup: a withdrawal for a local profile’s former account', () => {
  /** admin@ linked (acct-1), backed up; a password sign-in drops the session; turned off then. */
  async function offForGoneAccount() {
    const t = phone({ profile: 'admin', account: ACCOUNT, token: null });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);
    t.account.value = null;
    expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    // acct-1 is deleted on the web; the next code to admin@ makes a new account.
    t.server.moreTokens.set('token-2', 'acct-2');
    t.account.value = { token: 'token-2', accountId: 'acct-2' };
    return { t, c };
  }

  it('no token reaches it any more and the address has a new account: it no longer blocks backup', async () => {
    const { t, c } = await offForGoneAccount();
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'off' });
    expect(await pending(t)).toEqual({ w: null, k: expect.stringContaining('|acct-2') });
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    expect(await c.cloudBackup.run.execute()).toMatchObject({ kind: 'done', report: { error: null } });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, withdrawalPending: false });
  });

  it('while the server can’t be asked (offline), the withdrawal is kept', async () => {
    const { t, c } = await offForGoneAccount();
    t.server.failNext('me', { kind: 'offline' });
    await c.cloudBackup.run.execute();
    expect(await pending(t)).toEqual({
      w: expect.stringContaining('cloud-sync'),
      k: expect.stringContaining('|acct-1'),
    });
  });
});

describe('Cloud Backup: withdrawing a consent', () => {
  it('off: once the server has it, nothing is on the server; on again uploads everything anew', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.add('rec-2', walk(1));
    await c.territory.chooseHomeCity.execute('pl-gdansk');
    await c.dispatcher.dispatchPending();
    await backedUp(c);
    expect(t.server.homeCity).not.toBeNull();

    expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'ok' });
    expect(t.server.activities.size).toBe(0);
    expect(await rows(t)).toEqual([]);
    // Nothing on the phone was touched.
    expect((await c.activityLog.list.execute()).length).toBe(2);

    await backedUp(c);
    expect(t.server.uploads()).toEqual(['rec-1', 'rec-2', 'rec-1', 'rec-2']);
    expect(t.server.homeCity).toMatchObject({ cityId: 'pl-gdansk' });
  });

  it('Apple Health off: only the hk-* copies are forgotten', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.add('hk-1', walk(1));
    await backedUp(c);
    await c.cloudBackup.includeHealth.execute(true);
    await c.cloudBackup.run.execute();
    expect(t.server.activities.has('hk-1')).toBe(true);

    await c.cloudBackup.includeHealth.execute(false);
    expect(t.server.activities.has('hk-1')).toBe(false);
    expect((await rows(t)).map((r) => r.id)).toEqual(['rec-1']);
  });
});

describe('Cloud Backup: time zone', () => {
  it('a retry after travelling sends the same content (the zone the Activity was saved in)', async () => {
    const t = phone({ account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0)); // saved in Warsaw
    await backedUp(c);
    expect(t.server.activities.get('rec-1')).toMatchObject({ version: 1, timeZone: 'Europe/Warsaw' });

    t.app.timeZone = 'Asia/Tokyo';
    // The phone never heard back from that upload (killed): it sends it again.
    await t.db.run("UPDATE cb_activities SET status = 'none', op = 'upload' WHERE activity_id = 'rec-1'");
    await c.cloudBackup.run.execute();
    expect(t.server.uploads()).toEqual(['rec-1', 'rec-1']);
    expect(t.server.activities.get('rec-1')).toMatchObject({ version: 1, timeZone: 'Europe/Warsaw' });
    expect(t.server.calls('activityVersion')).toEqual([]);
  });
});

describe('Cloud Backup: demo history (LP3)', () => {
  it('the demo profile backs up its seeded demo history, as import', async () => {
    const t = phone({ profile: 'demo', account: ACCOUNT });
    const c = await t.container();
    await c.add('demo-gdansk-n0', walk(0));
    await c.add('demo-gdansk-n1', walk(1));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ available: true, hasToken: true, total: 2 });
    const result = await backedUp(c);
    expect(result).toEqual({ kind: 'done', report: { uploaded: 2, deleted: 0, failed: 0, refused: 0, error: null } });
    expect(t.server.uploads()).toEqual(['demo-gdansk-n0', 'demo-gdansk-n1']);
    expect(t.server.activities.get('demo-gdansk-n0')?.source).toBe('import');
    // Demo activities added later (a resumed seed) are queued through the outbox like any other.
    await c.add('demo-gdansk-n2', walk(3));
    await c.cloudBackup.run.execute();
    expect(t.server.activities.get('demo-gdansk-n2')?.source).toBe('import');
  });

  it('on the demo profile, recordings and Apple Health imports stay on the phone: not uploaded, queued or counted', async () => {
    const t = phone({ profile: 'demo', account: ACCOUNT });
    const c = await t.container();
    await c.add('demo-gdansk-n0', walk(0));
    await c.add('rec-1', walk(1)); // a real walk recorded on the demo profile (e.g. for screenshots)
    await c.add('hk-1', walk(2));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ total: 1 });
    await backedUp(c);
    expect(await c.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'ok' });
    await c.cloudBackup.run.execute({ now: true });
    // Recorded and imported while backup (and Apple Health) is on: not queued either.
    await c.add('rec-2', walk(3));
    await c.add('hk-2', walk(4));
    await c.dispatcher.dispatchPending();
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toEqual(['demo-gdansk-n0']);
    expect((await rows(t)).map((r) => r.id)).toEqual(['demo-gdansk-n0']);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 1, unsynced: 0 });

    // A recording queued on the demo profile before this rule: never sent, and not shown as waiting.
    await t.db.run(
      "INSERT INTO cb_activities (activity_id, started_at, status, op, gaps_pending, rev, attempts, rename_pending) VALUES ('rec-1', ?, 'none', 'upload', 0, 0, 0, 0)",
      [Date.parse('2026-10-02T07:00:00Z')]
    );
    expect(await c.cloudBackup.status.execute()).toMatchObject({ total: 1, unsynced: 0 });
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toEqual(['demo-gdansk-n0']);
  });

  it('on the demo profile, the Developer tools seeder’s demo-<ms> tracks (real position) never leave the phone', async () => {
    const t = phone({ profile: 'demo', account: ACCOUNT });
    const c = await t.container();
    await c.add('demo-gdansk-n0', walk(0));
    await c.add(`demo-${Date.parse('2026-10-01T07:00:00Z')}`, walk(1));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ total: 1 });
    await backedUp(c);
    await c.add(`demo-${Date.parse('2026-10-02T07:00:00Z')}`, walk(2)); // seeded while backup is on
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toEqual(['demo-gdansk-n0']);
    expect((await rows(t)).map((r) => r.id)).toEqual(['demo-gdansk-n0']);
  });

  it('the demo profile ignores a Developer tools device token: its history goes only to demo@’s linked account', async () => {
    const t = phone({ profile: 'demo', token: 'secret-token', account: null });
    const c = await t.container();
    await c.add('demo-gdansk-n0', walk(0));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ hasToken: false, hasDeviceToken: true });
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'off' });
    await c.runLaunchMaintenance();
    expect(t.server.requests).toEqual([]);

    t.account.value = ACCOUNT; // linked by a code: demo@'s own session
    expect(await backedUp(c)).toMatchObject({ kind: 'done', report: { uploaded: 1, error: null } });
    expect(t.server.uploads()).toEqual(['demo-gdansk-n0']);
  });

  it('demo history seeded on another profile (Developer tools) never leaves the phone', async () => {
    const t = phone({ profile: 'admin', account: ACCOUNT });
    const c = await t.container();
    await c.add('demo-1', walk(0));
    await c.add('rec-1', walk(1));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ available: true, total: 1 });
    await backedUp(c);
    await c.add('demo-2', walk(2)); // seeded while backup is on: not queued either
    await c.cloudBackup.run.execute({ now: true });
    expect(t.server.uploads()).toEqual(['rec-1']); // another profile's recording goes up
    expect(t.server.activities.get('rec-1')?.source).toBe('recording');
    expect([...t.server.activities.keys()]).toEqual(['rec-1']);
    expect((await rows(t)).map((r) => r.id)).toEqual(['rec-1']);
  });
});

describe('Cloud Backup: a build without a backup server', () => {
  it('sends nothing and reads no credentials: every switch fails as not-available, runs are skipped', async () => {
    const t = phone({ noBackupAdapters: true, account: ACCOUNT });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await c.territory.chooseHomeCity.execute('pl-gdansk');
    await c.dispatcher.dispatchPending();
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'not-available' });
    expect(await c.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'failed', error: 'not-available' });
    expect(await c.cloudBackup.includeHealth.execute(false)).toEqual({ kind: 'failed', error: 'not-available' });
    expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'failed', error: 'not-available' });
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'failed', error: 'not-available' });
    expect(await c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'not-available' });
    await c.runLaunchMaintenance();
    expect(await c.cloudBackup.status.execute()).toMatchObject({ available: false, enabled: false, hasToken: false });
    expect(t.server.requests).toEqual([]);
    expect(t.account.reads).toBe(0);
    expect(await rows(t)).toEqual([]);
  });
});

describe('Cloud Backup: profiles without credentials', () => {
  it('the demo profile opened with its password (no code yet) sends nothing, its history included', async () => {
    const t = phone({ profile: 'demo', account: null, token: null });
    const c = await t.container();
    await c.add('demo-gdansk-n0', walk(0));
    await c.add('rec-1', walk(1));
    expect(await c.cloudBackup.status.execute()).toMatchObject({ available: true, hasToken: false, total: 1 });
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    expect(await c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'off' });
    await c.runLaunchMaintenance();
    expect(t.server.requests).toEqual([]);
  });

  it('credentials cleared, then revoked, between uploads: no-token, then auth; a new code resumes cleanly', async () => {
    const t = phone({ profile: 'admin', account: ACCOUNT, token: null });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    await backedUp(c);

    // A password sign-in (LP2): no credentials; backup stays on and waits, without a request.
    t.account.value = null;
    await c.add('rec-2', walk(1));
    const sent = t.server.requests.length;
    expect(await c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'no-token' });
    expect(t.server.requests.length).toBe(sent);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, lastError: 'no-token' });

    // A session the server no longer accepts (revoked on the web, or expired): auth, not retried.
    t.account.value = { token: 'revoked-token', accountId: 'acct-1' };
    expect(await c.cloudBackup.run.execute({ now: true })).toMatchObject({ kind: 'done', report: { error: 'auth' } });
    expect(await c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'waiting-for-token' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, hasToken: true, lastError: 'auth' });
    expect(t.server.activities.has('rec-2')).toBe(false);

    // A new code: the link screen's path carries on (no new consent) and the run sends rec-2.
    t.server.moreTokens.set('token-new', 'acct-1');
    t.account.value = { token: 'token-new', accountId: 'acct-1' };
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'carried-on' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ lastError: null });
    expect(await c.cloudBackup.run.execute({ now: true })).toMatchObject({ kind: 'done', report: { error: null } });
    expect(t.server.activities.has('rec-2')).toBe(true);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, backedUp: 2, lastError: null });
  });

  it('a profile with no account and no token sends nothing either', async () => {
    const t = phone({ token: null });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    await c.runLaunchMaintenance();
    expect(t.server.requests).toEqual([]);
  });
});
