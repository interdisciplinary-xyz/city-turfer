/**
 * Sync chain, phone ↔ web portal (docs/plans/sync-chain-testing-2026-10-22.md, W1–W4). The web
 * portal's Slice 0 shows the account, the backup consents and the signed-in devices, and can sign
 * phones out, export and delete the account; it shows no activities or turf yet (Slice 1). Live API
 * only; against an API without browser sessions every scenario reports pending.
 */
import { type ChainPhone, type ChainServer, isPending, LIVE_API, liveServer } from '@/test-support/chain/chain-server';
import { addActivity, notYet, phoneSnapshot, turnBackupOn } from '@/test-support/chain/scenario';
import { type WebPortal, webSignIn } from '@/test-support/chain/web-portal';

jest.setTimeout(300_000);

const WALK = 'walk-2k.gpx';
const RUN = 'run-5k-outliers-pause.gpx';
const describeLive = LIVE_API ? describe : describe.skip;

/** A phone with backup on and one walk backed up, plus the website signed in to the same account. */
async function phoneAndWeb(
  server: ChainServer,
  account: string,
  check: string
): Promise<{ p: ChainPhone; web: WebPortal } | null> {
  const p = await server.phone(account, 'phone');
  await addActivity(p.c, 'rec-walk', 'walk', WALK);
  await turnBackupOn(p.c);
  expect(await p.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 1, lastError: null });
  // A second code for the same address: waits out the one-a-minute limit, as a user would.
  const web = await webSignIn(LIVE_API!, p.address!);
  if (isPending(web)) {
    notYet('live API', check, web);
    return null;
  }
  return { p, web };
}

/** The phone after the server dropped its session: backup stops and waits, its data stays. */
async function expectSignedOutPhoneKeepsData(p: ChainPhone, before: Awaited<ReturnType<typeof phoneSnapshot>>) {
  expect(await p.server.signedIn()).toBe(false);
  await addActivity(p.c, 'rec-run', 'run', RUN);
  await p.c.cloudBackup.run.whenIdle();
  expect(await p.c.cloudBackup.status.execute()).toMatchObject({ lastError: 'auth', unsynced: 1 });
  expect(await p.c.cloudBackup.run.execute({ now: true })).toEqual({ kind: 'skipped', reason: 'waiting-for-token' });
  const now = await phoneSnapshot(p.c);
  expect(now.activities.filter((x) => x.id !== 'rec-run')).toEqual(before.activities);
  expect(now.cells).toBeGreaterThanOrEqual(before.cells);
}

describeLive('sync chain, phone ↔ web portal', () => {
  let server: ChainServer;
  beforeAll(() => {
    server = liveServer(LIVE_API!);
  });

  it('W1: backup and Apple Health choices on the phone show on Privacy & data; "Sign out" on the phone in the devices list stops its backup', async () => {
    const both = await phoneAndWeb(server, 'w1', 'W1 phone ↔ web');
    if (!both) {
      return;
    }
    const { p, web } = both;
    expect(await web.account()).toMatchObject({ email: p.address });
    expect(await web.backupPanel()).toEqual({ backup: 'on', health: false });
    const devices = await web.devices();
    expect(devices.filter((d) => d.client === 'phone' && !d.current)).toHaveLength(1);
    expect(devices.filter((d) => d.client === 'browser' && d.current)).toHaveLength(1);

    expect(await p.c.cloudBackup.includeHealth.execute(true)).toEqual({ kind: 'ok' });
    expect(await web.backupPanel()).toEqual({ backup: 'on', health: true });
    expect(await p.c.cloudBackup.includeHealth.execute(false)).toEqual({ kind: 'ok' });
    expect(await web.backupPanel()).toEqual({ backup: 'on', health: false });
    expect(await p.c.cloudBackup.disable.execute()).toEqual({ kind: 'ok' });
    expect(await web.backupPanel()).toMatchObject({ backup: 'withdrawn' });
    await turnBackupOn(p.c);
    expect(await p.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 1, lastError: null });
    expect(await web.backupPanel()).toMatchObject({ backup: 'on' });
    expect(await p.server.activities()).toHaveLength(1);

    const before = await phoneSnapshot(p.c);
    const phone = devices.find((d) => d.client === 'phone')!;
    expect(await web.signOutDevice(phone.id)).toBe(204);
    expect(await web.signedIn()).toBe(true);
    expect((await web.devices()).map((d) => d.client)).toEqual(['browser']);
    await expectSignedOutPhoneKeepsData(p, before);
  });

  it("W2: signing out on the website leaves the phone alone; an export from the phone uses up the day's export on the website", async () => {
    const both = await phoneAndWeb(server, 'w2', 'W2 web sign-out and export');
    if (!both) {
      return;
    }
    const { p, web } = both;
    expect(await p.requestExport!()).toBe('requested');
    // One export a day per account, wherever it was asked for.
    expect(await web.requestExport()).toBe(429);

    expect(await web.signOut()).toBe(204);
    expect(web.cookieCleared()).toBe(true);
    expect(await web.signedIn()).toBe(false);
    expect(await p.server.signedIn()).toBe(true);
    await addActivity(p.c, 'rec-run', 'run', RUN);
    await p.c.cloudBackup.run.whenIdle();
    expect((await p.server.activities()).map((a) => a.id).sort()).toEqual(['rec-run', 'rec-walk']);
  });

  it('W3: "Sign out everywhere" on the website signs out the phone and the browser; the phone keeps everything', async () => {
    const both = await phoneAndWeb(server, 'w3', 'W3 web sign out everywhere');
    if (!both) {
      return;
    }
    const { p, web } = both;
    const before = await phoneSnapshot(p.c);
    expect(await web.signOutEverywhere('all')).toBe(204);
    expect(web.cookieCleared()).toBe(true);
    expect(await web.signedIn()).toBe(false);
    await expectSignedOutPhoneKeepsData(p, before);
  });

  it('W4: deleting the account on the website erases the server copy and signs the phone out; the phone keeps everything', async () => {
    const both = await phoneAndWeb(server, 'w4', 'W4 web delete account');
    if (!both) {
      return;
    }
    const { p, web } = both;
    const before = await phoneSnapshot(p.c);
    expect(await web.deleteAccount()).toBe(204);
    expect(web.cookieCleared()).toBe(true);
    expect(await web.account()).toBeNull();
    await expectSignedOutPhoneKeepsData(p, before);
  });
});
