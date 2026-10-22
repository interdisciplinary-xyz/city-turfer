import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PostgresRateLimiter } from '../db/rate-limits';
import { adopt } from '../identity/adopt';
import { createAuth } from '../identity/better-auth';
import { BrevoMailer, parseMailFrom } from '../identity/mailer';
import { IdentityService } from '../identity/use-cases';
import { checkProductionEnv, ConfigError, productionDeps } from '../wiring';
import { backupApp, closeSharedDb, codeIn, TEST_AUTH_SECRET, TOKENS } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

const EMAIL = 'ania@example.com';
const IP = { 'X-Real-IP': '203.0.113.7' };

const requestCode = (email: string, headers: Record<string, string> = IP) =>
  h.call('POST', '/v1/auth/codes', { token: null, body: { email }, headers });
const signIn = (email: string, code: string, headers: Record<string, string> = IP) =>
  h.call('POST', '/v1/auth/sign-in', { token: null, body: { email, code }, headers });

describe('sign-in with an e-mailed code', () => {
  it('answers 202 {} and mails a 6-digit code; the code signs in and creates the account', async () => {
    const res = await requestCode('Ania@Example.com');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    const code = codeIn(h.mailer.lastTo(EMAIL)?.text);

    const signed = await signIn(EMAIL, code);
    expect(signed.status).toBe(200);
    expect(signed.headers.get('cache-control')).toBe('no-store');
    const session = await signed.json();
    expect(session).toEqual({
      token: expect.any(String),
      expiresAt: expect.any(String),
      user: { id: expect.any(String), email: EMAIL },
    });
    const days = (Date.parse(session.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(59);
    expect(days).toBeLessThan(61);

    const me = await h.call('GET', '/v1/me', { token: session.token });
    expect(await me.json()).toMatchObject({ id: session.user.id, email: EMAIL });
    // The code works once.
    expect((await signIn(EMAIL, code)).status).toBe(401);
  });

  it('stores only a hash of the code', async () => {
    await requestCode(EMAIL);
    const code = codeIn(h.mailer.lastTo(EMAIL)?.text);
    const rows = await h.db.execute(sql`SELECT value FROM auth_verifications`);
    const values = (rows as unknown as { rows: { value: string }[] }).rows.map((r) => r.value);
    expect(values).toHaveLength(1);
    expect(values[0]).not.toContain(code);
  });

  it('burns the code after three wrong tries (401 auth.invalid-code)', async () => {
    await requestCode(EMAIL);
    const code = codeIn(h.mailer.lastTo(EMAIL)?.text);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) {
      const res = await signIn(EMAIL, wrong);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'auth.invalid-code' });
    }
    expect((await signIn(EMAIL, code)).status).toBe(401);
    expect((await signIn('nobody@example.com', '123456')).status).toBe(401);
  });

  it('rejects an invalid e-mail with 400', async () => {
    expect((await requestCode('not-an-email')).status).toBe(400);
  });

  it('limits codes to 3 per e-mail and 10 per IP per 10 minutes (429 + Retry-After)', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await requestCode(EMAIL)).status).toBe(202);
    }
    const limited = await requestCode(EMAIL);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'auth.rate-limited' });
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);

    for (let i = 0; i < 6; i++) {
      expect((await requestCode(`u${i}@example.com`)).status).toBe(202);
    }
    // Ten hits from this IP so far (4 + 6): the eleventh is refused, another IP is not.
    expect((await requestCode('late@example.com')).status).toBe(429);
    expect((await requestCode('late@example.com', { 'X-Real-IP': '198.51.100.1' })).status).toBe(202);

    h.clock.t += 10 * 60_000 + 1000;
    expect((await requestCode(EMAIL)).status).toBe(202);
  });

  it('limits sign-ins to 10 per IP per 10 minutes', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await signIn(`s${i}@example.com`, '123456')).status).toBe(401);
    }
    expect((await signIn('s10@example.com', '123456')).status).toBe(429);
  });

  it('accepts AUTH_FIXED_CODE only for the reserved test domain; real addresses get random codes', async () => {
    const fixed = await backupApp({ fixedCode: '000000' });
    const tryFixed = async (email: string) => {
      await fixed.call('POST', '/v1/auth/codes', { token: null, body: { email } });
      return fixed.call('POST', '/v1/auth/sign-in', { token: null, body: { email, code: '000000' } });
    };
    expect((await tryFixed('maestro@e2e.cityturfer.test')).status).toBe(200);
    expect(fixed.mailer.lastTo('maestro@e2e.cityturfer.test')).toBeUndefined();
    // The adopted founder (or any real address) cannot be signed in with the fixed code.
    const real = await tryFixed('founder@example.com');
    expect(real.status).toBe(401);
    expect(codeIn(fixed.mailer.lastTo('founder@example.com')?.text)).toMatch(/^\d{6}$/);
  });

  it('limits sign-ins to 10 per e-mail per 10 minutes, across IPs', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await signIn(EMAIL, '123456', { 'X-Real-IP': `198.51.100.${i}` })).status).toBe(401);
    }
    const limited = await signIn(EMAIL, '123456', { 'X-Real-IP': '198.51.100.99' });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'auth.rate-limited' });
  });

  it('answers 202 and logs a no-PII event when the mailer fails', async () => {
    const events: Record<string, unknown>[] = [];
    const auth = createAuth({
      db: h.db,
      secret: TEST_AUTH_SECRET,
      baseURL: 'http://localhost:8787',
      mailer: { send: () => Promise.reject(new Error('down')) },
      onMailError: () => events.push({ msg: 'auth.code-not-sent' }),
    });
    const service = new IdentityService(auth, new PostgresRateLimiter(h.db), TEST_AUTH_SECRET, h.clock);
    await expect(service.requestCode(EMAIL, '203.0.113.50')).resolves.toBeUndefined();
    expect(events).toEqual([{ msg: 'auth.code-not-sent' }]);
  });
});

describe('sessions', () => {
  it('signs out: the token answers 401 afterwards; sign-out is idempotent for device tokens', async () => {
    const token = await h.signIn(EMAIL);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(200);
    expect((await h.call('DELETE', '/v1/auth/session', { token })).status).toBe(204);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(401);
    expect((await h.call('DELETE', '/v1/auth/session', { token: TOKENS.admin })).status).toBe(204);
    expect((await h.call('GET', '/v1/me', { token: TOKENS.admin })).status).toBe(200);
  });

  it('keeps device tokens working next to sessions, each with its own data', async () => {
    const token = await h.signIn(EMAIL);
    const body = { granted: true, policyVersion: '2026-10' };
    await h.call('PUT', '/v1/me/consents/cloud-sync', { token, body });
    expect((await (await h.call('GET', '/v1/me/consents', { token })).json()).items).toHaveLength(1);
    expect((await (await h.call('GET', '/v1/me/consents')).json()).items).toHaveLength(0);
  });

  it('a second sign-in with the same e-mail is the same account', async () => {
    const first = await h.signIn(EMAIL);
    const second = await h.signIn(EMAIL, '198.51.100.9');
    const id = async (token: string) => (await (await h.call('GET', '/v1/me', { token })).json()).id;
    expect(await id(first)).toBe(await id(second));
  });
});

describe('auth:adopt', () => {
  it('lets the existing data user sign in with an e-mail and see its own data', async () => {
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
    expect(await adopt(h.db, 'admin', EMAIL)).toBe('adopted');
    expect(await adopt(h.db, 'admin', EMAIL)).toBe('already-adopted');
    expect(await adopt(h.db, 'other', EMAIL)).toBe('email-taken');
    expect(await adopt(h.db, 'admin', 'second@example.com')).toBe('user-has-other-email');

    const token = await h.signIn(EMAIL);
    expect(await (await h.call('GET', '/v1/me', { token })).json()).toMatchObject({ id: 'admin' });
    expect((await (await h.call('GET', '/v1/me/consents', { token })).json()).items).toHaveLength(1);
    // The device token still works for the same user.
    expect((await h.call('GET', '/v1/me', { token: TOKENS.admin })).status).toBe(200);
  });
});

describe('configuration', () => {
  const PROD = {
    VERCEL_ENV: 'production',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BREVO_API_KEY: 'brevo-test-key',
    MAIL_FROM: 'CityTurfer <hello@example.com>',
    API_PUBLIC_URL: 'https://api.example.com',
    // Never contacted: checkProductionEnv only checks that it is set.
    DATABASE_URL: 'postgres://user:pass@db.example.com/cityturfer',
    CRON_SECRET: 'test-cron-secret-0123456789',
  };

  it('refuses to boot production without the secrets, or with AUTH_FIXED_CODE', () => {
    expect(() => checkProductionEnv(PROD)).not.toThrow();
    expect(() => checkProductionEnv({ ...PROD, AUTH_FIXED_CODE: '000000' })).toThrow(ConfigError);
    expect(() => checkProductionEnv({ ...PROD, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => checkProductionEnv({ ...PROD, BREVO_API_KEY: '' })).toThrow(/BREVO_API_KEY/);
    expect(() => checkProductionEnv({ ...PROD, MAIL_FROM: '' })).toThrow(/MAIL_FROM/);
    expect(() => checkProductionEnv({ ...PROD, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => checkProductionEnv({ ...PROD, CRON_SECRET: undefined })).toThrow(/CRON_SECRET/);
    expect(() => checkProductionEnv({ ...PROD, CRON_SECRET: 'short' })).toThrow(/CRON_SECRET/);
    expect(() => checkProductionEnv({ VERCEL_ENV: 'preview' })).not.toThrow();
  });

  it('never names a secret value in the boot error', () => {
    try {
      checkProductionEnv({ ...PROD, AUTH_FIXED_CODE: '424242', BETTER_AUTH_SECRET: 'tiny-secret' });
    } catch (error) {
      expect(String(error)).not.toContain('424242');
      expect(String(error)).not.toContain('tiny-secret');
      expect(String(error)).not.toContain('db.example.com');
    }
  });

  it('turns sign-in off without a database or secret, and refuses a malformed fixed code', () => {
    expect(productionDeps({}).identity).toBeNull();
    expect(() => productionDeps({ AUTH_FIXED_CODE: '12ab' })).toThrow(ConfigError);
  });

  it('answers 503 for codes and sign-in when sign-in is off', async () => {
    const app = (await import('../app')).createApp(productionDeps({}));
    const res = await app.request('/v1/auth/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL }),
    });
    expect(res.status).toBe(503);
  });

  it('parses MAIL_FROM and sends through Brevo with the key in a header only', async () => {
    expect(parseMailFrom('CityTurfer <hello@example.com>')).toEqual({ email: 'hello@example.com', name: 'CityTurfer' });
    expect(parseMailFrom('hello@example.com')).toEqual({ email: 'hello@example.com', name: 'CityTurfer' });
    expect(parseMailFrom('nope')).toBeNull();
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}', { status: 201 });
    }) as unknown as typeof fetch;
    await new BrevoMailer('brevo-test-key', { email: 'hello@example.com', name: 'CityTurfer' }, fake).send({
      to: EMAIL,
      subject: 'Hi',
      text: 'Body',
    });
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0].init.headers as Record<string, string>)['api-key']).toBe('brevo-test-key');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ to: [{ email: EMAIL }], subject: 'Hi' });
  });
});
