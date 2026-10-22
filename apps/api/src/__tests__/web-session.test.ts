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
const COOKIE_ATTRS = 'Path=/api/v1; HttpOnly; Secure; SameSite=Strict';

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
  const value = /^__Secure-ct_session=([^;]*)/.exec(setCookie)?.[1] ?? '';
  return { res, setCookie, value, cookie: `__Secure-ct_session=${value}` };
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
    expect(setCookie).toBe(`__Secure-ct_session=${value}; Max-Age=${30 * 24 * 3600}; ${COOKIE_ATTRS}`);
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
    expect(setCookie).toBe(`__Secure-ct_session=${value}; ${COOKIE_ATTRS}`);
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
    expect(stored[0].ip_address || null).toBeNull();
    expect(stored[0].user_agent || null).toBeNull();
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
    const device = await withCookie('GET', '/v1/me', `__Secure-ct_session=${TOKENS.admin}`);
    expect(device.status).toBe(401);
    expect(await device.json()).toMatchObject({ code: 'auth.invalid' });
    expect(device.headers.get('set-cookie')).toBe(`__Secure-ct_session=; Max-Age=0; ${COOKIE_ATTRS}`);

    const phoneToken = await h.signIn('ania@example.com');
    const phone = await withCookie('GET', '/v1/me', `__Secure-ct_session=${encodeURIComponent(phoneToken)}`);
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
    expect(over.headers.get('set-cookie')).toContain('Max-Age=0');
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
    expect(self.headers.get('set-cookie')).toBe(`__Secure-ct_session=; Max-Age=0; ${COOKIE_ATTRS}`);
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
    expect(all.headers.get('set-cookie')).toBe(`__Secure-ct_session=; Max-Age=0; ${COOKIE_ATTRS}`);
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

describe('sign-out and erasure from the browser', () => {
  it('signing out revokes the session and clears the cookie', async () => {
    const phoneToken = await h.signIn('ania@example.com');
    const { cookie } = await browserSignIn('ania@example.com');
    const out = await withCookie('DELETE', '/v1/auth/session', cookie, { headers: WEB });
    expect(out.status).toBe(204);
    expect(out.headers.get('set-cookie')).toBe(`__Secure-ct_session=; Max-Age=0; ${COOKIE_ATTRS}`);
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
    // Signing out on the website never signs the phone out.
    expect((await h.call('GET', '/v1/me', { token: phoneToken })).status).toBe(200);
  });

  it('deleting the account clears the cookie', async () => {
    const { cookie } = await browserSignIn('ania@example.com');
    const res = await withCookie('DELETE', '/v1/me', cookie, { headers: WEB });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await withCookie('GET', '/v1/me', cookie)).status).toBe(401);
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
    expect(track.headers.get('cache-control')).toBe('private, no-cache');
    expect(track.headers.get('etag')).toBeTruthy();
    expect(track.headers.get('vary')).toContain('Cookie, Authorization');
  });
});

describe('client IP for the sign-in limits', () => {
  it('prefers x-vercel-forwarded-for over x-real-ip and x-forwarded-for', async () => {
    const signIn = (i: number) =>
      h.call('POST', '/v1/auth/sign-in', {
        token: null,
        body: { email: `s${i}@example.com`, code: '123456' },
        headers: {
          'X-Vercel-Forwarded-For': '198.51.100.20',
          'X-Real-IP': `203.0.113.${i}`,
          'X-Forwarded-For': `192.0.2.${i}, 10.0.0.1`,
        },
      });
    for (let i = 0; i < 20; i++) {
      expect((await signIn(i)).status).toBe(401);
    }
    expect((await signIn(20)).status).toBe(429);
  });
});

describe('WEB_ORIGIN', () => {
  it('defaults to the local site off Vercel, is off on Vercel when unset, and must be a bare https origin', () => {
    expect(webOriginOf({})).toBe(DEV_WEB_ORIGIN);
    expect(webOriginOf({ VERCEL_ENV: 'preview' })).toBeNull();
    expect(webOriginOf({ VERCEL_ENV: 'production', WEB_ORIGIN: 'https://cityturfer.app/' })).toBe(
      'https://cityturfer.app'
    );
    for (const bad of ['http://cityturfer.app', 'https://cityturfer.app/en', 'cityturfer.app', '*']) {
      expect(() => webOriginOf({ WEB_ORIGIN: bad })).toThrow(ConfigError);
    }
  });
});
