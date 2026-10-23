/**
 * Sync chain, account settings from the phone (docs/plans/sync-chain-testing-2026-10-22.md, A1–A4):
 * name, e-mail and password changed through the phone's own ApiAuthGateway (what the Account tab's
 * use cases call), checked from the account's other sessions (phones and the web portal) and from
 * backup. Live API only; against an API without account settings every scenario reports pending.
 */
import {
  chainAddress,
  type ChainServer,
  isPending,
  LIVE_API,
  LIVE_CODE,
  liveServer,
} from '@/test-support/chain/chain-server';
import { addActivity, notYet, turnBackupOn } from '@/test-support/chain/scenario';
import { type WebPortal, webSignIn } from '@/test-support/chain/web-portal';

jest.setTimeout(300_000);

const WALK = 'walk-2k.gpx';
const RUN = 'run-5k-outliers-pause.gpx';
/** Not in the dev server's breached-password list. */
const PASSWORD = 'chain-walk-the-city-2026';
const describeLive = LIVE_API ? describe : describe.skip;

/** The web portal signed in to the same account (waits out the one-code-a-minute limit). */
async function web(address: string, check: string): Promise<WebPortal | null> {
  const portal = await webSignIn(LIVE_API!, address);
  if (isPending(portal)) {
    notYet('live API', check, portal);
    return null;
  }
  return portal;
}

describeLive('sync chain, account settings from the phone', () => {
  let server: ChainServer;
  beforeAll(() => {
    server = liveServer(LIVE_API!);
  });

  it('A1: a name changed on the phone is what every other session of the account reads, the web portal included', async () => {
    const a = await server.phone('a1', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A1 name', missing);
      return;
    }
    expect(await a.account!.rename('Ola')).toEqual({ kind: 'saved', name: 'Ola' });
    const b = await server.phone('a1', 'phone-b');
    expect(await b.account!.me()).toMatchObject({ kind: 'me', me: { name: 'Ola' } });
    // The web portal's account panel reads the same name.
    const portal = await web(a.address!, 'A1 web name');
    if (portal) {
      expect(await portal.account()).toMatchObject({ name: 'Ola' });
    }
    expect(await a.account!.rename('  ')).toEqual({ kind: 'saved', name: null }); // blank clears it
    expect(await b.account!.me()).toMatchObject({ kind: 'me', me: { name: null } });
    if (portal) {
      expect(await portal.account()).toMatchObject({ name: null });
    }
  });

  it('A2 + A4: an e-mail change keeps the backup and the phone that made it; every other session, the web portal included, is signed out', async () => {
    const a = await server.phone('a2', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A2 e-mail change', missing);
      return;
    }
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    await turnBackupOn(a.c);
    expect(await a.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 1, lastError: null });
    const b = await server.phone('a2', 'phone-b');
    expect(await b.server.signedIn()).toBe(true);
    const portal = await web(a.address!, 'A4 web after e-mail change');
    if (portal) {
      expect(await portal.signedIn()).toBe(true);
    }

    const newAddress = chainAddress('a2-new');
    expect(await a.account!.requestStepUpCode()).toEqual({ kind: 'sent' });
    expect(await a.account!.requestEmailChange(newAddress, LIVE_CODE)).toEqual({ kind: 'sent' });
    expect(await a.account!.confirmEmailChange(newAddress, LIVE_CODE)).toEqual({ kind: 'changed', email: newAddress });

    expect(await a.account!.me()).toMatchObject({ kind: 'me', me: { email: newAddress } });
    expect(await b.server.signedIn()).toBe(false);
    // A4: the web portal is another session: signed out too, and told to drop its cookie.
    if (portal) {
      expect(await portal.signedIn()).toBe(false);
      expect(portal.cookieCleared()).toBe(true);
    }
    // Same account id: the phone that made the change keeps backing up into the same copy.
    await addActivity(a.c, 'rec-run', 'run', RUN);
    await a.c.cloudBackup.run.whenIdle();
    expect((await a.server.activities()).map((x) => x.id).sort()).toEqual(['rec-run', 'rec-walk']);
    expect(a.refusedWrites()).toEqual([]);

    // A new phone signing in with the new address finds that copy.
    const c = await server.phone(newAddress, 'phone-c');
    expect(await c.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 2 });
  });

  it('A3 + A4: setting a password signs out the other sessions, the web portal included; a new phone signs in with it and finds the backup', async () => {
    const a = await server.phone('a3', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A3 password', missing);
      return;
    }
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    await turnBackupOn(a.c);
    expect(await a.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 1, total: 1, lastError: null });
    const b = await server.phone('a3', 'phone-b');
    const portal = await web(a.address!, 'A4 web after password set');

    expect(await a.account!.requestStepUpCode()).toEqual({ kind: 'sent' });
    expect(await a.account!.setPassword(PASSWORD, LIVE_CODE)).toEqual({ kind: 'saved' });
    expect(await a.account!.me()).toMatchObject({ kind: 'me', me: { hasPassword: true } });
    expect(await a.server.signedIn()).toBe(true);
    expect(await b.server.signedIn()).toBe(false);
    // A4: setting a password signs the web portal out as well.
    if (portal) {
      expect(await portal.signedIn()).toBe(false);
    }

    const c = await server.phone('a3', 'phone-c', { password: PASSWORD });
    expect(await c.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 1 });
  });
});
