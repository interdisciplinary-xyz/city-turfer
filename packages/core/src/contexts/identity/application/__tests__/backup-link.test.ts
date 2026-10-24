import { AccountProfiles } from '../../domain/account-profiles';
import { createIdentityApi } from '../../index';
import { localAuth, setup } from './test-support/identity-fixture';

const ADMIN_EMAIL = 'admin@cityturfer.com';

/** The local admin profile opened with its password, then linked for backup by the code. */
async function linkedAdmin(opts: Parameters<typeof setup>[0] = {}) {
  const t = setup(opts);
  await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
  expect(await t.api.requestBackupLinkCode.execute('admin')).toEqual({ kind: 'sent', email: ADMIN_EMAIL });
  expect(await t.api.linkSignedInProfile.execute('admin', '000 000')).toMatchObject({ kind: 'linked' });
  return t;
}

describe('which profile may be linked for backup', () => {
  it('a local profile, to its own address, while no other address holds it', async () => {
    const t = setup();
    expect(await t.api.backupLinkTarget.execute('admin')).toEqual({ email: ADMIN_EMAIL, linked: false });
    expect(await t.api.backupLinkTarget.execute('demo')).toEqual({ email: 'demo@cityturfer.com', linked: false });
    expect(await t.api.backupLinkTarget.execute('a-u1')).toBeNull();

    const adopted = setup({ adminHasHistory: true });
    await adopted.api.verifyCode.execute('founder@example.com', '000000');
    await adopted.api.chooseHistory.execute(true);
    expect(await adopted.api.backupLinkTarget.execute('admin')).toBeNull();
    expect(await adopted.api.requestBackupLinkCode.execute('admin')).toEqual({ kind: 'not-local-profile' });
  });

  it('none without accounts in this build', async () => {
    const api = createIdentityApi(
      { auth: localAuth, sessions: { read: async () => null, write: async () => {}, clear: async () => {} } },
      async () => false
    );
    expect(await api.backupLinkTarget.execute('admin')).toBeNull();
    expect(await api.requestBackupLinkCode.execute('admin')).toEqual({ kind: 'accounts-unavailable' });
    expect(await api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'accounts-unavailable' });
  });
});

describe('RequestBackupLinkCode', () => {
  it('mails the code to the profile’s own address only; passes failures on', async () => {
    const t = setup();
    expect(await t.api.requestBackupLinkCode.execute('demo')).toEqual({ kind: 'sent', email: 'demo@cityturfer.com' });
    expect(await t.api.requestBackupLinkCode.execute('a-u1')).toEqual({ kind: 'not-local-profile' });
    expect(t.gateway.calls).toEqual(['code demo@cityturfer.com']);
    t.gateway.fail = { kind: 'rate-limited', retryAfterS: 60 };
    expect(await t.api.requestBackupLinkCode.execute('admin')).toEqual({ kind: 'rate-limited', retryAfterS: 60 });
  });
});

describe('LinkSignedInProfile', () => {
  it('links the address’s account to the signed-in profile: same profile, token kept', async () => {
    const t = await linkedAdmin();
    expect(t.session()).toBe('admin');
    expect(t.credentials()?.account).toEqual({ id: 'u1', email: ADMIN_EMAIL });
    expect(t.profiles()).toEqual({
      entries: [{ accountId: 'u1', email: ADMIN_EMAIL, profileId: 'admin', deleted: false }],
      current: 'u1',
    });
    expect(await t.api.accountBearer.execute('admin')).toEqual({ token: 'tok-u1-1', accountId: 'u1' });
    expect(await t.api.currentUser.execute()).toMatchObject({ id: 'admin', email: ADMIN_EMAIL, accountId: 'u1' });
    expect(await t.api.backupLinkTarget.execute('admin')).toEqual({ email: ADMIN_EMAIL, linked: true });
  });

  it('links the demo profile to demo@ the same way', async () => {
    const t = setup();
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.linkSignedInProfile.execute('demo', '000000')).toMatchObject({
      kind: 'linked',
      user: { id: 'demo', accountId: 'u1' },
    });
    expect(t.session()).toBe('demo');
    expect(t.gateway.calls).toContain('verify demo@cityturfer.com');
  });

  it('a wrong or empty code, offline and rate-limited change nothing', async () => {
    const t = setup();
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    expect(await t.api.linkSignedInProfile.execute('admin', '123456')).toEqual({ kind: 'invalid-code' });
    expect(await t.api.linkSignedInProfile.execute('admin', ' ')).toEqual({ kind: 'invalid-code' });
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'offline' });
    t.gateway.fail = { kind: 'rate-limited', retryAfterS: null };
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({
      kind: 'rate-limited',
      retryAfterS: null,
    });
    expect(t.credentials()).toBeNull();
    expect(t.profiles()).toBeNull();
    expect(t.session()).toBe('admin');
  });

  it('only for the profile signed in on this phone, and only a local one', async () => {
    const t = setup();
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'not-signed-in' });
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'not-signed-in' });
    expect(await t.api.linkSignedInProfile.execute('a-u1', '000000')).toEqual({ kind: 'not-local-profile' });
    expect(t.gateway.calls).toEqual([]);
  });

  it('refuses a session of another address and revokes it', async () => {
    const t = setup();
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    t.gateway.verifyCode = async () => ({
      kind: 'verified',
      session: { token: 'tok-x', expiresAt: 9e15, account: { id: 'u9', email: 'someone@example.com' } },
    });
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'email-mismatch' });
    expect(t.gateway.revoked).toEqual(['tok-x']);
    expect(t.credentials()).toBeNull();
    expect(t.profiles()).toBeNull();
  });

  it('refuses an account whose data already lives in another profile here', async () => {
    const t = setup({
      profiles: {
        entries: [{ accountId: 'u1', email: ADMIN_EMAIL, profileId: 'a-u1' as never, deleted: false }],
        current: null,
      },
    });
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toEqual({ kind: 'linked-elsewhere' });
    expect(t.gateway.revoked).toEqual(['tok-u1-1']);
    expect(t.credentials()).toBeNull();
  });

  it('a failed keychain write leaves it unlinked; a retry links cleanly', async () => {
    const t = setup();
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    t.breakKeychain();
    await expect(t.api.linkSignedInProfile.execute('admin', '000000')).rejects.toThrow('keychain write failed');
    expect(t.profiles()).toBeNull();
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
    t.breakKeychain(false);
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({ kind: 'linked' });
    expect(await t.api.accountBearer.execute('admin')).toEqual({ token: 'tok-u1-1', accountId: 'u1' });
  });
});

describe('LinkSignedInProfile leaves no server session orphaned', () => {
  /** A server that hands out a new token for every verified code. */
  function freshTokens(t: ReturnType<typeof setup>) {
    let n = 0;
    t.gateway.verifyCode = async () => ({
      kind: 'verified',
      session: { token: `tok-${++n}`, expiresAt: 9e15, account: { id: 'u1', email: ADMIN_EMAIL } },
    });
  }

  afterEach(() => jest.restoreAllMocks());

  it('a failed profile-map write revokes the new session; the retry replaces it cleanly', async () => {
    const t = setup();
    freshTokens(t);
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    t.breakProfileWrites();
    await expect(t.api.linkSignedInProfile.execute('admin', '000000')).rejects.toThrow('profile map write failed');
    expect(t.gateway.revoked).toEqual(['tok-1']);
    expect(await t.api.accountBearer.execute('admin')).toBeNull();

    t.breakProfileWrites(false);
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({ kind: 'linked' });
    expect(t.credentials()?.token).toBe('tok-2');
    expect(t.gateway.revoked).not.toContain('tok-2');
    expect(await t.api.accountBearer.execute('admin')).toEqual({ token: 'tok-2', accountId: 'u1' });
  });

  it('a failed keychain write revokes the new session and keeps the earlier one', async () => {
    const t = setup();
    freshTokens(t);
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    await t.api.linkSignedInProfile.execute('admin', '000000');
    t.breakKeychain();
    await expect(t.api.linkSignedInProfile.execute('admin', '000000')).rejects.toThrow('keychain write failed');
    expect(t.gateway.revoked).toEqual(['tok-2']);
    expect(await t.api.accountBearer.execute('admin')).toEqual({ token: 'tok-1', accountId: 'u1' });
  });

  it('linking again revokes the session it replaces in the slot', async () => {
    const t = setup();
    freshTokens(t);
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    await t.api.linkSignedInProfile.execute('admin', '000000');
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({ kind: 'linked' });
    expect(t.gateway.revoked).toEqual(['tok-1']);
    expect(t.credentials()?.token).toBe('tok-2');
  });

  it('an unexpected error after the code revokes the new session and is thrown', async () => {
    const t = setup();
    freshTokens(t);
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    jest.spyOn(AccountProfiles.prototype, 'linkOwn').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(t.api.linkSignedInProfile.execute('admin', '000000')).rejects.toThrow('boom');
    expect(t.gateway.revoked).toEqual(['tok-1']);
    expect(t.credentials()).toBeNull();
    expect(t.profiles()).toBeNull();
  });
});

describe('the linked profile keeps its name (same profile)', () => {
  it('the local default name, in the link result, currentUser, and after a password sign-in', async () => {
    const t = await linkedAdmin({ names: true });
    expect(await t.api.currentUser.execute()).toMatchObject({ id: 'admin', accountId: 'u1', name: 'Admin' });
    await t.api.signOut.execute();
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    expect(await t.api.currentUser.execute()).toMatchObject({ id: 'admin', name: 'Admin' });
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({
      kind: 'linked',
      user: { id: 'admin', accountId: 'u1', name: 'Admin', displayName: 'Admin' },
    });
  });

  it('Me › Account with no name on the server keeps it, and sends no name', async () => {
    const t = await linkedAdmin({ names: true });
    expect(await t.api.accountSettings.execute()).toMatchObject({ kind: 'account', name: null });
    expect(t.names.has('admin')).toBe(false);
    expect(t.gateway.calls).not.toContain('name');
    expect(await t.api.currentUser.execute()).toMatchObject({ name: 'Admin' });
  });

  it('a name kept on the phone (or chosen on the server) wins', async () => {
    const t = await linkedAdmin({ names: true });
    expect(await t.api.updateName.execute('Michał')).toMatchObject({ kind: 'saved', user: { name: 'Michał' } });
    expect(await t.api.currentUser.execute()).toMatchObject({ name: 'Michał' });
    // Cleared on purpose: "You", as for any profile.
    expect(await t.api.updateName.execute(' ')).toMatchObject({ kind: 'saved', user: { name: null } });
  });

  it('the demo profile keeps "Ola"; an adopted admin profile does not take "Admin"', async () => {
    const t = setup({ names: true });
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.linkSignedInProfile.execute('demo', '000000')).toMatchObject({ user: { name: 'Ola' } });

    const adopted = setup({ adminHasHistory: true, names: true });
    await adopted.api.verifyCode.execute('founder@example.com', '000000');
    const r = await adopted.api.chooseHistory.execute(true);
    expect(r).toMatchObject({ user: { id: 'admin', displayName: 'founder' } });
    expect(r.kind === 'signed-in' && r.user.name).toBeUndefined();
  });
});

describe('after linking: the password still opens the profile, on this phone only (LP2)', () => {
  it('sign-out, then the password: the same profile, no server session; the code links again', async () => {
    const t = await linkedAdmin();
    await t.api.signOut.execute();
    expect(t.gateway.revoked).toEqual(['tok-u1-1']);

    expect(await t.api.startSignIn.execute(ADMIN_EMAIL)).toEqual({ kind: 'password' });
    expect(await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'admin' },
    });
    expect(t.session()).toBe('admin');
    expect(t.credentials()).toBeNull();
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
    expect((await t.api.currentUser.execute())?.accountId).toBeUndefined();
    expect(await t.api.backupLinkTarget.execute('admin')).toEqual({ email: ADMIN_EMAIL, linked: false });

    // The same account links again: one entry, nothing duplicated.
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({ kind: 'linked' });
    expect(t.profiles()?.entries).toEqual([
      { accountId: 'u1', email: ADMIN_EMAIL, profileId: 'admin', deleted: false },
    ]);
  });

  it('the password over a kept session forgets and revokes it', async () => {
    const t = await linkedAdmin();
    expect(await t.api.signInWithPassword.execute(ADMIN_EMAIL, 'admin1234')).toMatchObject({ kind: 'signed-in' });
    expect(t.gateway.revoked).toEqual(['tok-u1-1']);
    expect(t.credentials()).toBeNull();
    expect(t.profiles()?.current).toBeNull();
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
  });

  it('demo, then admin on the same phone: one credential slot; demo’s session is revoked, never reused for admin', async () => {
    const t = setup();
    // One account per address, as on the server.
    t.gateway.verifyCode = async (email) => {
      const id = email.value.startsWith('demo@') ? 'u-demo' : 'u-admin';
      return {
        kind: 'verified',
        session: { token: `tok-${id}`, expiresAt: 9e15, account: { id, email: email.value } },
      };
    };
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.linkSignedInProfile.execute('demo', '000000')).toMatchObject({ kind: 'linked' });
    expect(await t.api.accountBearer.execute('demo')).toEqual({ token: 'tok-u-demo', accountId: 'u-demo' });
    // While demo is the linked one, admin's profile has no bearer at all (not demo's token).
    expect(await t.api.accountBearer.execute('admin')).toBeNull();

    await t.api.signOut.execute();
    await t.api.signIn.execute(ADMIN_EMAIL, 'admin1234');
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
    expect(await t.api.linkSignedInProfile.execute('admin', '000000')).toMatchObject({ kind: 'linked' });
    expect(t.gateway.revoked).toContain('tok-u-demo');
    expect(t.credentials()?.token).toBe('tok-u-admin');
    expect(await t.api.accountBearer.execute('admin')).toEqual({ token: 'tok-u-admin', accountId: 'u-admin' });
    expect(await t.api.accountBearer.execute('demo')).toBeNull();
  });

  it('a wrong password still opens nothing', async () => {
    const t = await linkedAdmin();
    await t.api.signOut.execute();
    expect(await t.api.signIn.execute(ADMIN_EMAIL, 'nope')).toEqual({ kind: 'invalid-credentials' });
    expect(t.session()).toBeNull();
  });

  it('a real account signing in afterwards gets a profile of its own', async () => {
    const t = await linkedAdmin({ adminHasHistory: true });
    await t.api.signOut.execute();
    expect(await t.api.verifyCode.execute('ola@example.com', '000000')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'a-u2', accountId: 'u2' },
    });
    expect(t.session()).toBe('a-u2');
  });
});
