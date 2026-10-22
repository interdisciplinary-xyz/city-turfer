import { AccountProfiles, profileIdForAccount } from '../../domain/account-profiles';
import { type User, type UserId, userId } from '../../domain/user';
import { createIdentityApi } from '../../index';
import type {
  AccountFailure,
  AccountGateway,
  AccountProfileStore,
  AccountSession,
  AuthGateway,
  CredentialStore,
  SessionStore,
} from '../ports';

const ADMIN: User = { id: userId('admin'), email: 'admin@cityturfer.com', displayName: 'Admin' };

const DEMO: User = { id: userId('demo'), email: 'demo@cityturfer.com', displayName: 'Ola' };

const localAuth: AuthGateway = {
  signIn: async (e, p) =>
    e.value === ADMIN.email && p === 'admin1234'
      ? { kind: 'signed-in', user: ADMIN }
      : e.value === DEMO.email && p === 'demo1234'
        ? { kind: 'signed-in', user: DEMO }
        : { kind: 'invalid-credentials' },
  userById: async (id) => (id === 'admin' ? ADMIN : id === 'demo' ? DEMO : null),
  hasLocalAccount: (e) => e.value === ADMIN.email || e.value === 'demo@cityturfer.com',
};

/** The account server in memory: code 000000 works for any email; one account per email. */
class FakeAccounts implements AccountGateway {
  readonly calls: string[] = [];
  readonly revoked: string[] = [];
  readonly deleted: string[] = [];
  fail: AccountFailure | null = null;
  private n = 0;
  private readonly ids = new Map<string, string>();
  async requestCode(email: { value: string }) {
    this.calls.push(`code ${email.value}`);
    return this.fail ?? { kind: 'sent' as const };
  }
  async verifyCode(email: { value: string }, code: string) {
    this.calls.push(`verify ${email.value}`);
    if (this.fail) {
      return this.fail;
    }
    if (code !== '000000') {
      return { kind: 'invalid-code' as const };
    }
    const id = this.ids.get(email.value) ?? `u${++this.n}`;
    this.ids.set(email.value, id);
    return {
      kind: 'verified' as const,
      session: { token: `tok-${id}-${this.n}`, expiresAt: 9e15, account: { id, email: email.value } },
    };
  }
  async revoke(token: string) {
    if (this.fail) {
      return this.fail;
    }
    this.revoked.push(token);
    return { kind: 'revoked' as const };
  }
  async deleteAccount(token: string) {
    if (this.fail) {
      return this.fail;
    }
    this.deleted.push(token);
    for (const [email, id] of this.ids) {
      if (token.startsWith(`tok-${id}-`)) {
        this.ids.delete(email);
      }
    }
    return { kind: 'deleted' as const };
  }
  async requestExport() {
    return this.fail ?? { kind: 'requested' as const };
  }
}

function setup(opts: { adminHasHistory?: boolean; profiles?: ReturnType<AccountProfiles['toState']> } = {}) {
  let session: UserId | null = null;
  let credentials: AccountSession | null = null;
  let profiles: ReturnType<AccountProfiles['toState']> | null = opts.profiles ?? null;
  let recording = false;
  const sessions: SessionStore = {
    read: async () => session,
    write: async (id) => void (session = id),
    clear: async () => void (session = null),
  };
  const credentialStore: CredentialStore = {
    read: async () => credentials,
    save: async (s) => void (credentials = s),
    clear: async () => void (credentials = null),
  };
  const profileStore: AccountProfileStore = {
    read: async () => profiles,
    write: async (s) => void (profiles = s),
  };
  const gateway = new FakeAccounts();
  const history = { asked: 0 };
  const api = createIdentityApi(
    {
      auth: localAuth,
      sessions,
      accounts: {
        gateway,
        credentials: credentialStore,
        profiles: profileStore,
        history: {
          hasActivities: async (id) => {
            history.asked++;
            return id === 'admin' && (opts.adminHasHistory ?? false);
          },
        },
      },
    },
    async () => recording
  );
  return {
    api,
    gateway,
    history,
    session: () => session,
    credentials: () => credentials,
    profiles: () => profiles,
    setRecording: (r: boolean) => void (recording = r),
    /** Simulates a lost write of the profile map (e.g. the keychain failed mid sign-in). */
    forgetProfiles: () => void (profiles = null),
  };
}

describe('signing in with an email code', () => {
  it('local profiles keep their password; any other email gets a code', async () => {
    const t = setup();
    expect(await t.api.startSignIn.execute(' Admin@CityTurfer.com ')).toEqual({ kind: 'password' });
    expect(await t.api.startSignIn.execute('demo@cityturfer.com')).toEqual({ kind: 'password' });
    expect(await t.api.startSignIn.execute('ola@example.com')).toEqual({ kind: 'code-sent' });
    expect(await t.api.startSignIn.execute('not an email')).toEqual({ kind: 'invalid-email' });
    expect(t.gateway.calls).toEqual(['code ola@example.com']);
    t.gateway.fail = { kind: 'rate-limited', retryAfterS: 120 };
    expect(await t.api.startSignIn.execute('ola@example.com')).toEqual({ kind: 'rate-limited', retryAfterS: 120 });
  });

  it('a right code signs the account into a profile of its own and keeps the token', async () => {
    const t = setup();
    const r = await t.api.verifyCode.execute('ola@example.com', ' 000 000 ');
    expect(r).toEqual({
      kind: 'signed-in',
      user: { id: profileIdForAccount('u1'), email: 'ola@example.com', displayName: 'ola', accountId: 'u1' },
    });
    expect(t.session()).toBe('a-u1');
    expect(t.credentials()?.account).toEqual({ id: 'u1', email: 'ola@example.com' });
    expect(await t.api.accountBearer.execute('a-u1')).toEqual({ token: 'tok-u1-1', accountId: 'u1' });
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
  });

  it('a wrong code changes nothing', async () => {
    const t = setup();
    expect(await t.api.verifyCode.execute('ola@example.com', '123456')).toEqual({ kind: 'invalid-code' });
    expect(await t.api.verifyCode.execute('ola@example.com', '  ')).toEqual({ kind: 'invalid-code' });
    expect(t.session()).toBeNull();
    expect(t.credentials()).toBeNull();
  });

  it('first real sign-in on a phone with local history asks; yes links it (no copy)', async () => {
    const t = setup({ adminHasHistory: true });
    expect(await t.api.verifyCode.execute('founder@example.com', '000000')).toEqual({
      kind: 'choose-history',
      email: 'founder@example.com',
    });
    expect(t.session()).toBeNull(); // nobody signed in until the Turfer answers
    expect(t.credentials()).toBeNull(); // nor is the token kept before that
    expect(await t.api.chooseHistory.execute(true)).toMatchObject({
      kind: 'signed-in',
      user: { id: 'admin', accountId: 'u1' },
    });
    expect(t.session()).toBe('admin');
    expect(await t.api.currentUser.execute()).toMatchObject({
      id: 'admin',
      email: 'founder@example.com',
      accountId: 'u1',
    });

    // Signing in again later goes straight to that profile; nobody else can adopt it.
    await t.api.signOut.execute();
    expect(await t.api.verifyCode.execute('founder@example.com', '000000')).toMatchObject({ user: { id: 'admin' } });
    await t.api.signOut.execute();
    expect(await t.api.verifyCode.execute('other@example.com', '000000')).toMatchObject({ user: { id: 'a-u2' } });
  });

  it('without a pending sign-in there is nothing to choose', async () => {
    const t = setup({ adminHasHistory: true });
    expect(await t.api.chooseHistory.execute(true)).toEqual({ kind: 'no-pending' });
  });

  it('no keeps the local history apart: the account gets a profile of its own', async () => {
    const t = setup({ adminHasHistory: true });
    await t.api.verifyCode.execute('ola@example.com', '000000');
    expect(await t.api.chooseHistory.execute(false)).toMatchObject({ user: { id: 'a-u1' } });
    await t.api.signOut.execute();
    expect(await t.api.verifyCode.execute('ola@example.com', '000000')).toMatchObject({ user: { id: 'a-u1' } });
  });

  it('starts offline with the cached user: no token read, no network', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    const calls = t.gateway.calls.length;
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.currentUser.execute()).toMatchObject({ id: 'a-u1', email: 'ola@example.com' });
    expect(t.gateway.calls).toHaveLength(calls);
  });

  it('local profiles still sign in with a password, without an account', async () => {
    const t = setup();
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toMatchObject({ kind: 'signed-in' });
    expect(await t.api.currentUser.execute()).toEqual(ADMIN);
    expect(await t.api.accountBearer.execute('admin')).toBeNull();
  });
});

describe('the mock password after an account adopted the local history', () => {
  async function adopted() {
    const t = setup({ adminHasHistory: true });
    await t.api.verifyCode.execute('founder@example.com', '000000');
    await t.api.chooseHistory.execute(true);
    await t.api.signOut.execute();
    return t;
  }

  it('no longer opens the adopted profile: only the account’s own sign-in does', async () => {
    const t = await adopted();
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toEqual({ kind: 'linked-to-account' });
    expect(t.session()).toBeNull();
    expect(await t.api.currentUser.execute()).toBeNull();
    expect(await t.api.verifyCode.execute('founder@example.com', '000000')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'admin', accountId: 'u1' },
    });
  });

  it('nor once the account is deleted with its data kept here; deleting the data frees it again', async () => {
    const t = await adopted();
    await t.api.verifyCode.execute('founder@example.com', '000000');
    await t.api.deleteAccount.execute(true);
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toEqual({ kind: 'linked-to-account' });

    const u = await adopted();
    await u.api.verifyCode.execute('founder@example.com', '000000');
    expect(await u.api.deleteAccount.execute(false)).toEqual({ kind: 'deleted', profileId: 'admin' });
    expect(await u.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toMatchObject({ kind: 'signed-in' });
  });

  it('keeps the demo account and a wrong password as they were', async () => {
    const t = await adopted();
    expect(await t.api.signIn.execute('demo@cityturfer.com', 'demo1234')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'demo' },
    });
    expect(t.session()).toBe('demo');
    await t.api.signOut.execute();
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'nope')).toEqual({ kind: 'invalid-credentials' });
  });

  it('“Keep apart” leaves the admin password working', async () => {
    const t = setup({ adminHasHistory: true });
    await t.api.verifyCode.execute('ola@example.com', '000000');
    await t.api.chooseHistory.execute(false);
    await t.api.signOut.execute();
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toMatchObject({ kind: 'signed-in' });
  });
});

describe('signing out and deleting the account', () => {
  it('sign-out revokes the session (offline: still signs out) and forgets the token', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    t.setRecording(true);
    expect(await t.api.signOut.execute()).toEqual({ kind: 'recording-in-progress' });
    expect(t.session()).toBe('a-u1');
    t.setRecording(false);
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.signOut.execute()).toEqual({ kind: 'signed-out' });
    expect(t.credentials()).toBeNull();
    expect(t.session()).toBeNull();
    expect(await t.api.accountBearer.execute('a-u1')).toBeNull();
  });

  it('delete: offline changes nothing; deleted keeps the profile for the same email when asked', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.deleteAccount.execute(true)).toEqual({ kind: 'offline' });
    expect(t.session()).toBe('a-u1');
    t.gateway.fail = null;
    expect(await t.api.deleteAccount.execute(true)).toEqual({ kind: 'deleted', profileId: 'a-u1' });
    expect(t.session()).toBeNull();
    expect(t.credentials()).toBeNull();
    // A new account with the same email finds the kept data on this phone.
    expect(await t.api.verifyCode.execute('ola@example.com', '000000')).toMatchObject({
      user: { id: 'a-u1', accountId: 'u2' },
    });
  });

  it('delete answered 401 (session expired) changes nothing here and keeps the data', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    t.gateway.fail = { kind: 'auth' };
    expect(await t.api.deleteAccount.execute(false)).toEqual({ kind: 'auth' });
    expect(t.session()).toBe('a-u1');
    expect(t.credentials()).not.toBeNull();
    expect(t.profiles()?.entries).toHaveLength(1);
  });

  it('delete without keeping data forgets the profile; never during a recording', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    t.setRecording(true);
    expect(await t.api.deleteAccount.execute(false)).toEqual({ kind: 'recording-in-progress' });
    t.setRecording(false);
    expect(await t.api.deleteAccount.execute(false)).toEqual({ kind: 'deleted', profileId: 'a-u1' });
    expect(t.profiles()?.entries).toEqual([]);
    expect(await t.api.verifyCode.execute('ola@example.com', '000000')).toMatchObject({ user: { id: 'a-u2' } });
  });

  it('delete with no profile entry for the account still signs out and names the signed-in profile', async () => {
    const t = setup();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    t.forgetProfiles();
    expect(await t.api.deleteAccount.execute(false)).toEqual({ kind: 'deleted', profileId: 'a-u1' });
    expect(t.gateway.deleted).toHaveLength(1);
    expect(t.session()).toBeNull();
    expect(t.credentials()).toBeNull();
  });

  it('delete never names a local-only or another account’s profile as the one to forget', () => {
    const p = AccountProfiles.empty();
    p.link({ id: 'u1', email: 'a@b.cd' }, userId('admin'));
    expect(p.profileForDeletion('u1', userId('demo'))).toBe('admin');
    expect(p.profileForDeletion('u2', userId('admin'))).toBeNull();
    expect(p.profileForDeletion('u2', userId('demo'))).toBeNull();
    expect(p.profileForDeletion('u2', null)).toBeNull();
    expect(p.profileForDeletion('u2', userId('a-u2'))).toBe('a-u2');
  });

  it('export: asks the server to email a link; needs an account', async () => {
    const t = setup();
    expect(await t.api.requestDataExport.execute()).toEqual({ kind: 'not-signed-in' });
    await t.api.verifyCode.execute('ola@example.com', '000000');
    expect(await t.api.requestDataExport.execute()).toEqual({ kind: 'requested' });
  });
});

describe('AccountProfiles', () => {
  it('never links the demo profile, nor a profile another account holds', () => {
    const p = AccountProfiles.empty();
    expect(() => p.link({ id: 'u1', email: 'a@b.cd' }, userId('demo'))).toThrow('account.local-only-profile');
    p.link({ id: 'u1', email: 'a@b.cd' }, userId('admin'));
    expect(() => p.link({ id: 'u2', email: 'x@b.cd' }, userId('admin'))).toThrow('account.profile-taken');
  });

  it('a deleted account’s kept history is offered to no other account, only to its email', async () => {
    const t = setup({ adminHasHistory: true });
    await t.api.verifyCode.execute('founder@example.com', '000000');
    await t.api.chooseHistory.execute(true);
    expect(await t.api.deleteAccount.execute(true)).toEqual({ kind: 'deleted', profileId: 'admin' });

    // Another account is not asked to adopt it and gets a profile of its own.
    expect(await t.api.verifyCode.execute('other@example.com', '000000')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'a-u2', accountId: 'u2' },
    });
    await t.api.signOut.execute();
    expect(t.profiles()?.entries).toContainEqual({
      accountId: 'u1',
      email: 'founder@example.com',
      profileId: 'admin',
      deleted: true,
    });

    // The same email finds it again.
    expect(await t.api.verifyCode.execute('founder@example.com', '000000')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'admin', accountId: 'u3' },
    });
  });

  it('never links a deleted account’s kept profile to another email', () => {
    const p = AccountProfiles.empty();
    p.link({ id: 'u1', email: 'a@b.cd' }, userId('admin'));
    p.accountDeleted('u1', true);
    expect(p.placementFor({ id: 'u2', email: 'x@b.cd' }, true)).toEqual({ kind: 'known', profileId: 'a-u2' });
    expect(p.chosenProfile({ id: 'u2', email: 'x@b.cd' }, true)).toBe('a-u2');
    expect(() => p.link({ id: 'u2', email: 'x@b.cd' }, userId('admin'))).toThrow('account.profile-taken');
    expect(p.knownProfile({ id: 'u3', email: 'a@b.cd' })).toBe('admin');
    p.link({ id: 'u3', email: 'a@b.cd' }, userId('admin'));
    expect(p.toState().entries).toEqual([{ accountId: 'u3', email: 'a@b.cd', profileId: 'admin', deleted: false }]);
  });

  it('a profile id for any account id fits the profile rules', () => {
    expect(profileIdForAccount('AbC.12/xyz')).toBe('a-AbC_12_xyz');
    expect(profileIdForAccount('x'.repeat(100))).toHaveLength(64);
  });
});
