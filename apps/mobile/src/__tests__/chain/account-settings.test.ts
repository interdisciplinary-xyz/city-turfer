/**
 * Sync chain, account settings from the phone (docs/plans/sync-chain-testing-2026-10-22.md, A1–A3):
 * name, e-mail and password changed in the phone's Account tab, checked from the account's other
 * sessions and from backup. Live API only; against an API without account settings every scenario
 * reports pending.
 */
import { chainAddress, type ChainServer, LIVE_API, LIVE_CODE, liveServer } from '@/test-support/chain/chain-server';
import { addActivity, notYet } from '@/test-support/chain/scenario';

jest.setTimeout(300_000);

const WALK = 'walk-2k.gpx';
const RUN = 'run-5k-outliers-pause.gpx';
/** Not in the dev server's breached-password list. */
const PASSWORD = 'chain-walk-the-city-2026';
const describeLive = LIVE_API ? describe : describe.skip;

describeLive('sync chain, account settings from the phone', () => {
  let server: ChainServer;
  beforeAll(() => {
    server = liveServer(LIVE_API!);
  });

  it('A1: a name changed on the phone is what every other session of the account reads', async () => {
    const a = await server.phone('a1', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A1 name', missing);
      return;
    }
    expect(await a.account!.rename('Ola')).toBe(200);
    const b = await server.phone('a1', 'phone-b');
    expect(await b.account!.me()).toMatchObject({ name: 'Ola' });
    expect(await a.account!.rename('  ')).toBe(200); // blank clears it
    expect(await b.account!.me()).toMatchObject({ name: null });
  });

  it('A2: an e-mail change keeps the backup and the phone that made it; every other session is signed out', async () => {
    const a = await server.phone('a2', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A2 e-mail change', missing);
      return;
    }
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    expect(await a.c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    // Turning backup on records the consent; the next run uploads (the app starts one at once).
    expect(await a.c.cloudBackup.run.execute({ now: true })).toMatchObject({
      kind: 'done',
      report: { uploaded: 1, failed: 0 },
    });
    const b = await server.phone('a2', 'phone-b');
    expect(await b.server.signedIn()).toBe(true);

    const newAddress = chainAddress('a2-new');
    expect(await a.account!.requestStepUpCode()).toBe(202);
    expect(await a.account!.requestEmailChange(newAddress, LIVE_CODE)).toBe(202);
    expect(await a.account!.confirmEmailChange(newAddress, LIVE_CODE)).toBe(200);

    expect(await a.account!.me()).toMatchObject({ email: newAddress });
    expect(await b.server.signedIn()).toBe(false);
    // Same account id: the phone that made the change keeps backing up into the same copy.
    await addActivity(a.c, 'rec-run', 'run', RUN);
    await a.c.cloudBackup.run.whenIdle();
    expect((await a.server.activities()).map((x) => x.id).sort()).toEqual(['rec-run', 'rec-walk']);
    expect(a.refusedWrites()).toEqual([]);

    // A new phone signing in with the new address finds that copy.
    const c = await server.phone(newAddress, 'phone-c');
    expect(await c.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 2 });
  });

  it('A3: setting a password signs out the other sessions; a new phone signs in with it and finds the backup', async () => {
    const a = await server.phone('a3', 'phone-a');
    const missing = await a.account!.missing();
    if (missing) {
      notYet('live API', 'A3 password', missing);
      return;
    }
    await addActivity(a.c, 'rec-walk', 'walk', WALK);
    expect(await a.c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    // Turning backup on records the consent; the next run uploads (the app starts one at once).
    expect(await a.c.cloudBackup.run.execute({ now: true })).toMatchObject({
      kind: 'done',
      report: { uploaded: 1, failed: 0 },
    });
    const b = await server.phone('a3', 'phone-b');

    expect(await a.account!.requestStepUpCode()).toBe(202);
    expect(await a.account!.setPassword(PASSWORD, LIVE_CODE)).toBe(204);
    expect(await a.account!.me()).toMatchObject({ hasPassword: true });
    expect(await a.server.signedIn()).toBe(true);
    expect(await b.server.signedIn()).toBe(false);

    const c = await server.phone('a3', 'phone-c', { password: PASSWORD });
    expect(await c.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 1 });
  });
});
