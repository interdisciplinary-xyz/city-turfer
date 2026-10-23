import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { defaultDeps, DEV_WEB_ORIGIN, silentLog } from '../deps';
import { ConfigError, webOriginOf } from '../wiring';
import { backupApp, closeSharedDb, codeIn, TOKENS, upload } from './support';

/**
 * Browser sessions for the website (contract 0.5.0, docs/decisions/api-web-sessions-2026-10-22.md):
 * the cookie, the CSRF guard, lifetimes, signed-in devices and the caching default.
 */

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const IP = '203.0.113.7';
/** What the website sends on every request that changes something. */
const WEB = { Origin: DEV_WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'CityTurfer-Client': 'web/0.10.0' };
const COOKIE_ATTRS = 'Path=/; HttpOnly; Secure; SameSite=Strict';
/** The answer that drops the cookie: same name, path and attributes as the one set, `Max-Age=0`. */
const CLEARED = `__Host-ct_session=; Max-Age=0; ${COOKIE_ATTRS}`;

beforeEach(async () => {
  h = await backupApp();
  // Better Auth reads `Date` for session expiry; keep it on the harness clock.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(h.clock.t);
});
afterEach(async () => {
  vi.useRealTimers();
  await h.close();
});
afterAll(closeSharedDb);

function advance(ms: number): void {
  h.clock.t += ms;
  vi.setSystemTime(h.clock.t);
}

async function codeFor(email: string): Promise<string> {
  advance(61_000); // one code per address per minute
  await h.call('POST', '/v1/auth/codes', { token: null, body: { email }, headers: { 'X-Real-IP': IP } });
  return codeIn(h.mailer.lastTo(email)?.text);
}

/** Signs in from the website: the raw answer and the cookie value as the browser would send it. */
async function browserSignIn(email: string, extra: Record<string, unknown> = {}) {
  const code = await codeFor(email);
  const res = await h.call('POST', '/v1/auth/sign-in', {
    token: null,
    body: { email, code, client: 'browser', ...extra },
    headers: { ...WEB, 'X-Real-IP': IP, 'User-Agent': 'Mozilla/5.0 (test)' },
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const value = /^__Host-ct_session=([^;]*)/.exec(setCookie)?.[1] ?? '';
  return { res, setCookie, value, cookie: `__Host-ct_session=${value}` };
}

/** A request with the session cookie (and no bearer token). */
const withCookie = (
  method: string,
  path: string,
  cookie: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {}
) => h.call(method, path, { token: null, body: opts.body, headers: { Cookie: cookie, ...opts.headers } });

async function rows(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  return ((await h.db.execute(query)) as unknown as { rows: Record<string, unknown>[] }).rows;
}

describe('browser sign-in', () => {
  it('sets the session cookie with exact attributes and keeps the token out of the body', async () => {
    const { res, setCookie, value } = await browserSignIn('ania@example.com');
    expect(res.status).toBe(200);
    expect(setCookie).toBe(`__Host-ct_session=${value}; Max-Age=${30 * 24 * 3600}; ${COOKIE_ATTRS}`);
    expect(setCookie).not.toMatch(/Domain=/i);
    expect(value.length).toBeGreaterThan(20);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual({
      client: 'browser',
      expiresAt: new Date(h.clock.t + 14 * DAY).toISOString(),
      absoluteExpiresAt: new Date(h.clock.t + 30 * DAY).toISOString(),
      user: { id: expect.any(String), email: 'ania@example.com' },
    });
    expect(JSON.stringify(body)).not.toContain(decodeURIComponent(value).split('.')[0]);
  });

  it('on a shared computer: a browser-session cookie (no Max-Age) and 8 hours', async () => {
    const { res, setCookie, value } = await browserSignIn('ania@example.com', { sharedComputer: true });
    expect(setCookie).toBe(`__Host-ct_session=${value}; ${COOKIE_ATTRS}`);
    const body = await res.json();
    expect(body.expiresAt).toBe(new Date(h.clock.t + 8 * HOUR).toISOString());
    expect(body.absoluteExpiresAt).toBe(new Date(h.clock.t + 8 * HOUR).toISOString());
  });

  it('refuses sharedComputer for a phone (400) and a browser sign-in from outside the website (403)', async () => {
    const code = await codeFor('ania@example.com');
    const phone = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email: 'ania@example.com', code, sharedComputer: true },
    });
    expect(phone.status).toBe(400);
    expect(await phone.json()).toMatchObject({ errors: [{ pointer: '/sharedComputer' }] });

    const tries: Record<string, string>[] = [
      { 'CityTurfer-Client': 'web/0.10.0' }, // no Origin
      { ...WEB, Origin: 'https://evil.example' },
      { ...WEB, 'Sec-Fetch-Site': 'cross-site' },
      { Origin: DEV_WEB_ORIGIN }, // no client header
    ];
    for (const headers of tries) {
      const res = await h.call('POST', '/v1/auth/sign-in', {
        token: null,
        body: { email: 'ania@example.com', code, client: 'browser' },
        headers,
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'auth.csrf' });
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    // The code was not spent by the refusals.
    const ok = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email: 'ania@example.com', code, client: 'browser' },
      headers: WEB,
    });
    expect(ok.status).toBe(200);
  });

  it('is off (403 auth.csrf) when the server has no WEB_ORIGIN', async () => {
    const off = createApp(defaultDeps({ log: silentLog, identity: h.identity, webOrigin: null }));
    const res = await off.request('/v1/auth/sign-in', {
      method: 'POST',
      headers: { ...WEB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ania@example.com', code: '123456', client: 'browser' }),
    });
    expect(res.status).toBe(403);
  });

  it('stores no IP address or user agent', async () => {
    await browserSignIn('ania@example.com');
    const stored = await rows(sql`SELECT ip_address, user_agent, client FROM auth_sessions`);
    expect(stored).toHaveLength(1);
    expect(stored[0].client).toBe('browser');
    expect(stored[0].ip_address).toBeNull();
    expect(stored[0].user_agent).toBeNull();
  });

  it('leaves the phone sign-in as it was: token in the body, no cookie, 60 days', async () => {
    const res = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email: 'ania@example.com', code: await codeFor('ania@example.com') },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ token: expect.any(String), client: 'phone', absoluteExpiresAt: null });
    expect(Date.parse(body.expiresAt) - h.clock.t).toBeGreaterThan(59 * DAY);
  });
});

describe('the session cookie as a credential', () => {
  it('authenticates reads, and the answer is private, no-store and varies on Cookie and Authorization', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const me = await withCookie('GET', '/v1/me', cookie);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: 'ania@example.com' });
    expect(me.headers.get('cache-control')).toBe('private, no-store');
    expect(me.headers.get('vary')).toBe('Cookie, Authorization');
    // A plain GET needs no client header or Origin (SameSite=Strict already keeps it same-site).
    expect((await withCookie('GET', '/v1/me/consents', cookie)).status).toBe(200);
  });

  it('guards writes against CSRF: Origin, Sec-Fetch-Site and the client header (403 auth.csrf)', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const body = { granted: true, policyVersion: '2026-10-22' };
    const tries: Record<string, string>[] = [
      { Origin: DEV_WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin' }, // no CityTurfer-Client
      { ...WEB, 'CityTurfer-Client': 'ios/0.10.0' },
      { ...WEB, Origin: 'https://evil.example' },
      { 'Sec-Fetch-Site': 'same-origin', 'CityTurfer-Client': 'web/0.10.0' }, // no Origin
      { ...WEB, 'Sec-Fetch-Site': 'cross-site' },
      { ...WEB, 'Sec-Fetch-Site': 'same-site' },
    ];
    for (const headers of tries) {
      const res = await withCookie('PUT', '/v1/me/consents/cloud-sync', cookie, { headers, body });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'auth.csrf' });
    }
    expect((await withCookie('DELETE', '/v1/auth/session', cookie, { headers: {} })).status).toBe(403);
    // Still signed in: none of them reached a handler.
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);

    const ok = await withCookie('PUT', '/v1/me/consents/cloud-sync', cookie, { headers: WEB, body });
    expect(ok.status).toBe(200);
    // Without Sec-Fetch-Site (older browsers) Origin and the client header suffice.
    const noFetchSite = { Origin: WEB.Origin, 'CityTurfer-Client': WEB['CityTurfer-Client'] };
    expect((await withCookie('PUT', '/v1/me/consents/cloud-sync', cookie, { headers: noFetchSite, body })).status).toBe(
      200
    );
  });

  it('exempts bearer requests from the CSRF guard', async () => {
    const put = await h.call('PUT', '/v1/me/consents/cloud-sync', {
      body: { granted: true, policyVersion: '2026-10-22' },
      headers: { Origin: 'https://evil.example' },
    });
    expect(put.status).toBe(200);
    const token = await h.signIn('ania@example.com');
    expect(token).toEqual(expect.any(String));
    expect((await h.call('DELETE', '/v1/auth/session', { token })).status).toBe(204);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(401);
  });

  it('never takes a device token or a phone session from a cookie, nor a browser session as bearer', async () => {
    const device = await withCookie('GET', '/v1/me', `__Host-ct_session=${TOKENS.admin}`);
    expect(device.status).toBe(401);
    expect(await device.json()).toMatchObject({ code: 'auth.invalid' });
    expect(device.headers.get('set-cookie')).toBe(CLEARED);

    const phoneToken = await h.signIn('ania@example.com');
    const phone = await withCookie('GET', '/v1/me', `__Host-ct_session=${encodeURIComponent(phoneToken)}`);
    expect(phone.status).toBe(401);
    // …and the phone's session still works as a bearer token.
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(200);

    const { value } = await browserSignIn('ania@example.com');
    expect((await h.call('GET', '/v1/me', { token: decodeURIComponent(value) })).status).toBe(401);
  });

  it('prefers the bearer token when both are sent', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const res = await h.call('GET', '/v1/me', { headers: { Cookie: cookie } });
    expect(await res.json()).toMatchObject({ id: 'admin' });
  });

  it('answers 401 without any credential', async () => {
    const res = await h.call('GET', '/v1/me', { token: null });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'auth.missing' });
  });
});

describe('browser session lifetime', () => {
  it('slides 14 days on use, never past 30 days after sign-in', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const me = () => withCookie('GET', '/v1/me', cookie);
    advance(13 * DAY);
    expect((await me()).status).toBe(200);
    const [slid] = await rows(sql`SELECT expires_at FROM auth_sessions`);
    expect(new Date(slid.expires_at as string).getTime()).toBe(h.clock.t + 14 * DAY);
    advance(13 * DAY); // day 26
    expect((await me()).status).toBe(200);
    const [capped] = await rows(sql`SELECT expires_at, absolute_expires_at FROM auth_sessions`);
    expect(new Date(capped.expires_at as string).getTime()).toBe(
      new Date(capped.absolute_expires_at as string).getTime()
    );
    advance(3 * DAY); // day 29
    expect((await me()).status).toBe(200);
    advance(DAY + 60_000); // day 30 and a minute: over, however active
    const over = await me();
    expect(over.status).toBe(401);
    expect(over.headers.get('set-cookie')).toBe(CLEARED);
  });

  it('ends after 14 days without use', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    advance(14 * DAY + 60_000);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
  });

  it('ends a shared-computer session after 8 hours, even in use', async () => {
    const { cookie } = await browserSignIn('ania@example.com', { sharedComputer: true });
    advance(4 * HOUR);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
    advance(3 * HOUR + 59 * 60_000);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
    advance(2 * 60_000);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
  });

  it('keeps phones at 60 days, sliding', async () => {
    const token = await h.signIn('ania@example.com');
    advance(2 * DAY);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(200);
    const [row] = await rows(sql`SELECT expires_at, absolute_expires_at, client FROM auth_sessions`);
    expect(new Date(row.expires_at as string).getTime()).toBe(h.clock.t + 60 * DAY);
    expect(row.absolute_expires_at).toBeNull();
    expect(row.client).toBe('phone');
    advance(59 * DAY);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(200);
  });
});

describe('signed-in devices', () => {
  it('lists phones and browsers, marks the current one and never shows a token', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    advance(HOUR);
    const { cookie, value } = await browserSignIn('ania@example.com');
    const res = await withCookie('GET', '/v1/auth/sessions', cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { sessions } = await res.json();
    expect(sessions).toEqual([
      {
        id: expect.any(String),
        client: 'browser',
        createdAt: new Date(h.clock.t).toISOString(),
        lastActiveAt: new Date(h.clock.t).toISOString(),
        expiresAt: new Date(h.clock.t + 14 * DAY).toISOString(),
        current: true,
      },
      expect.objectContaining({ client: 'phone', current: false }),
    ]);
    const text = JSON.stringify(sessions);
    const raw = (await rows(sql`SELECT token FROM auth_sessions`)).map((r) => r.token as string);
    for (const secret of [...raw, phoneToken, decodeURIComponent(value)]) {
      expect(text).not.toContain(secret);
    }
    // From the phone, the phone is current.
    const fromPhone = await (await h.call('GET', '/v1/auth/sessions', { token: phoneToken })).json();
    expect(fromPhone.sessions.find((s: { current: boolean }) => s.current).client).toBe('phone');
  });

  it("revokes one of your own sessions; someone else's id or an unknown one is 404", async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const otherToken = await h.signIn('bartek@example.com');
    const mine = (await (await withCookie('GET', '/v1/auth/sessions', cookie)).json()).sessions;
    const phoneId = mine.find((s: { client: string }) => s.client === 'phone').id;
    const otherId = (await (await h.call('GET', '/v1/auth/sessions', { token: otherToken })).json()).sessions[0].id;

    const foreign = await withCookie('DELETE', `/v1/auth/sessions/${otherId}`, cookie, { headers: WEB });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ code: 'not-found' });
    expect((await h.call('GET', '/v1/me', { token: otherToken })).status).toBe(200);
    expect((await withCookie('DELETE', '/v1/auth/sessions/no-such-id', cookie, { headers: WEB })).status).toBe(404);

    const revoked = await withCookie('DELETE', `/v1/auth/sessions/${phoneId}`, cookie, { headers: WEB });
    expect(revoked.status).toBe(204);
    expect(revoked.headers.get('set-cookie')).toBeNull();
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(401);
    // Already gone: 404, like any id that is not one of yours.
    expect((await withCookie('DELETE', `/v1/auth/sessions/${phoneId}`, cookie, { headers: WEB })).status).toBe(404);

    const currentId = mine.find((s: { current: boolean }) => s.current).id;
    const self = await withCookie('DELETE', `/v1/auth/sessions/${currentId}`, cookie, { headers: WEB });
    expect(self.status).toBe(204);
    expect(self.headers.get('set-cookie')).toBe(CLEARED);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
  });

  it('signs out the others, or everywhere (phones too)', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const second = await browserSignIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const otherToken = await h.signIn('bartek@example.com');

    expect((await withCookie('DELETE', '/v1/auth/sessions', cookie, { headers: WEB })).status).toBe(400);
    const others = await withCookie('DELETE', '/v1/auth/sessions?scope=others', cookie, { headers: WEB });
    expect(others.status).toBe(204);
    expect(others.headers.get('set-cookie')).toBeNull();
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(401);
    expect((await withCookie('GET', '/v1/me', second.cookie)).status).toBe(401);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);

    advance(11 * 60_000); // three codes per address per 10 minutes
    const phoneAgain = await h.signIn('ania@example.com', '198.51.100.9');
    expect(phoneAgain).toEqual(expect.any(String));
    const all = await withCookie('DELETE', '/v1/auth/sessions?scope=all', cookie, { headers: WEB });
    expect(all.status).toBe(204);
    expect(all.headers.get('set-cookie')).toBe(CLEARED);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
    expect((await h.call('GET', '/v1/me', { token: phoneAgain })).status).toBe(401);
    // Another account is untouched.
    expect((await h.call('GET', '/v1/me', { token: otherToken })).status).toBe(200);
  });

  it('signs out from a phone everywhere with a bearer token (no CSRF headers needed)', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    expect((await h.call('DELETE', '/v1/auth/sessions?scope=all', { token: phoneToken })).status).toBe(204);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
  });
});

describe('signed-in devices past Better Auth defaults', () => {
  /** Extra phone sessions written straight into auth_sessions (Better Auth's listSessions stops at 100). */
  async function extraSessions(userId: string, n: number, expiresAt: number, prefix = 'extra') {
    for (let i = 0; i < n; i++) {
      const at = new Date(h.clock.t - (i + 1) * 60_000).toISOString();
      await h.db.execute(sql`
        INSERT INTO auth_sessions (id, token, user_id, client, created_at, updated_at, expires_at)
        VALUES (${`${prefix}-${i}`}, ${`${prefix}-token-${i}`}, ${userId}, 'phone', ${at}::timestamptz,
                ${at}::timestamptz, ${new Date(expiresAt).toISOString()}::timestamptz)`);
    }
  }
  const userIdOf = async (email: string) =>
    (await rows(sql`SELECT id FROM auth_users WHERE email = ${email}`))[0].id as string;

  it('lists all live sessions (over 100), newest use first, and leaves expired rows out', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const userId = await userIdOf('ania@example.com');
    await extraSessions(userId, 110, h.clock.t + DAY);
    await extraSessions(userId, 3, h.clock.t - 1, 'expired');
    const { sessions } = await (await withCookie('GET', '/v1/auth/sessions', cookie)).json();
    expect(sessions).toHaveLength(111);
    expect(sessions[0].current).toBe(true);
    const used = sessions.map((s: { lastActiveAt: string }) => Date.parse(s.lastActiveAt));
    expect(used).toEqual([...used].sort((a: number, b: number) => b - a));
    expect(sessions.some((s: { id: string }) => s.id.startsWith('expired'))).toBe(false);
  });

  it('signs out every other session, however many', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const userId = await userIdOf('ania@example.com');
    await extraSessions(userId, 150, h.clock.t + DAY);
    const other = await h.signIn('bartek@example.com');
    expect((await withCookie('DELETE', '/v1/auth/sessions?scope=others', cookie, { headers: WEB })).status).toBe(204);
    const left = await rows(sql`SELECT id FROM auth_sessions WHERE user_id = ${userId}`);
    expect(left).toHaveLength(1);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
    expect((await h.call('GET', '/v1/me', { token: other })).status).toBe(200);
  });

  it('revokes a session beyond the first 100, and answers 404 for an expired one', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const userId = await userIdOf('ania@example.com');
    await extraSessions(userId, 120, h.clock.t + DAY);
    await extraSessions(userId, 1, h.clock.t - 1, 'expired');
    expect((await withCookie('DELETE', '/v1/auth/sessions/extra-119', cookie, { headers: WEB })).status).toBe(204);
    expect(await rows(sql`SELECT id FROM auth_sessions WHERE id = 'extra-119'`)).toHaveLength(0);
    expect((await withCookie('DELETE', '/v1/auth/sessions/expired-0', cookie, { headers: WEB })).status).toBe(404);
  });

  it('keeps lastActiveAt current once the expiry is at its 30-day cap (at most once a day)', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const me = () => withCookie('GET', '/v1/me', cookie);
    const lastActive = async () =>
      Date.parse(
        (await (await withCookie('GET', '/v1/auth/sessions', cookie)).json()).sessions[0].lastActiveAt as string
      );
    for (let day = 0; day < 20; day++) {
      advance(DAY);
      expect((await me()).status).toBe(200);
    }
    // Day 20: the expiry hit the cap on day 16; the use is still recorded.
    expect(await lastActive()).toBe(h.clock.t);
    const recorded = h.clock.t;
    advance(HOUR);
    expect((await me()).status).toBe(200);
    expect(await lastActive()).toBe(recorded); // not again within the day
    advance(DAY);
    expect((await me()).status).toBe(200);
    expect(await lastActive()).toBe(h.clock.t);
  });
});

describe('sign-out and erasure from the browser', () => {
  it('signing out revokes the session and clears the cookie', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const out = await withCookie('DELETE', '/v1/auth/session', cookie, { headers: WEB });
    expect(out.status).toBe(204);
    expect(out.headers.get('set-cookie')).toBe(CLEARED);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
    // Signing out on the website never signs the phone out.
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(200);
  });

  it('deleting the account clears the cookie', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const res = await withCookie('DELETE', '/v1/me', cookie, { headers: WEB });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toBe(CLEARED);
    const after = await withCookie('GET', '/v1/me', cookie);
    expect(after.status).toBe(401);
    expect(after.headers.get('set-cookie')).toBe(CLEARED);
  });
});

describe('caching default', () => {
  it('marks every /v1 answer private, no-store unless the route sets its own', async () => {
    for (const res of [await h.call('GET', '/v1/health', { token: null }), await h.call('GET', '/v1/nope')]) {
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(res.headers.get('vary')).toBe('Cookie, Authorization');
    }
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10-22' } });
    const id = '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20';
    expect((await h.call('PUT', `/v1/activities/${id}`, { body: upload() })).status).toBe(201);
    const track = await h.call('GET', `/v1/activities/${id}/track`);
    expect(track.status).toBe(200);
    expect(track.headers.get('cache-control')).toBe('private, no-store');
    expect(track.headers.get('etag')).toBeTruthy();
    expect(track.headers.get('vary')).toContain('Cookie, Authorization');
  });
});

describe('account settings from the browser (contract 0.5.0: both features)', () => {
  const PASSWORD = 'tram stops past the old town';

  /** A step-up code mailed to `email`, asked for with the cookie from the website. */
  async function stepUp(cookie: string, email = 'ania@example.com'): Promise<string> {
    advance(61_000); // one step-up code a minute per account
    const res = await withCookie('POST', '/v1/me/step-up/codes', cookie, { headers: WEB });
    expect(res.status).toBe(202);
    return codeIn(h.mailer.lastTo(email)?.text);
  }

  it('guards PATCH /v1/me with the cookie: 403 auth.csrf without the client header, 200 with it', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const refused = await withCookie('PATCH', '/v1/me', cookie, {
      headers: { Origin: DEV_WEB_ORIGIN, 'Sec-Fetch-Site': 'same-origin' },
      body: { name: 'Ania' },
    });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'auth.csrf' });
    expect((await (await withCookie('GET', '/v1/me', cookie)).json()).name).toBeNull();

    const ok = await withCookie('PATCH', '/v1/me', cookie, { headers: WEB, body: { name: 'Ania' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ name: 'Ania', email: 'ania@example.com' });
  });

  it('guards every account-settings write with the cookie (403 auth.csrf before validation)', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const writes: [string, string][] = [
      ['POST', '/v1/me/step-up/codes'],
      ['POST', '/v1/me/email/codes'],
      ['POST', '/v1/me/email'],
      ['PUT', '/v1/me/password'],
      ['DELETE', '/v1/me/password'],
    ];
    for (const [method, path] of writes) {
      const res = await withCookie(method, path, cookie, { headers: { Origin: 'https://evil.example' }, body: {} });
      expect([method, path, res.status]).toEqual([method, path, 403]);
      expect(await res.json()).toMatchObject({ code: 'auth.csrf' });
    }
  });

  it('signs in with a password as a browser: the cookie, no token, and the login-CSRF guard', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const set = await withCookie('PUT', '/v1/me/password', cookie, {
      headers: WEB,
      body: { newPassword: PASSWORD, stepUpCode: await stepUp(cookie) },
    });
    expect(set.status).toBe(204);

    const body = { email: 'ania@example.com', password: PASSWORD, client: 'browser', sharedComputer: true };
    const foreign = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body,
      headers: { Origin: 'https://evil.example' },
    });
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({ code: 'auth.csrf' });

    const res = await h.call('POST', '/v1/auth/sign-in', { token: null, body, headers: { ...WEB, 'X-Real-IP': IP } });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(new RegExp(`^__Host-ct_session=[^;]+; ${COOKIE_ATTRS}$`)); // shared: no Max-Age
    const answer = await res.json();
    expect(answer).toEqual({
      client: 'browser',
      expiresAt: new Date(h.clock.t + 8 * HOUR).toISOString(),
      absoluteExpiresAt: new Date(h.clock.t + 8 * HOUR).toISOString(),
      user: { id: expect.any(String), email: 'ania@example.com' },
    });
    const passwordCookie = `__Host-ct_session=${/^__Host-ct_session=([^;]*)/.exec(setCookie)?.[1]}`;
    expect((await withCookie('GET', '/v1/me', passwordCookie)).status).toBe(200);

    // sharedComputer with a phone password sign-in is 400, as with a code.
    const phone = await h.call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email: 'ania@example.com', password: PASSWORD, sharedComputer: true },
    });
    expect(phone.status).toBe(400);
  });

  it('keeps the current browser session and signs out every other one (phones too, over 100) after a password change', async () => {
    const phone = await h.signIn('ania@example.com');
    const otherBrowser = await browserSignIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const [{ id: userId }] = await rows(sql`SELECT id FROM auth_users WHERE email = 'ania@example.com'`);
    for (let i = 0; i < 120; i++) {
      await h.db.execute(sql`
        INSERT INTO auth_sessions (id, token, user_id, client, created_at, updated_at, expires_at)
        VALUES (${`extra-${i}`}, ${`extra-token-${i}`}, ${userId as string}, 'phone', now(), now(),
                ${new Date(h.clock.t + DAY).toISOString()}::timestamptz)`);
    }
    const bartek = await h.signIn('bartek@example.com');

    const set = await withCookie('PUT', '/v1/me/password', cookie, {
      headers: WEB,
      body: { newPassword: PASSWORD, stepUpCode: await stepUp(cookie) },
    });
    expect(set.status).toBe(204);
    expect(await rows(sql`SELECT id FROM auth_sessions WHERE user_id = ${userId as string}`)).toHaveLength(1);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
    expect((await withCookie('GET', '/v1/me', otherBrowser.cookie)).status).toBe(401);
    expect((await h.call('GET', '/v1/me', { token: phone })).status).toBe(401);
    expect((await h.call('GET', '/v1/me', { token: bartek })).status).toBe(200);
  });

  it('keeps the current phone session and signs the browsers out after an e-mail change', async () => {
    const phone = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    advance(61_000);
    const step = await h.call('POST', '/v1/me/step-up/codes', { token: phone });
    expect(step.status).toBe(202);
    const stepUpCode = codeIn(h.mailer.lastTo('ania@example.com')?.text);
    const newEmail = 'ania.nowak@example.com';
    expect((await h.call('POST', '/v1/me/email/codes', { token: phone, body: { newEmail, stepUpCode } })).status).toBe(
      202
    );
    const code = codeIn(h.mailer.lastTo(newEmail)?.text);
    const changed = await h.call('POST', '/v1/me/email', { token: phone, body: { newEmail, code } });
    expect(changed.status).toBe(200);
    expect((await h.call('GET', '/v1/me', { token: phone })).status).toBe(200);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
  });

  it('still refuses a device token (403 identity.account-required)', async () => {
    const res = await h.call('PATCH', '/v1/me', { token: TOKENS.admin, body: { name: 'Ania' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'identity.account-required' });
  });
});

describe('client IP for the sign-in limits', () => {
  const EDGE = 'e'.repeat(64);
  /** 21 failed sign-ins from fresh addresses; `headers(i)` says where each claims to come from. */
  async function failedSignIns(headers: (i: number) => Record<string, string>): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const res = await h.call('POST', '/v1/auth/sign-in', {
        token: null,
        body: { email: `s${i}@example.com`, code: '123456' },
        headers: headers(i),
      });
      statuses.push(res.status);
    }
    return statuses;
  }
  const limited = [...Array<number>(20).fill(401), 429];

  it('a direct caller cannot pick a fresh bucket with a forged x-vercel-forwarded-for', async () => {
    const statuses = await failedSignIns((i) => ({
      'X-Vercel-Forwarded-For': `198.51.100.${i}`,
      'X-Forwarded-For': '203.0.113.7',
    }));
    expect(statuses).toEqual(limited);
  });

  it('nor with a forged x-vercel-forwarded-for and a wrong edge header', async () => {
    h = await backupApp({ webEdgeSecret: EDGE });
    vi.setSystemTime(h.clock.t);
    const statuses = await failedSignIns((i) => ({
      'CityTurfer-Edge': 'guess',
      'X-Vercel-Forwarded-For': `198.51.100.${i}`,
      'X-Forwarded-For': '203.0.113.7',
    }));
    expect(statuses).toEqual(limited);
  });

  it('nor by prepending to x-forwarded-for: the last entry counts', async () => {
    const statuses = await failedSignIns((i) => ({ 'X-Forwarded-For': `198.51.100.${i}, 203.0.113.7` }));
    expect(statuses).toEqual(limited);
  });

  it('buckets by x-real-ip alone, and by x-forwarded-for alone', async () => {
    expect(await failedSignIns(() => ({ 'X-Real-IP': '203.0.113.8' }))).toEqual(limited);
    advance(11 * 60_000); // a new 10-minute window
    expect(await failedSignIns(() => ({ 'X-Forwarded-For': '203.0.113.9' }))).toEqual(limited);
  });

  it('counts failed password sign-ins in the same IP bucket, from the same trusted header', async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const res = await h.call('POST', '/v1/auth/sign-in', {
        token: null,
        body: { email: `p${i}@example.com`, password: 'not the password at all' },
        headers: { 'X-Vercel-Forwarded-For': `198.51.100.${i}`, 'X-Forwarded-For': '203.0.113.7' },
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual(limited);
  });

  it('through the website (edge secret): the visitor in x-vercel-forwarded-for, not the shared hop', async () => {
    h = await backupApp({ webEdgeSecret: EDGE });
    vi.setSystemTime(h.clock.t);
    const statuses = await failedSignIns((i) => ({
      'CityTurfer-Edge': EDGE,
      'X-Vercel-Forwarded-For': `198.51.100.${i}`,
      'X-Real-IP': '192.0.2.1',
      'X-Forwarded-For': '192.0.2.1',
    }));
    expect(statuses).toEqual(Array<number>(21).fill(401));
  });
});

describe('WEB_ORIGIN', () => {
  it('defaults to the local site off Vercel, is off on Vercel when unset or without the edge secret, and must be a bare https origin', () => {
    expect(webOriginOf({})).toBe(DEV_WEB_ORIGIN);
    expect(webOriginOf({ VERCEL_ENV: 'preview' })).toBeNull();
    const edge = { WEB_EDGE_SECRET: 'e'.repeat(32) };
    expect(webOriginOf({ VERCEL_ENV: 'production', WEB_ORIGIN: 'https://cityturfer.app/', ...edge })).toBe(
      'https://cityturfer.app'
    );
    // On Vercel without the edge secret, every visitor would share the website edge's IP bucket.
    expect(webOriginOf({ VERCEL_ENV: 'preview', WEB_ORIGIN: 'https://web-git-x.vercel.app' })).toBeNull();
    expect(
      webOriginOf({ VERCEL_ENV: 'preview', WEB_ORIGIN: 'https://web-git-x.vercel.app', WEB_EDGE_SECRET: 'short' })
    ).toBeNull();
    expect(webOriginOf({ VERCEL_ENV: 'preview', WEB_ORIGIN: 'https://web-git-x.vercel.app', ...edge })).toBe(
      'https://web-git-x.vercel.app'
    );
    for (const bad of ['http://cityturfer.app', 'https://cityturfer.app/en', 'cityturfer.app', '*']) {
      expect(() => webOriginOf({ WEB_ORIGIN: bad })).toThrow(ConfigError);
    }
  });
});

describe('browser session lifetime at the exact limits (expired when expiresAt <= now, on the use cases’ clock)', () => {
  /** Puts both clocks (the harness's and the faked `Date`) at `t`. */
  function setTime(t: number): void {
    h.clock.t = t;
    vi.setSystemTime(t);
  }
  /** Signs in from the website and keeps the moment the session started. */
  async function signedIn(email: string, extra: Record<string, unknown> = {}) {
    const { cookie } = await browserSignIn(email, extra);
    return { cookie, at: h.clock.t };
  }
  const me = (cookie: string) => withCookie('GET', '/v1/me', cookie);

  it('14 days without use: 1 ms short is 200, exactly 14 days and 1 ms past are 401 (cookie cleared)', async () => {
    const a = await signedIn('a@example.com');
    const b = await signedIn('b@example.com');
    const c = await signedIn('c@example.com');
    setTime(a.at + 14 * DAY - 1);
    expect((await me(a.cookie)).status).toBe(200);
    setTime(b.at + 14 * DAY);
    const exact = await me(b.cookie);
    expect(exact.status).toBe(401);
    expect(exact.headers.get('set-cookie')).toBe(CLEARED);
    setTime(c.at + 14 * DAY + 1);
    const past = await me(c.cookie);
    expect(past.status).toBe(401);
    expect(past.headers.get('set-cookie')).toBe(CLEARED);
  });

  it('30 days under daily use: 1 ms short is 200, exactly 30 days and 1 ms past are 401', async () => {
    const a = await signedIn('a@example.com');
    const b = await signedIn('b@example.com');
    for (let day = 1; day < 30; day++) {
      setTime(a.at + day * DAY);
      expect((await me(a.cookie)).status).toBe(200);
      setTime(b.at + day * DAY);
      expect((await me(b.cookie)).status).toBe(200);
    }
    setTime(a.at + 30 * DAY - 1);
    expect((await me(a.cookie)).status).toBe(200);
    setTime(a.at + 30 * DAY);
    const exact = await me(a.cookie);
    expect(exact.status).toBe(401);
    expect(exact.headers.get('set-cookie')).toBe(CLEARED);
    setTime(b.at + 30 * DAY + 1);
    expect((await me(b.cookie)).status).toBe(401);
  });

  it('8 hours on a shared computer, in use: 1 ms short is 200, exactly 8 hours and 1 ms past are 401', async () => {
    const shared = { sharedComputer: true };
    const a = await signedIn('a@example.com', shared);
    const b = await signedIn('b@example.com', shared);
    setTime(a.at + 4 * HOUR);
    expect((await me(a.cookie)).status).toBe(200);
    setTime(a.at + 8 * HOUR - 1);
    expect((await me(a.cookie)).status).toBe(200);
    setTime(a.at + 8 * HOUR);
    expect((await me(a.cookie)).status).toBe(401);
    setTime(b.at + 8 * HOUR + 1);
    const past = await me(b.cookie);
    expect(past.status).toBe(401);
    expect(past.headers.get('set-cookie')).toBe(CLEARED);
  });

  it('decides on the injected clock: expired by it while Date and the database still call it live', async () => {
    // PGlite's now() follows the faked Date, so the only clock that can disagree is the injected
    // one. Put it exactly at the expiry while Date (and with it the database) stays an hour short.
    const { cookie, at } = await signedIn('a@example.com');
    vi.setSystemTime(at + 14 * DAY - HOUR);
    h.clock.t = at + 14 * DAY;
    const [{ live }] = await rows(sql`SELECT expires_at > now() AS live FROM auth_sessions`);
    expect(live).toBe(true); // the database (and Better Auth's Date check) would let it through
    const res = await me(cookie);
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBe(CLEARED);
    // The session list and revoking take the same clock (SessionStore.listLive / revokeLive(…, now)):
    // a second session that expired 30 minutes ago by it, but is live by Date and the database.
    const { cookie: mine } = await signedIn('b@example.com');
    advance(61_000); // one code per address per minute
    const phone = await h.signIn('b@example.com', '198.51.100.20');
    expect(phone).toEqual(expect.any(String));
    vi.setSystemTime(h.clock.t - HOUR);
    await h.db
      .execute(sql`UPDATE auth_sessions SET expires_at = ${new Date(h.clock.t - 30 * 60_000).toISOString()}::timestamptz
      WHERE client = 'phone'`);
    const [{ phoneLive }] = await rows(
      sql`SELECT bool_and(expires_at > now()) AS "phoneLive" FROM auth_sessions WHERE client = 'phone'`
    );
    expect(phoneLive).toBe(true);
    const { sessions } = await (await withCookie('GET', '/v1/auth/sessions', mine)).json();
    expect(sessions.map((s: { client: string }) => s.client)).toEqual(['browser']);
    const [{ id: phoneId }] = await rows(sql`SELECT id FROM auth_sessions WHERE client = 'phone'`);
    expect((await withCookie('DELETE', `/v1/auth/sessions/${phoneId as string}`, mine, { headers: WEB })).status).toBe(
      404
    );
  });
});

describe('when the session cookie is cleared, and when not', () => {
  it('clears an unknown or garbage cookie (401) with the exact attributes', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    expect((await withCookie('DELETE', '/v1/auth/session', cookie, { headers: WEB })).status).toBe(204);
    for (const stale of [cookie, '__Host-ct_session=garbage', '__Host-ct_session=a.b.c%00']) {
      const res = await withCookie('GET', '/v1/me', stale);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'auth.invalid' });
      expect(res.headers.get('set-cookie')).toBe(CLEARED);
    }
  });

  it('leaves it alone on 403 auth.csrf, on scope=others and when revoking another session', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const refused = await withCookie('DELETE', '/v1/auth/session', cookie, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(refused.status).toBe(403);
    expect(refused.headers.get('set-cookie')).toBeNull();

    const sessions = (await (await withCookie('GET', '/v1/auth/sessions', cookie)).json()).sessions;
    const phoneId = sessions.find((s: { client: string }) => s.client === 'phone').id;
    const one = await withCookie('DELETE', `/v1/auth/sessions/${phoneId}`, cookie, { headers: WEB });
    expect(one.status).toBe(204);
    expect(one.headers.get('set-cookie')).toBeNull();
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(401);

    const others = await withCookie('DELETE', '/v1/auth/sessions?scope=others', cookie, { headers: WEB });
    expect(others.status).toBe(204);
    expect(others.headers.get('set-cookie')).toBeNull();
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
  });
});

describe('the CSRF guard on every route that changes something', () => {
  type Op = { method: string; path: string; public: boolean; hasGet: boolean };
  /** The only routes that change something without a credential (the sign-in itself has its own guard). */
  const PUBLIC_UNSAFE = ['POST /v1/auth/codes', 'POST /v1/auth/sign-in'];
  /** Registered unsafe routes allowed outside the spec: none. */
  const OUTSIDE_SPEC: string[] = [];
  const UNSAFE = ['post', 'put', 'patch', 'delete'];
  const SAMPLE_PARAMS: Record<string, string> = {
    activityId: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20',
    sessionId: 'session-id',
    purpose: 'cloud-sync',
  };
  const concrete = (path: string) => path.replace(/\{(\w+)\}/g, (_, name: string) => SAMPLE_PARAMS[name] ?? 'sample');

  async function unsafeOps(): Promise<Op[]> {
    const spec = (await (await h.app.request('/openapi.json')).json()) as {
      security?: unknown[];
      paths: Record<string, Record<string, { security?: unknown[] }>>;
    };
    return Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.entries(ops)
        .filter(([m]) => UNSAFE.includes(m))
        .map(([m, op]) => ({
          method: m.toUpperCase(),
          path,
          public: (op.security ?? spec.security ?? []).length === 0,
          hasGet: 'get' in ops,
        }))
    );
  }

  /** Every row of every table, as one fingerprint per table. */
  async function snapshot(): Promise<Record<string, unknown>> {
    const tables = (await rows(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)).map(
      (r) => r.tablename as string
    );
    const out: Record<string, unknown> = {};
    for (const t of tables) {
      const [r] = await rows(
        sql.raw(
          `SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`
        )
      );
      out[t] = r;
    }
    return out;
  }

  it('every registered unsafe route is in the spec, and only the sign-in routes are public', async () => {
    const ops = await unsafeOps();
    const inSpec = new Set(ops.map((o) => `${o.method} ${o.path.replace(/\{(\w+)\}/g, ':$1')}`));
    const registered = [
      ...new Set(
        h.app.routes.filter((r) => UNSAFE.includes(r.method.toLowerCase())).map((r) => `${r.method} ${r.path}`)
      ),
    ];
    expect(registered.filter((r) => !inSpec.has(r) && !OUTSIDE_SPEC.includes(r))).toEqual([]);
    expect(ops.filter((o) => o.public).map((o) => `${o.method} ${o.path}`)).toEqual(PUBLIC_UNSAFE);
    expect(ops.filter((o) => !o.public).length).toBeGreaterThanOrEqual(17);
  });

  it('refuses the cookie without Origin and client header on each protected one (403 auth.csrf), with no side effect', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    await withCookie('PUT', '/v1/me/consents/cloud-sync', cookie, {
      headers: WEB,
      body: { granted: true, policyVersion: '2026-10-22' },
    });
    const ops = (await unsafeOps()).filter((o) => !o.public);
    const before = await snapshot();
    const mails = h.mailer.sent.length;
    for (const op of ops) {
      const res = await withCookie(op.method, concrete(op.path), cookie, { body: {} });
      const body = await res.json();
      expect([op.method, op.path, res.status, body.code]).toEqual([op.method, op.path, 403, 'auth.csrf']);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    expect(await snapshot()).toEqual(before);
    expect(h.mailer.sent.length).toBe(mails);
    // Reads on the same paths need no CSRF headers.
    for (const op of ops.filter((o) => o.hasGet)) {
      const res = await withCookie('GET', concrete(op.path), cookie);
      expect([op.path, res.status]).not.toEqual([op.path, 403]);
    }
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(200);
  });

  it('never refuses a bearer token for CSRF on any of them', async () => {
    const ops = (await unsafeOps()).filter((o) => !o.public);
    let i = 0;
    for (const op of ops) {
      // A fresh phone session each: some of these sign out or erase the account.
      i += 1;
      const token = await h.signIn(`p${i}@example.com`, `198.51.100.${i}`);
      const res = await h.call(op.method, concrete(op.path), { token, body: {} });
      const body = res.status === 204 ? {} : await res.json();
      expect([op.method, op.path, body.code]).not.toEqual([op.method, op.path, 'auth.csrf']);
      expect([op.method, op.path, res.status]).not.toEqual([op.method, op.path, 403]);
    }
  });

  it('starts an export with the cookie from the website (202)', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const res = await withCookie('POST', '/v1/me/exports', cookie, { headers: WEB });
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job).toMatchObject({ status: 'ready' });
    expect(res.headers.get('location')).toBe(`/v1/me/exports/${job.id}`);
    expect(h.mailer.lastTo('ania@example.com')?.text).toContain('/v1/exports/');
  });
});
