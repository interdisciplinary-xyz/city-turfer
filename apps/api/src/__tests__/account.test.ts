import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ApiLog } from '../deps';
import { BREACH_CHECK_TIMEOUT_MS, HibpBreachedPasswords } from '../identity/breached-passwords';
import { OneTimeCodes } from '../identity/codes';
import { MemoryMailer } from '../identity/mailer';
import { backupApp, closeSharedDb, codeIn, TEST_AUTH_SECRET, TOKENS } from './support';

/**
 * Account settings (contract 0.5.0, docs/decisions/account-settings-2026-10-22.md): name, e-mail,
 * optional password, step-up codes, sessions signed out, security mails. Addresses are made up
 * (example.com, RFC 2606).
 */

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

const ANIA = 'ania@example.com';
const NEW = 'ania.nowak@example.com';
const BOREK = 'borek@example.com';
const PASSWORD = 'tram stops past the old town';
const MINUTE = 61_000;

type Row = Record<string, unknown>;
const rows = async (query: ReturnType<typeof sql>) => ((await h.db.execute(query)) as unknown as { rows: Row[] }).rows;

/** Signs in and moves the clock a minute on (so a second sign-in code for the address may follow). */
async function account(email = ANIA, ip?: string): Promise<string> {
  const token = await h.signIn(email, ip);
  h.clock.t += MINUTE;
  return token;
}

/** Asks for a step-up code and reads it from the mail to `email`. */
async function stepUp(token: string, email = ANIA): Promise<string> {
  const res = await h.call('POST', '/v1/me/step-up/codes', { token });
  expect(res.status).toBe(202);
  h.clock.t += MINUTE;
  return codeIn(h.mailer.lastTo(email)?.text);
}

const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

const me = async (token: string) => (await h.call('GET', '/v1/me', { token })).json();

describe('GET and PATCH /v1/me: the name', () => {
  it('answers name null, no password, and the deprecated displayName falling back to the id', async () => {
    const token = await account();
    const user = await me(token);
    expect(user).toEqual({
      id: expect.any(String),
      email: ANIA,
      name: null,
      displayName: user.id,
      hasPassword: false,
      passwordChangedAt: null,
      createdAt: expect.any(String),
    });
  });

  it('sets the name with the core rule, mirrors it into auth_users, and a blank name clears it', async () => {
    const token = await account();
    const res = await h.call('PATCH', '/v1/me', { token, body: { name: '  Ania \t Nowak ' } });
    expect(res.status).toBe(200);
    const user = await res.json();
    expect(user).toMatchObject({ name: 'Ania Nowak', displayName: 'Ania Nowak', email: ANIA });
    const [mirror] = await rows(
      sql`SELECT a.name AS auth_name, u.display_name FROM auth_users a JOIN users u USING (id)`
    );
    expect(mirror).toEqual({ auth_name: 'Ania Nowak', display_name: 'Ania Nowak' });

    const cleared = await (await h.call('PATCH', '/v1/me', { token, body: { name: '   ' } })).json();
    expect(cleared).toMatchObject({ name: null, displayName: user.id });
    const [after] = await rows(
      sql`SELECT a.name AS auth_name, u.display_name FROM auth_users a JOIN users u USING (id)`
    );
    expect(after).toEqual({ auth_name: '', display_name: null });
  });

  it('refuses a name over 40 characters or with control characters (422, the core codes)', async () => {
    const token = await account();
    const long = await h.call('PATCH', '/v1/me', { token, body: { name: 'a'.repeat(41) } });
    expect(long.status).toBe(422);
    expect(await long.json()).toMatchObject({ code: 'display-name.too-long' });
    const control = await h.call('PATCH', '/v1/me', { token, body: { name: 'Ania\u0007' } });
    expect(control.status).toBe(422);
    expect(await control.json()).toMatchObject({ code: 'display-name.invalid' });
    // Far past 40 the core rule still answers (the schema's cap only bounds the body).
    const longer = await h.call('PATCH', '/v1/me', { token, body: { name: 'a'.repeat(300) } });
    expect(longer.status).toBe(422);
    expect(await longer.json()).toMatchObject({ code: 'display-name.too-long' });
    // 40 code points (emoji are two UTF-16 units each) are fine.
    expect((await h.call('PATCH', '/v1/me', { token, body: { name: '🏃'.repeat(40) } })).status).toBe(200);
  });

  it('shows the new name on a second device', async () => {
    const phone = await account();
    const browser = await h.signIn(ANIA, '198.51.100.20');
    await h.call('PATCH', '/v1/me', { token: phone, body: { name: 'Ania' } });
    expect(await me(browser)).toMatchObject({ name: 'Ania' });
  });
});

describe('device tokens', () => {
  it('get 403 identity.account-required on every account-settings route; GET /v1/me still works', async () => {
    const calls: [string, string, unknown][] = [
      ['PATCH', '/v1/me', { name: 'Admin' }],
      ['POST', '/v1/me/step-up/codes', {}],
      ['POST', '/v1/me/email/codes', { newEmail: NEW, stepUpCode: '123456' }],
      ['POST', '/v1/me/email', { newEmail: NEW, code: '123456' }],
      ['PUT', '/v1/me/password', { newPassword: PASSWORD, stepUpCode: '123456' }],
      ['DELETE', '/v1/me/password', { stepUpCode: '123456' }],
    ];
    for (const [method, path, body] of calls) {
      const res = await h.call(method, path, { token: TOKENS.admin, body });
      expect([method, path, res.status]).toEqual([method, path, 403]);
      expect(await res.json()).toMatchObject({ code: 'identity.account-required' });
    }
    expect(h.mailer.sent).toHaveLength(0);
    expect((await h.call('GET', '/v1/me', { token: TOKENS.admin })).status).toBe(200);
  });
});

describe('POST /v1/me/step-up/codes', () => {
  it('mails a 6-digit code to the current address, stored encrypted, also without a body', async () => {
    const token = await account();
    const res = await h.call('POST', '/v1/me/step-up/codes', { token });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    const mail = h.mailer.lastTo(ANIA);
    expect(mail?.subject).toMatch(/confirmation code/);
    const code = codeIn(mail?.text);
    const stored = await rows(sql`SELECT identifier, value FROM auth_verifications WHERE identifier LIKE 'step-up-%'`);
    expect(stored).toHaveLength(1);
    expect(String(stored[0].value)).not.toContain(code);
  });

  it('has its own one-a-minute bucket but shares the 10-minute cap with sign-in codes (A5)', async () => {
    const token = await h.signIn(ANIA);
    // The sign-in code went out this minute; a step-up code may still follow at once.
    expect((await h.call('POST', '/v1/me/step-up/codes', { token })).status).toBe(202);
    const soon = await h.call('POST', '/v1/me/step-up/codes', { token });
    expect(soon.status).toBe(429);
    expect(await soon.json()).toMatchObject({ code: 'auth.rate-limited' });
    expect(Number(soon.headers.get('retry-after'))).toBeGreaterThan(0);
    h.clock.t += MINUTE;
    expect((await h.call('POST', '/v1/me/step-up/codes', { token })).status).toBe(202);
    h.clock.t += MINUTE;
    // Sign-in code + two step-up codes in 10 minutes: a fourth code of either kind is refused.
    expect((await h.call('POST', '/v1/me/step-up/codes', { token })).status).toBe(429);
    const signInCode = await h.call('POST', '/v1/auth/codes', { token: null, body: { email: ANIA } });
    expect(signInCode.status).toBe(429);
    expect(h.mailer.sent.filter((m) => m.to === ANIA)).toHaveLength(3);
  });

  it('lets the first sensitive change follow a code sign-in at once', async () => {
    const token = await h.signIn(ANIA);
    const res = await h.call('POST', '/v1/me/step-up/codes', { token });
    expect(res.status).toBe(202);
    const stepUpCode = codeIn(h.mailer.lastTo(ANIA)?.text);
    expect(
      (await h.call('PUT', '/v1/me/password', { token, body: { newPassword: PASSWORD, stepUpCode } })).status
    ).toBe(204);
  });

  it('counts concurrent wrong codes one by one: three at once burn the code', async () => {
    const token = await account();
    const code = await stepUp(token);
    const results = await Promise.all(
      [0, 1, 2].map(() => h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: wrong(code) } }))
    );
    expect(results.map((r) => r.status)).toEqual([401, 401, 401]);
    expect((await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: code } })).status).toBe(401);
    expect(await rows(sql`SELECT id FROM auth_verifications WHERE identifier LIKE 'step-up-%'`)).toHaveLength(0);
  });

  it('keeps the try count in place when the same code is mailed again', async () => {
    const token = await account();
    const first = await stepUp(token);
    await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: wrong(first) } });
    // The same code is mailed again while valid; its try count is kept in place, one row only.
    const again = await stepUp(token);
    expect(again).toBe(first);
    const stored = await rows(sql`SELECT value FROM auth_verifications WHERE identifier LIKE 'step-up-%'`);
    expect(stored).toHaveLength(1);
    expect(String(stored[0].value)).toMatch(/:1$/);
    expect((await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: first } })).status).toBe(204);
  });

  it('logs the mail failure by kind only and still answers 202', async () => {
    const events: Record<string, unknown>[] = [];
    const log: ApiLog = { request: () => undefined, event: (e) => events.push(e) };
    const failing = new MemoryMailer();
    const app = await backupApp({ log, mailer: failing });
    const token = await app.signIn(ANIA);
    app.clock.t += MINUTE;
    failing.send = () => Promise.reject(new Error('down'));
    expect((await app.call('POST', '/v1/me/step-up/codes', { token })).status).toBe(202);
    expect(events).toEqual([{ msg: 'auth.code-not-sent' }]);
  });
});

describe('changing the e-mail', () => {
  it('moves both e-mail columns in one go, signs out the other sessions and tells the old address', async () => {
    const phone = await account();
    const browser = await account(ANIA, '198.51.100.20');
    const { id } = await me(phone);
    const stepUpCode = await stepUp(phone);

    const asked = await h.call('POST', '/v1/me/email/codes', {
      token: phone,
      body: { newEmail: 'Ania.Nowak@Example.com', stepUpCode },
    });
    expect(asked.status).toBe(202);
    expect(await asked.json()).toEqual({});
    const code = codeIn(h.mailer.lastTo(NEW)?.text);

    const changed = await h.call('POST', '/v1/me/email', { token: phone, body: { newEmail: NEW, code } });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ id, email: NEW });
    const [row] = await rows(
      sql`SELECT a.email AS auth_email, a.email_verified, u.email FROM auth_users a JOIN users u USING (id)`
    );
    expect(row).toEqual({ auth_email: NEW, email_verified: true, email: NEW });
    // Pending codes of either address and of the change are gone.
    expect(await rows(sql`SELECT id FROM auth_verifications`)).toHaveLength(0);

    // The caller's session stays; the other one is signed out.
    expect((await h.call('GET', '/v1/me', { token: phone })).status).toBe(200);
    expect((await h.call('GET', '/v1/me', { token: browser })).status).toBe(401);

    const notice = h.mailer.lastTo(ANIA);
    expect(notice?.subject).toBe('Your CityTurfer email address was changed');
    expect(notice?.text).not.toContain(NEW);
    expect(notice?.text).not.toMatch(/https?:\/\//);

    // The new address signs in to the same account; the old one would start a new, empty one.
    h.clock.t += 10 * MINUTE;
    expect(await me(await h.signIn(NEW, '198.51.100.30'))).toMatchObject({ id, email: NEW });
  });

  it('refuses an invalid or unchanged address (422) before spending the step-up code', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    const invalid = await h.call('POST', '/v1/me/email/codes', {
      token,
      body: { newEmail: 'not-an-email', stepUpCode },
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ code: 'email.invalid' });
    const same = await h.call('POST', '/v1/me/email/codes', {
      token,
      body: { newEmail: ' ANIA@example.com ', stepUpCode },
    });
    expect(same.status).toBe(422);
    expect(await same.json()).toMatchObject({ code: 'email.unchanged' });
    expect((await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode } })).status).toBe(
      202
    );
  });

  it('refuses a wrong, reused or expired step-up code (401) and burns it after three wrong tries', async () => {
    const token = await account();
    const ask = (stepUpCode: string, newEmail = NEW) =>
      h.call('POST', '/v1/me/email/codes', { token, body: { newEmail, stepUpCode } });

    // Wrong ×3 burns it: even the right code fails afterwards.
    let code = await stepUp(token);
    for (let i = 0; i < 3; i++) {
      const res = await ask(wrong(code));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'auth.invalid-code' });
    }
    expect((await ask(code)).status).toBe(401);

    // Single use: the second request with the same code fails.
    h.clock.t += 10 * MINUTE;
    code = await stepUp(token);
    expect((await ask(code)).status).toBe(202);
    h.clock.t += MINUTE;
    expect((await ask(code, 'ania.second@example.com')).status).toBe(401);

    // Expired after 10 minutes (Better Auth keeps code times on the real clock: age the row).
    h.clock.t += 10 * MINUTE;
    code = await stepUp(token);
    await h.db.execute(
      sql`UPDATE auth_verifications SET expires_at = now() - interval '1 minute' WHERE identifier LIKE 'step-up-%'`
    );
    expect((await ask(code)).status).toBe(401);
  });

  it('answers 202 for a taken address and mails "in use" there, never a code; the confirm step is 401', async () => {
    await account(BOREK, '198.51.100.40');
    const token = await account();
    const stepUpCode = await stepUp(token);
    const before = h.mailer.sent.length;
    const res = await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: BOREK, stepUpCode } });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    const mails = h.mailer.sent.slice(before);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: BOREK, subject: 'This address already has a CityTurfer account' });
    expect(mails[0].text).not.toMatch(/\b\d{6}\b/);
    expect(mails[0].text).not.toContain(ANIA);

    // Without the code nobody learns the address is taken: 401, as for any wrong code.
    const confirm = await h.call('POST', '/v1/me/email', { token, body: { newEmail: BOREK, code: '123456' } });
    expect(confirm.status).toBe(401);
    expect(await confirm.json()).toMatchObject({ code: 'auth.invalid-code' });
    expect(await me(token)).toMatchObject({ email: ANIA });
  });

  it('answers 409 email.taken only after the code proved the new inbox (taken in between)', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode } });
    const code = codeIn(h.mailer.lastTo(NEW)?.text);
    h.clock.t += MINUTE;
    // Someone signs up with that address before the change is confirmed.
    await h.signIn(NEW, '198.51.100.50');

    // A wrong code is still 401; the right one shows the conflict.
    expect((await h.call('POST', '/v1/me/email', { token, body: { newEmail: NEW, code: wrong(code) } })).status).toBe(
      401
    );
    const taken = await h.call('POST', '/v1/me/email', { token, body: { newEmail: NEW, code } });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ code: 'email.taken' });
    expect(await me(token)).toMatchObject({ email: ANIA });
  });

  it('ties the new-address code to the account and the address', async () => {
    const ania = await account();
    const borek = await account(BOREK, '198.51.100.40');
    const stepUpCode = await stepUp(ania);
    await h.call('POST', '/v1/me/email/codes', { token: ania, body: { newEmail: NEW, stepUpCode } });
    const code = codeIn(h.mailer.lastTo(NEW)?.text);
    // Another account cannot use it, nor can it confirm another address.
    expect((await h.call('POST', '/v1/me/email', { token: borek, body: { newEmail: NEW, code } })).status).toBe(401);
    expect(
      (await h.call('POST', '/v1/me/email', { token: ania, body: { newEmail: 'other@example.com', code } })).status
    ).toBe(401);
    expect((await h.call('POST', '/v1/me/email', { token: ania, body: { newEmail: NEW, code } })).status).toBe(200);
  });

  it('counts the new address in its own code limits, before spending the step-up code', async () => {
    const ania = await account();
    const borek = await account(BOREK, '198.51.100.40');
    const ask = (token: string, stepUpCode: string) =>
      h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode } });
    // Two accounts aim at one stranger's inbox: 3 codes per address per 10 minutes, whoever asks.
    expect((await ask(ania, await stepUp(ania))).status).toBe(202);
    expect((await ask(borek, await stepUp(borek, BOREK))).status).toBe(202);
    expect((await ask(ania, await stepUp(ania))).status).toBe(202);
    const stepUpCode = await stepUp(borek, BOREK);
    const limited = await ask(borek, stepUpCode);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'auth.rate-limited' });
    expect(h.mailer.sent.filter((m) => m.to === NEW)).toHaveLength(3);
    // The refused request did not spend the step-up code.
    h.clock.t += 10 * MINUTE;
    expect((await ask(borek, stepUpCode)).status).toBe(202);
  });

  it('does not count wrong step-up codes against the new address', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    for (let i = 0; i < 2; i++) {
      expect(
        (await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode: wrong(stepUpCode) } }))
          .status
      ).toBe(401);
    }
    expect((await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode } })).status).toBe(
      202
    );
  });
});

describe('passwords', () => {
  const setPassword = (token: string, newPassword: string, stepUpCode: string) =>
    h.call('PUT', '/v1/me/password', { token, body: { newPassword, stepUpCode } });
  const signInWithPassword = (email: string, password: string, ip = '203.0.113.7') =>
    h.call('POST', '/v1/auth/sign-in', { token: null, body: { email, password }, headers: { 'X-Real-IP': ip } });

  it('sets a password (204), signs out the other sessions, mails, and then signs in with it', async () => {
    const phone = await account();
    const browser = await h.signIn(ANIA, '198.51.100.20');
    const { id } = await me(phone);
    h.clock.t += MINUTE;
    const res = await setPassword(phone, PASSWORD, await stepUp(phone));
    expect(res.status).toBe(204);

    expect(await me(phone)).toMatchObject({ hasPassword: true, passwordChangedAt: new Date(h.clock.t).toISOString() });
    expect((await h.call('GET', '/v1/me', { token: browser })).status).toBe(401);
    expect(h.mailer.lastTo(ANIA)?.subject).toBe('An account password was added to your CityTurfer account');

    // Hashed (scrypt), never stored as given.
    const [credential] = await rows(sql`SELECT provider_id, account_id, password FROM auth_accounts`);
    expect(credential).toMatchObject({ provider_id: 'credential', account_id: id });
    expect(String(credential.password)).not.toContain(PASSWORD);

    const signed = await signInWithPassword(ANIA, PASSWORD);
    expect(signed.status).toBe(200);
    expect(signed.headers.get('cache-control')).toBe('no-store');
    const session = await signed.json();
    expect(session).toEqual({ token: expect.any(String), expiresAt: expect.any(String), user: { id, email: ANIA } });
    expect(await me(session.token)).toMatchObject({ id });
    // The code sign-in keeps working beside it.
    h.clock.t += 10 * MINUTE;
    expect(await me(await h.signIn(ANIA, '198.51.100.21'))).toMatchObject({ id });
  });

  it('replaces the password and says so in the mail', async () => {
    const token = await account();
    await setPassword(token, PASSWORD, await stepUp(token));
    h.clock.t += 10 * MINUTE;
    expect((await setPassword(token, 'a second long passphrase', await stepUp(token))).status).toBe(204);
    expect(h.mailer.lastTo(ANIA)?.subject).toBe('Your CityTurfer account password was changed');
    expect((await signInWithPassword(ANIA, PASSWORD)).status).toBe(401);
    expect((await signInWithPassword(ANIA, 'a second long passphrase')).status).toBe(200);
  });

  it('refuses short, long and breached passwords (422) without spending the step-up code', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    const short = await setPassword(token, 'eleven char', stepUpCode);
    expect(short.status).toBe(422);
    expect(await short.json()).toMatchObject({ code: 'password.too-short' });
    const long = await setPassword(token, 'x'.repeat(129), stepUpCode);
    expect(long.status).toBe(422);
    expect(await long.json()).toMatchObject({ code: 'password.too-long' });
    const breached = await setPassword(token, 'password1234', stepUpCode);
    expect(breached.status).toBe(422);
    expect(await breached.json()).toMatchObject({ code: 'password.breached' });
    // 128 emoji are 128 characters (256 UTF-16 units): accepted, with the same step-up code.
    expect((await setPassword(token, '🔑'.repeat(128), stepUpCode)).status).toBe(204);
    expect((await signInWithPassword(ANIA, '🔑'.repeat(128))).status).toBe(200);
  });

  it('answers a locked-out caller 429 before any breach check', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    // 10 failed sign-ins for the address today (two 10-minute windows, many IPs).
    for (let i = 0; i < 10; i++) {
      const res = await h.call('POST', '/v1/auth/sign-in', {
        token: null,
        body: { email: ANIA, code: '123456' },
        headers: { 'X-Real-IP': `198.51.100.${i}` },
      });
      expect(res.status).toBe(401);
      if (i === 4) {
        h.clock.t += 11 * MINUTE;
      }
    }
    const checks = h.breached.checks;
    for (const newPassword of ['password1234', PASSWORD]) {
      const res = await setPassword(token, newPassword, stepUpCode);
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ code: 'auth.rate-limited' });
    }
    expect(h.breached.checks).toBe(checks);
  });

  it('caps breach checks at 10 per account per 10 minutes', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    const checks = h.breached.checks;
    for (let i = 0; i < 10; i++) {
      expect((await setPassword(token, 'password1234', stepUpCode)).status).toBe(422);
    }
    const capped = await setPassword(token, PASSWORD, stepUpCode);
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ code: 'auth.rate-limited' });
    expect(h.breached.checks).toBe(checks + 10);
    // The refusals did not spend the step-up code (code times run on the real clock: still valid).
    h.clock.t += 10 * MINUTE;
    expect((await setPassword(token, PASSWORD, stepUpCode)).status).toBe(204);
  });

  it('refuses a wrong or reused step-up code (401)', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    const res = await setPassword(token, PASSWORD, wrong(stepUpCode));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'auth.invalid-code' });
    expect((await setPassword(token, PASSWORD, stepUpCode)).status).toBe(204);
    expect((await setPassword(token, 'a second long passphrase', stepUpCode)).status).toBe(401);
    expect((await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode } })).status).toBe(401);
  });

  it('lets only one of two concurrent requests spend the same step-up code', async () => {
    const token = await account();
    const stepUpCode = await stepUp(token);
    const results = await Promise.all([
      setPassword(token, PASSWORD, stepUpCode),
      setPassword(token, 'a second long passphrase', stepUpCode),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 401]);
  });

  it('removes the password (204, mailed); the password no longer signs in; idempotent', async () => {
    const token = await account();
    await setPassword(token, PASSWORD, await stepUp(token));
    h.clock.t += 10 * MINUTE;
    const res = await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: await stepUp(token) } });
    expect(res.status).toBe(204);
    expect(await me(token)).toMatchObject({ hasPassword: false, passwordChangedAt: null });
    expect(h.mailer.lastTo(ANIA)?.subject).toBe('Your CityTurfer account password was removed');
    expect(await rows(sql`SELECT id FROM auth_accounts`)).toHaveLength(0);
    expect((await signInWithPassword(ANIA, PASSWORD)).status).toBe(401);

    h.clock.t += 10 * MINUTE;
    const sent = h.mailer.sent.length;
    expect(
      (await h.call('DELETE', '/v1/me/password', { token, body: { stepUpCode: await stepUp(token) } })).status
    ).toBe(204);
    // Only the step-up code went out: nothing was removed, so no notice.
    expect(h.mailer.sent.length).toBe(sent + 1);
  });

  it('answers a wrong password, no password and an unknown account with the same 401', async () => {
    const withPassword = await account();
    await setPassword(withPassword, PASSWORD, await stepUp(withPassword));
    await account(BOREK, '198.51.100.40'); // an account without a password

    const bodies = [];
    for (const [email, password] of [
      [ANIA, 'not the right passphrase'],
      [BOREK, PASSWORD],
      ['nobody@example.com', PASSWORD],
    ]) {
      const res = await signInWithPassword(email, password);
      expect(res.status).toBe(401);
      bodies.push(await res.json());
    }
    expect(bodies[0]).toMatchObject({ code: 'auth.invalid-credentials' });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    // A password never creates an account.
    expect(await rows(sql`SELECT id FROM auth_users WHERE email = 'nobody@example.com'`)).toHaveLength(0);
  });

  it('counts failed passwords in the failed-sign-in buckets of codes (A5)', async () => {
    const token = await account();
    await setPassword(token, PASSWORD, await stepUp(token));
    // 10 failures a day per address, codes and passwords together, across IPs and windows.
    for (let i = 0; i < 5; i++) {
      expect((await signInWithPassword(ANIA, 'not the right passphrase', `198.51.100.${i}`)).status).toBe(401);
      expect(
        (
          await h.call('POST', '/v1/auth/sign-in', {
            token: null,
            body: { email: ANIA, code: '123456' },
            headers: { 'X-Real-IP': `198.51.100.${i}` },
          })
        ).status
      ).toBe(401);
      h.clock.t += 11 * MINUTE;
    }
    const limited = await signInWithPassword(ANIA, PASSWORD, '203.0.113.99');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'auth.rate-limited' });
    h.clock.t += 24 * 3600_000;
    expect((await signInWithPassword(ANIA, PASSWORD, '203.0.113.99')).status).toBe(200);
  });

  it('limits failed password sign-ins to 20 per IP per 10 minutes', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await signInWithPassword(`p${i}@example.com`, PASSWORD)).status).toBe(401);
    }
    expect((await signInWithPassword('p20@example.com', PASSWORD)).status).toBe(429);
    expect((await signInWithPassword('p20@example.com', PASSWORD, '198.51.100.77')).status).toBe(401);
  });

  it('answers a body that is not JSON with 400 invalid-request, not 500', async () => {
    const res = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      raw: '{"email":',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'invalid-request' });
  });

  it('keeps the code sign-in body working for old phones and refuses a body that is neither', async () => {
    expect((await h.call('POST', '/v1/auth/sign-in', { token: null, body: { email: ANIA } })).status).toBe(400);
    expect(
      (await h.call('POST', '/v1/auth/sign-in', { token: null, body: { email: ANIA, code: '123456' } })).status
    ).toBe(401);
  });
});

describe('DELETE /v1/me', () => {
  it('removes the password and every pending account-settings code with the account', async () => {
    const token = await account();
    await h.call('PUT', '/v1/me/password', { token, body: { newPassword: PASSWORD, stepUpCode: await stepUp(token) } });
    h.clock.t += 10 * MINUTE;
    await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode: await stepUp(token) } });
    await stepUp(token); // one more pending step-up code
    expect(await rows(sql`SELECT id FROM auth_accounts`)).toHaveLength(1);
    expect((await rows(sql`SELECT id FROM auth_verifications`)).length).toBeGreaterThanOrEqual(2);

    expect((await h.call('DELETE', '/v1/me', { token })).status).toBe(204);
    for (const table of ['auth_users', 'auth_sessions', 'auth_accounts', 'auth_verifications', 'users']) {
      const [{ n }] = await rows(sql.raw(`SELECT count(*)::int AS n FROM ${table}`));
      expect([table, n]).toEqual([table, 0]);
    }
    expect(
      (await h.call('POST', '/v1/auth/sign-in', { token: null, body: { email: ANIA, password: PASSWORD } })).status
    ).toBe(401);
  });
});

describe('OneTimeCodes under concurrent writes', () => {
  const ID = 'step-up-otp-ania@example.com';

  /** Runs `meanwhile` once, right before the next try-count write (inside the read-then-write gap). */
  async function beforeNextSwap(meanwhile: () => Promise<unknown>) {
    const { adapter } = await h.auth.$context;
    const original = adapter.updateMany;
    adapter.updateMany = async (data) => {
      adapter.updateMany = original;
      await meanwhile();
      return original(data);
    };
  }

  it('leaves a code issued during a wrong try usable', async () => {
    const codes = new OneTimeCodes(h.auth, TEST_AUTH_SECRET);
    const first = await codes.issue(ID, '111111');
    let fresh = '';
    await beforeNextSwap(async () => {
      // The first code is replaced in the gap (as after it burnt or expired) and the new one mailed.
      await h.db.execute(sql`DELETE FROM auth_verifications`);
      fresh = await codes.issue(ID, '222222');
    });
    expect(await codes.consume(ID, wrong(first))).toBe(false);
    expect(fresh).toBe('222222');
    expect(await rows(sql`SELECT id FROM auth_verifications`)).toHaveLength(1);
    expect(await codes.consume(ID, fresh)).toBe(true);
  });

  it('counts both of two interleaved wrong tries', async () => {
    const codes = new OneTimeCodes(h.auth, TEST_AUTH_SECRET);
    const code = await codes.issue(ID, '111111');
    await beforeNextSwap(() => codes.consume(ID, '000001'));
    expect(await codes.consume(ID, '000002')).toBe(false);
    // Two tries spent: the third wrong one burns the code.
    expect(await codes.consume(ID, '000003')).toBe(false);
    expect(await codes.consume(ID, code)).toBe(false);
  });
});

describe('privacy', () => {
  it('never logs a name, an address, a code or a password', async () => {
    const lines: string[] = [];
    const log: ApiLog = {
      request: (e) => lines.push(JSON.stringify(e)),
      event: (e) => lines.push(JSON.stringify(e)),
    };
    const app = await backupApp({ log });
    h = app;
    const token = await account();
    await h.call('PATCH', '/v1/me', { token, body: { name: 'Ania Nowak' } });
    const stepUpCode = await stepUp(token);
    await h.call('POST', '/v1/me/email/codes', { token, body: { newEmail: NEW, stepUpCode } });
    const code = codeIn(h.mailer.lastTo(NEW)?.text);
    await h.call('POST', '/v1/me/email', { token, body: { newEmail: NEW, code } });
    h.clock.t += MINUTE;
    await h.call('PUT', '/v1/me/password', {
      token,
      body: { newPassword: PASSWORD, stepUpCode: await stepUp(token, NEW) },
    });
    await h.call('POST', '/v1/auth/sign-in', { token: null, body: { email: NEW, password: 'wrong passphrase!' } });
    const text = lines.join('\n');
    expect(lines.length).toBeGreaterThan(5);
    for (const secret of ['Ania Nowak', ANIA, NEW, code, stepUpCode, PASSWORD, 'wrong passphrase!']) {
      expect([secret, text.includes(secret)]).toEqual([secret, false]);
    }
  });
});

describe('HibpBreachedPasswords', () => {
  // SHA-1("password1234") = E6B6AFBD6D76BB5D2041542D7D2E3FAC5BB05593.
  const SUFFIX = 'FBD6D76BB5D2041542D7D2E3FAC5BB05593';

  it('sends only the 5-character prefix, with padding, and finds the suffix', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:12345\r\n`, { status: 200 });
    }) as unknown as typeof fetch;
    expect(await new HibpBreachedPasswords(fake).isBreached('password1234')).toBe(true);
    expect(calls[0].url).toBe('https://api.pwnedpasswords.com/range/E6B6A');
    expect((calls[0].init.headers as Record<string, string>)['Add-Padding']).toBe('true');
    expect(String(calls[0].init.body ?? '')).toBe('');
  });

  it('treats padding lines (count 0) and absent suffixes as not breached', async () => {
    const fake = (async () => new Response(`${SUFFIX}:0\r\n`, { status: 200 })) as unknown as typeof fetch;
    expect(await new HibpBreachedPasswords(fake).isBreached('password1234')).toBe(false);
  });

  it('fails open on an error, a non-200 or the timeout, reporting only that it skipped', async () => {
    let skipped = 0;
    const onSkipped = () => {
      skipped++;
    };
    const down = (() => Promise.reject(new Error('network'))) as unknown as typeof fetch;
    const busy = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const slow = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    expect(await new HibpBreachedPasswords(down, onSkipped).isBreached(PASSWORD)).toBe(false);
    expect(await new HibpBreachedPasswords(busy, onSkipped).isBreached(PASSWORD)).toBe(false);
    const started = Date.now();
    expect(await new HibpBreachedPasswords(slow, onSkipped).isBreached(PASSWORD)).toBe(false);
    expect(Date.now() - started).toBeLessThan(BREACH_CHECK_TIMEOUT_MS + 1000);
    expect(skipped).toBe(3);
  });
});
