import { AccountProfiles } from '../../domain/account-profiles';
import { userId } from '../../domain/user';
import { NEW_INBOX_CODE, setup, STEP_UP_CODE } from './test-support/identity-fixture';

async function signedIn(opts: Parameters<typeof setup>[0] = {}) {
  const t = setup({ names: true, ...opts });
  await t.api.verifyCode.execute('ola@example.com', '000000');
  return t;
}

describe('Me › Account: what it shows', () => {
  it('an account: name, email and password state from the server; the name is cached for offline', async () => {
    const t = await signedIn();
    t.gateway.accounts.get('u1')!.name = 'Ola';
    expect(await t.api.accountSettings.execute()).toEqual({
      kind: 'account',
      email: 'ola@example.com',
      name: 'Ola',
      hasPassword: false,
      passwordChangedAt: null,
    });
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.accountSettings.execute()).toEqual({ kind: 'offline' });
    expect(await t.api.currentUser.execute()).toMatchObject({ id: 'a-u1', name: 'Ola' });
  });

  it('an email changed elsewhere (the web portal) is followed on this phone', async () => {
    const t = await signedIn();
    t.gateway.accounts.get('u1')!.email = 'ola@new.example';
    await t.api.accountSettings.execute();
    expect(t.profiles()?.entries[0].email).toBe('ola@new.example');
    expect(t.credentials()?.account.email).toBe('ola@new.example');
  });

  it('a local profile: only its name, kept on this phone', async () => {
    const t = setup({ names: true });
    expect(await t.api.accountSettings.execute()).toEqual({ kind: 'not-signed-in' });
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.accountSettings.execute()).toEqual({ kind: 'local', name: null });
    expect(t.gateway.calls).toEqual([]);
  });

  it('an account whose session the keychain lost is not signed in (no request sent)', async () => {
    const t = await signedIn();
    t.forgetCredentials();
    expect(await t.api.accountSettings.execute()).toEqual({ kind: 'not-signed-in' });
    expect(await t.api.updateName.execute('Ola')).toEqual({ kind: 'not-signed-in' });
    expect(t.gateway.calls).not.toContain('me');
    expect(t.gateway.calls).not.toContain('name');
  });
});

describe('changing the name', () => {
  it('an account: validated first, saved on the server, the signed-in user carries it', async () => {
    const t = await signedIn();
    expect(await t.api.updateName.execute('x'.repeat(41))).toEqual({
      kind: 'field-error',
      code: 'display-name.too-long',
    });
    expect(await t.api.updateName.execute('a\u0007b')).toEqual({ kind: 'field-error', code: 'display-name.invalid' });
    expect(t.gateway.calls).not.toContain('name');
    expect(await t.api.updateName.execute('  Ola   Nowak ')).toMatchObject({
      kind: 'saved',
      user: { id: 'a-u1', name: 'Ola Nowak' },
    });
    expect(t.gateway.accounts.get('u1')!.name).toBe('Ola Nowak');
    expect(await t.api.updateName.execute('   ')).toMatchObject({ kind: 'saved', user: { name: null } });
    expect(t.gateway.accounts.get('u1')!.name).toBeNull();
  });

  it('offline or rate-limited: nothing changes and nothing is queued', async () => {
    const t = await signedIn();
    t.gateway.fail = { kind: 'offline' };
    expect(await t.api.updateName.execute('Ola')).toEqual({ kind: 'offline' });
    t.gateway.fail = { kind: 'rate-limited', retryAfterS: 30 };
    expect(await t.api.updateName.execute('Ola')).toEqual({ kind: 'rate-limited', retryAfterS: 30 });
    t.gateway.fail = null;
    expect(t.gateway.accounts.get('u1')!.name).toBeNull();
    expect((await t.api.currentUser.execute())?.name).toBeUndefined();
  });

  it('a local profile: stored on this phone only, never sent', async () => {
    const t = setup({ names: true });
    await t.api.signIn.execute('admin@cityturfer.com', 'admin1234');
    expect(await t.api.updateName.execute('Michał')).toMatchObject({
      kind: 'saved',
      user: { id: 'admin', name: 'Michał' },
    });
    expect(t.gateway.calls).toEqual([]);
    await t.api.signOut.execute();
    expect(await t.api.signIn.execute('admin@cityturfer.com', 'admin1234')).toMatchObject({
      user: { id: 'admin', name: 'Michał' },
    });
    expect(await t.api.accountSettings.execute()).toEqual({ kind: 'local', name: 'Michał' });
  });

  it('a local profile without a name store cannot keep one', async () => {
    const t = setup();
    await t.api.signIn.execute('admin@cityturfer.com', 'admin1234');
    expect(await t.api.updateName.execute('Michał')).toEqual({ kind: 'unavailable' });
  });
});

describe('changing the email', () => {
  it('step-up code to the current address → new address → code from the new inbox', async () => {
    const t = await signedIn();
    expect(await t.api.requestStepUpCode.execute()).toEqual({ kind: 'sent', email: 'ola@example.com' });
    expect(await t.api.requestEmailChange.execute(' Ola@New.Example ', ` ${STEP_UP_CODE} `)).toEqual({
      kind: 'sent',
      newEmail: 'ola@new.example',
    });
    expect(await t.api.confirmEmailChange.execute('ola@new.example', '999999')).toEqual({ kind: 'invalid-code' });
    expect(await t.api.confirmEmailChange.execute('ola@new.example', NEW_INBOX_CODE)).toMatchObject({
      kind: 'changed',
      user: { id: 'a-u1', email: 'ola@new.example', accountId: 'u1' },
    });
    expect(t.profiles()?.entries).toEqual([
      { accountId: 'u1', email: 'ola@new.example', profileId: 'a-u1', deleted: false },
    ]);
    expect(t.credentials()?.account).toEqual({ id: 'u1', email: 'ola@new.example' });
    // The same profile opens with the new address.
    await t.api.signOut.execute();
    expect(await t.api.verifyCode.execute('ola@new.example', '000000')).toMatchObject({ user: { id: 'a-u1' } });
  });

  it('checks the new address first, and a step-up code works once', async () => {
    const t = await signedIn();
    await t.api.requestStepUpCode.execute();
    expect(await t.api.requestEmailChange.execute('nope', STEP_UP_CODE)).toEqual({
      kind: 'field-error',
      code: 'email.invalid',
    });
    expect(await t.api.requestEmailChange.execute('OLA@example.com', STEP_UP_CODE)).toEqual({
      kind: 'field-error',
      code: 'email.unchanged',
    });
    expect(await t.api.requestEmailChange.execute('a@new.example', '')).toEqual({ kind: 'invalid-code' });
    expect(t.gateway.calls.filter((c) => c.startsWith('email'))).toEqual([]);
    expect(await t.api.requestEmailChange.execute('a@new.example', STEP_UP_CODE)).toMatchObject({ kind: 'sent' });
    expect(await t.api.requestEmailChange.execute('b@new.example', STEP_UP_CODE)).toEqual({ kind: 'invalid-code' });
  });

  it('an address another account has: email-taken, and nothing changes here', async () => {
    const t = setup({ names: true });
    await t.api.verifyCode.execute('taken@example.com', '000000');
    await t.api.signOut.execute();
    await t.api.verifyCode.execute('ola@example.com', '000000');
    await t.api.requestStepUpCode.execute();
    await t.api.requestEmailChange.execute('taken@example.com', STEP_UP_CODE);
    expect(await t.api.confirmEmailChange.execute('taken@example.com', NEW_INBOX_CODE)).toEqual({
      kind: 'email-taken',
    });
    expect(t.credentials()?.account.email).toBe('ola@example.com');
  });

  it('needs a signed-in account; rate limits come through with Retry-After', async () => {
    const t = setup({ names: true });
    await t.api.signIn.execute('demo@cityturfer.com', 'demo1234');
    expect(await t.api.requestStepUpCode.execute()).toEqual({ kind: 'not-signed-in' });
    expect(await t.api.requestEmailChange.execute('a@b.cd', '1')).toEqual({ kind: 'not-signed-in' });
    expect(await t.api.confirmEmailChange.execute('a@b.cd', '1')).toEqual({ kind: 'not-signed-in' });
    const u = await signedIn();
    u.gateway.fail = { kind: 'rate-limited', retryAfterS: 600 };
    expect(await u.api.requestStepUpCode.execute()).toEqual({ kind: 'rate-limited', retryAfterS: 600 });
    u.gateway.fail = { kind: 'auth' };
    expect(await u.api.requestStepUpCode.execute()).toEqual({ kind: 'auth' });
  });
});

describe('the account password', () => {
  it('set, change and remove, each with a fresh step-up code', async () => {
    const t = await signedIn();
    expect(await t.api.setPassword.execute('short', STEP_UP_CODE)).toEqual({
      kind: 'field-error',
      code: 'password.too-short',
    });
    expect(await t.api.setPassword.execute('x'.repeat(129), STEP_UP_CODE)).toEqual({
      kind: 'field-error',
      code: 'password.too-long',
    });
    expect(t.gateway.calls).not.toContain('password');
    expect(await t.api.setPassword.execute('correct horse battery', STEP_UP_CODE)).toEqual({ kind: 'invalid-code' });
    await t.api.requestStepUpCode.execute();
    expect(await t.api.setPassword.execute('correct horse battery', STEP_UP_CODE)).toEqual({ kind: 'saved' });
    expect(await t.api.accountSettings.execute()).toMatchObject({
      hasPassword: true,
      passwordChangedAt: 1_760_000_000_000,
    });

    await t.api.requestStepUpCode.execute();
    expect(await t.api.setPassword.execute('password1234', STEP_UP_CODE)).toEqual({ kind: 'breached' });

    await t.api.requestStepUpCode.execute();
    expect(await t.api.removePassword.execute(` ${STEP_UP_CODE}`)).toEqual({ kind: 'removed' });
    expect(await t.api.removePassword.execute(STEP_UP_CODE)).toEqual({ kind: 'invalid-code' });
    expect(await t.api.accountSettings.execute()).toMatchObject({ hasPassword: false, passwordChangedAt: null });
  });

  it('keeps spaces: a password is never trimmed', async () => {
    const t = await signedIn();
    await t.api.requestStepUpCode.execute();
    await t.api.setPassword.execute('  twelve chars  ', STEP_UP_CODE);
    expect(t.gateway.accounts.get('u1')!.password).toBe('  twelve chars  ');
  });
});

describe('signing in with a password', () => {
  async function withPassword(opts: Parameters<typeof setup>[0] = {}) {
    const t = await signedIn(opts);
    await t.api.requestStepUpCode.execute();
    await t.api.setPassword.execute('correct horse battery', STEP_UP_CODE);
    await t.api.signOut.execute();
    return t;
  }

  it('goes on like a verified code: the same profile, the token kept', async () => {
    const t = await withPassword();
    expect(await t.api.signInWithPassword.execute(' Ola@Example.com ', 'correct horse battery')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'a-u1', accountId: 'u1' },
    });
    expect(t.session()).toBe('a-u1');
    expect(await t.api.accountBearer.execute('a-u1')).toMatchObject({ accountId: 'u1' });
  });

  it('a wrong password, no password or no account: all the same answer, nothing kept', async () => {
    const t = await withPassword();
    expect(await t.api.signInWithPassword.execute('ola@example.com', 'wrong password!')).toEqual({
      kind: 'invalid-credentials',
    });
    expect(await t.api.signInWithPassword.execute('nobody@example.com', 'correct horse battery')).toEqual({
      kind: 'invalid-credentials',
    });
    expect(await t.api.signInWithPassword.execute('ola@example.com', '')).toEqual({ kind: 'invalid-credentials' });
    expect(await t.api.signInWithPassword.execute('not an email', 'x')).toEqual({ kind: 'invalid-email' });
    expect(t.session()).toBeNull();
    expect(t.credentials()).toBeNull();
    t.gateway.fail = { kind: 'rate-limited', retryAfterS: 60 };
    expect(await t.api.signInWithPassword.execute('ola@example.com', 'correct horse battery')).toEqual({
      kind: 'rate-limited',
      retryAfterS: 60,
    });
  });

  it('on a phone with unclaimed local history it asks first, like a code', async () => {
    const t = setup({ names: true, adminHasHistory: true });
    await t.api.verifyCode.execute('founder@example.com', '000000');
    await t.api.chooseHistory.execute(false);
    await t.api.requestStepUpCode.execute();
    await t.api.setPassword.execute('correct horse battery', STEP_UP_CODE);
    await t.api.signOut.execute();
    // A second phone with its own unclaimed history: the same question.
    const phone2 = setup({ names: true, adminHasHistory: true, gateway: t.gateway });
    expect(await phone2.api.signInWithPassword.execute('founder@example.com', 'correct horse battery')).toEqual({
      kind: 'choose-history',
      email: 'founder@example.com',
    });
    expect(phone2.credentials()).toBeNull();
    expect(await phone2.api.chooseHistory.execute(true)).toMatchObject({ user: { id: 'admin', accountId: 'u1' } });
  });

  it('a local profile’s email signs in with its own password', async () => {
    const t = setup({ names: true });
    expect(await t.api.signInWithPassword.execute('demo@cityturfer.com', 'demo1234')).toMatchObject({
      kind: 'signed-in',
      user: { id: 'demo' },
    });
    expect(t.gateway.calls).toEqual([]);
  });
});

describe('AccountProfiles.emailChanged', () => {
  it('moves the active entry to the new address; a deleted one stays as it was', () => {
    const p = AccountProfiles.empty();
    p.link({ id: 'u1', email: 'a@b.cd' }, userId('admin'));
    p.accountDeleted('u1', true);
    p.link({ id: 'u2', email: 'x@b.cd' }, userId('a-u2'));
    p.emailChanged('u2', 'y@b.cd');
    p.emailChanged('u1', 'z@b.cd');
    expect(p.toState().entries).toEqual([
      { accountId: 'u1', email: 'a@b.cd', profileId: 'admin', deleted: true },
      { accountId: 'u2', email: 'y@b.cd', profileId: 'a-u2', deleted: false },
    ]);
  });
});
