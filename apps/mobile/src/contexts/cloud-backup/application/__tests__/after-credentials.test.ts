/**
 * After a local profile's credentials arrived (linked by an e-mailed code, LP1): Cloud Backup turns
 * backup on only when it was off with nothing pending, carries on when it was on, and delivers a
 * pending withdrawal without ever turning backup back on.
 */
import { phone, walk } from '@/test-support/backup-phone';

import { afterCredentialsPlan } from '../after-credentials';

const ACCOUNT = { token: 'secret-token', accountId: 'acct-1' };

describe('the plan once credentials arrived', () => {
  it('turns backup on only when it was off with nothing pending (the Turfer came to turn it on)', () => {
    expect(afterCredentialsPlan({ enabled: false, withdrawalPending: false })).toBe('enable');
  });

  it('never turns it back on when the Turfer had turned it off: delivers the withdrawal instead', () => {
    expect(afterCredentialsPlan({ enabled: false, withdrawalPending: true })).toBe('deliver-withdrawal');
  });

  it('already on (opened by password, LP2, or the session ran out): carries on', () => {
    expect(afterCredentialsPlan({ enabled: true, withdrawalPending: false })).toBe('resume');
  });
});

describe('AfterCredentialsArrived', () => {
  async function linked(options: { enabled: boolean; offWithoutCredentials?: boolean }) {
    const t = phone({ profile: 'admin', account: ACCOUNT, token: null });
    const c = await t.container();
    await c.add('rec-1', walk(0));
    if (options.enabled || options.offWithoutCredentials) {
      expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
      await c.cloudBackup.run.execute();
    }
    t.account.value = null; // a password sign-in (LP2): no server credentials
    if (options.offWithoutCredentials) {
      expect(await c.cloudBackup.disable.execute()).toEqual({ kind: 'failed', error: 'no-token' });
    }
    t.account.value = ACCOUNT; // the code linked the profile again
    return { t, c };
  }

  it('off with nothing pending: records the consent and turns backup on', async () => {
    const { t, c } = await linked({ enabled: false });
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'turned-on' });
    expect(t.server.consents.get('cloud-sync')).toMatchObject({ granted: true });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, withdrawalPending: false });
  });

  it('a failed consent leaves backup off and says why; trying again turns it on', async () => {
    const { t, c } = await linked({ enabled: false });
    t.server.failNext('setConsent', { kind: 'offline' });
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'failed', error: 'offline' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: false });
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'turned-on' });
  });

  it('on already: carries on, and forgets the error that said the credentials were missing', async () => {
    const { t, c } = await linked({ enabled: true });
    t.account.value = null;
    expect(await c.cloudBackup.run.execute()).toEqual({ kind: 'skipped', reason: 'no-token' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ lastError: 'no-token' });
    t.account.value = ACCOUNT;
    const consents = t.server.calls('setConsent').length;
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'carried-on' });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: true, lastError: null });
    expect(t.server.calls('setConsent')).toHaveLength(consents); // no new consent asked for
  });

  it('turned off without credentials: delivers the withdrawal, and backup stays off', async () => {
    const { t, c } = await linked({ enabled: false, offWithoutCredentials: true });
    expect(t.server.activities.has('rec-1')).toBe(true);
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'stayed-off', delivered: true });
    expect(t.server.activities.size).toBe(0);
    expect(t.server.consents.get('cloud-sync')).toMatchObject({ granted: false });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: false, withdrawalPending: false });
  });

  it('turned off without credentials, and the server can’t be reached: stays off, still pending', async () => {
    const { t, c } = await linked({ enabled: false, offWithoutCredentials: true });
    t.server.failNext('setConsent', { kind: 'offline' });
    expect(await c.cloudBackup.afterCredentials.execute()).toEqual({ kind: 'stayed-off', delivered: false });
    expect(await c.cloudBackup.status.execute()).toMatchObject({ enabled: false, withdrawalPending: true });
    expect(t.server.activities.has('rec-1')).toBe(true);
  });
});
