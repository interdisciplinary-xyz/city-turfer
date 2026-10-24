/**
 * Sync chain, cloud backup for the local profiles (docs/decisions/local-profile-backup-2026-10-24.md,
 * LP1-LP3): admin@ and demo@cityturfer.com link their server account with an e-mailed code, back up,
 * and a password sign-in afterwards opens the profile on the phone without server credentials.
 * Live API only: the chain's API is the local dev server, which accepts the fixed code for these two
 * addresses and seeds the demo account's Gdansk history by itself (see local-profile-phone.ts).
 */
import { planGdanskDemo } from '@cityturfer/core/demo';

import { seedGdanskDemo } from '@/dev/gdansk-demo';
import { LIVE_API, LIVE_CODE } from '@/test-support/chain/chain-server';
import { localProfilePhone } from '@/test-support/chain/local-profile-phone';
import { addActivity, settleBackup } from '@/test-support/chain/scenario';

jest.setTimeout(480_000);

const WALK = 'walk-2k.gpx';
const RUN = 'run-5k-outliers-pause.gpx';
const describeLive = LIVE_API ? describe : describe.skip;

const idsOf = (xs: { id: string }[] | null) => (xs ?? []).map((x) => x.id).sort();

describeLive('sync chain, cloud backup for the local profiles', () => {
  it('LP1 + LP2 + LP3 (admin): the code links the profile and backs it up; a demo-… activity stays on the phone; the password opens it without server credentials until relinked', async () => {
    const phone = localProfilePhone(LIVE_API!, LIVE_CODE);
    expect(await phone.passwordSignIn('admin')).toMatchObject({ kind: 'signed-in' });
    const c = await phone.container('admin');
    await addActivity(c, 'rec-walk', 'walk', WALK);
    await addActivity(c, 'demo-chain-on-admin', 'walk', WALK);

    // Before the code: the profile is linkable, but nothing can leave the phone.
    expect(await phone.identity.backupLinkTarget.execute('admin')).toEqual({
      email: 'admin@cityturfer.com',
      linked: false,
    });
    expect(await phone.serverActivities('admin')).toBeNull();
    expect(await c.cloudBackup.run.execute({ now: true })).toMatchObject({ kind: 'skipped' });
    expect(phone.writes()).toBe(0);

    // The wrong code is refused and links nothing.
    await expect(phone.identity.requestBackupLinkCode.execute('admin')).resolves.toMatchObject({ kind: 'sent' });
    expect(await phone.identity.linkSignedInProfile.execute('admin', '123456')).toEqual({ kind: 'invalid-code' });
    expect(await phone.serverActivities('admin')).toBeNull();

    // The right code links it, and backup turns on and uploads the recording, not the demo id.
    const linked = await phone.linkByCode('admin');
    expect(linked).toMatchObject({ kind: 'linked', user: { id: 'admin', accountId: expect.any(String) } });
    expect(await phone.identity.backupLinkTarget.execute('admin')).toMatchObject({ linked: true });
    expect(await c.cloudBackup.enable.execute()).toMatchObject({ kind: 'ok' });
    await settleBackup(c);
    const onServer = await phone.serverActivities('admin');
    expect(idsOf(onServer)).toEqual(['rec-walk']);
    expect(onServer![0]).toMatchObject({ source: 'recording' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ lastError: null });

    // Sign out, then the app password: same profile, same data, no server credentials, no uploads.
    expect(await phone.signOut()).toEqual({ kind: 'signed-out' });
    expect(await phone.passwordSignIn('admin')).toMatchObject({ kind: 'signed-in', user: { id: 'admin' } });
    expect(await phone.identity.backupLinkTarget.execute('admin')).toEqual({
      email: 'admin@cityturfer.com',
      linked: false,
    });
    expect(await phone.identity.accountBearer.execute('admin')).toBeNull();
    expect((await c.activityLog.list.execute(10)).map((a) => a.id).sort()).toEqual(['demo-chain-on-admin', 'rec-walk']);
    await addActivity(c, 'rec-run', 'run', RUN);
    const before = phone.writes();
    expect(await c.cloudBackup.run.execute({ now: true })).toMatchObject({ kind: 'skipped' });
    expect(phone.writes()).toBe(before);

    // A new code links again, and the queued recording goes up; the demo id still does not.
    expect(await phone.linkByCode('admin')).toMatchObject({ kind: 'linked' });
    // The link screen then calls setEnabled(true) again (backup was already on): the card must not
    // keep the "sign in to back up" error of the runs that waited for a code.
    expect(await c.cloudBackup.enable.execute()).toMatchObject({ kind: 'ok' });
    await settleBackup(c);
    expect(await c.cloudBackup.status.execute()).toMatchObject({ lastError: null, hasToken: true });
    expect(idsOf(await phone.serverActivities('admin'))).toEqual(['rec-run', 'rec-walk']);
  });

  it('LP3 (demo): linking uploads the generated Gdansk history as import, and a rerun creates no duplicates', async () => {
    const phone = localProfilePhone(LIVE_API!, LIVE_CODE);
    expect(await phone.passwordSignIn('demo')).toMatchObject({ kind: 'signed-in' });
    const c = await phone.container('demo');
    await seedGdanskDemo(c);
    // Ids the server's own demo seed does not have, so a first upload from the phone is proven.
    await addActivity(c, 'demo-chain-extra-1', 'walk', WALK);
    await addActivity(c, 'demo-chain-extra-2', 'run', RUN);
    const planIds = planGdanskDemo(0).map((p) => p.id);

    expect(await phone.linkByCode('demo')).toMatchObject({ kind: 'linked', user: { id: 'demo' } });
    // The API's dev seed fills demo@ on start, in the background: wait for it, then upload over it.
    const newest = planIds[planIds.length - 1];
    for (let i = 0; i < 120 && !idsOf(await phone.serverActivities('demo')).includes(newest); i++) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(await c.cloudBackup.enable.execute()).toMatchObject({ kind: 'ok' });
    await settleBackup(c);

    const first = (await phone.serverActivities('demo'))!;
    const want = [...planIds, 'demo-chain-extra-1', 'demo-chain-extra-2'].sort();
    expect(idsOf(first)).toEqual(want);
    expect(new Set(first.map((x) => x.source))).toEqual(new Set(['import']));
    expect(await c.cloudBackup.status.execute()).toMatchObject({
      backedUp: want.length,
      total: want.length,
      lastError: null,
    });

    // Rerun: same ids, nothing new sent.
    const before = phone.log.filter((x) => x.method === 'PUT' && x.path.startsWith('/v1/activities/')).length;
    await settleBackup(c);
    const second = (await phone.serverActivities('demo'))!;
    expect(idsOf(second)).toEqual(want);
    expect(phone.log.filter((x) => x.method === 'PUT' && x.path.startsWith('/v1/activities/')).length).toBe(before);
  });
});
