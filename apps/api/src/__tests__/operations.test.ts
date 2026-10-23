import { sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { authSessions, authUsers, authVerifications, rateLimits, storedFiles } from '../db/schema';
import { findAccount } from '../db/support';
import type { ApiLog } from '../deps';
import { describeError } from '../middleware';
import { RETENTION_CRON_PATH } from '../routes/internal';
import { backupApp, closeSharedDb, TEST_CRON_SECRET, TOKENS, upload } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

afterEach(async () => {
  await h?.close();
});
afterAll(closeSharedDb);

/** A log that keeps every event line, as JSON (what would reach Vercel's logs). */
function capturingLog(): ApiLog & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    request: (e) => lines.push(JSON.stringify({ msg: 'request', ...e })),
    event: (e) => lines.push(JSON.stringify(e)),
  };
}

const HOUR = 3600_000;

describe('unexpected errors', () => {
  it('answer a bare 500 and log one line without the message, input or path ids', async () => {
    const log = capturingLog();
    h = await backupApp({ log });
    h.app.get('/v1/boom/:id', () => {
      const cause = Object.assign(new Error('duplicate key (email)=(ania@example.com)'), { code: '23505' });
      throw Object.assign(new Error('insert failed at 21.0122,52.2297 for ania@example.com', { cause }), {
        name: 'DrizzleQueryError',
      });
    });
    const res = await h.app.request('/v1/boom/act-secret-id', { headers: { 'X-Request-Id': 'req-test-1' } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'internal' });
    expect(JSON.stringify(body)).not.toMatch(/ania|21\.0122|insert/);

    const line = log.lines.map((l) => JSON.parse(l)).find((l) => l.msg === 'request.error');
    expect(line).toMatchObject({
      requestId: 'req-test-1',
      method: 'GET',
      route: '/v1/boom/:id',
      error: 'DrizzleQueryError',
      cause: 'Error',
      causeCode: '23505',
    });
    expect(line.at).toMatch(/^operations\.test\.ts:\d+:\d+$/);
    const all = log.lines.join('\n');
    expect(all).not.toMatch(/ania|example\.com|21\.0122|52\.2297|act-secret-id|duplicate|insert failed/);
  });

  it('never reads a stack frame out of a multi-line message', () => {
    const err = new Error('first line\n    at ania@example.com.ts:1:1');
    err.stack = `Error: ${err.message}`;
    expect(describeError(err)).toEqual({ error: 'Error' });
    expect(describeError('a string')).toEqual({ error: 'Error' });
    expect(describeError(Object.assign(new Error('x'), { name: 'bad name <x>', code: 'not a code!' }))).toMatchObject({
      error: 'Error',
    });
  });
});

describe(`GET ${RETENTION_CRON_PATH}`, () => {
  const cron = (token?: string) =>
    h.app.request(RETENTION_CRON_PATH, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  it('is a 404 without CRON_SECRET and a 401 without the right bearer', async () => {
    h = await backupApp({ cronSecret: null });
    expect((await cron(TEST_CRON_SECRET)).status).toBe(404);
    await h.close();
    h = await backupApp();
    expect((await cron()).status).toBe(401);
    expect((await cron('wrong-secret')).status).toBe(401);
    expect((await cron(TOKENS.admin)).status).toBe(401);
    expect((await cron(`${TEST_CRON_SECRET}x`)).status).toBe(401);
    expect((await cron(TEST_CRON_SECRET)).status).toBe(200);
  });

  it('is not in the public OpenAPI spec', async () => {
    h = await backupApp();
    const spec = await (await h.app.request('/openapi.json')).json();
    expect(Object.keys(spec.paths).some((p) => p.startsWith('/internal'))).toBe(false);
  });

  it('purges expired export zips, codes, sessions and stale rate limits, and nothing else', async () => {
    const log = capturingLog();
    h = await backupApp({ log });
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
    await h.call('PUT', '/v1/activities/run-1', { body: upload() });
    expect((await h.call('POST', '/v1/me/exports')).status).toBe(202);
    const link = /http:\/\/localhost:8787(\/v1\/exports\/[A-Za-z0-9_-]+)/.exec(
      h.mailer.lastTo('admin@cityturfer.com')?.text ?? ''
    )?.[1];
    expect(link).toBeTruthy();

    const now = h.clock.t;
    const at = (ms: number) => new Date(now + ms);
    await h.db.insert(authUsers).values({ id: 'u-auth', email: 'someone@example.com', emailVerified: true, name: '' });
    await h.db.insert(authSessions).values([
      { id: 's-old', token: 'tok-old', userId: 'u-auth', expiresAt: at(-HOUR) },
      { id: 's-live', token: 'tok-live', userId: 'u-auth', expiresAt: at(30 * 24 * HOUR) },
    ]);
    await h.db.insert(authVerifications).values([
      { id: 'v-old', identifier: 'sign-in-otp-a@example.com', value: 'x', expiresAt: at(-HOUR) },
      { id: 'v-live', identifier: 'sign-in-otp-b@example.com', value: 'x', expiresAt: at(30 * 24 * HOUR) },
    ]);
    await h.db.insert(rateLimits).values([
      { key: 'rl-old', windowStartedAt: at(-26 * HOUR), hits: 3 },
      { key: 'rl-live', windowStartedAt: at(-60_000), hits: 1 },
    ]);

    // Before the zip expires: only the expired auth rows go.
    let res = await cron(TEST_CRON_SECRET);
    expect(await res.json()).toEqual({
      exportFiles: 0,
      signInCodes: 1,
      sessions: 1,
      rateLimits: 1,
      turf: { claimed: 0, deferred: 0, failed: 0, remaining: 0 },
    });

    // A day later the zip (it holds GPS tracks) goes too, and its link answers 410.
    h.clock.t = now + 25 * HOUR;
    res = await cron(TEST_CRON_SECRET);
    // The minute-old counter is stale by then as well; the month-long code and session are not.
    expect(await res.json()).toEqual({
      exportFiles: 1,
      signInCodes: 0,
      sessions: 0,
      rateLimits: 1,
      turf: { claimed: 0, deferred: 0, failed: 0, remaining: 0 },
    });
    expect(await h.db.select().from(storedFiles)).toHaveLength(0);
    expect((await h.call('GET', link!, { token: null })).status).toBe(410);

    // Idempotent, and the live rows and the user's data are untouched.
    h.clock.t = now;
    expect(await (await cron(TEST_CRON_SECRET)).json()).toEqual({
      exportFiles: 0,
      signInCodes: 0,
      sessions: 0,
      rateLimits: 0,
      turf: { claimed: 0, deferred: 0, failed: 0, remaining: 0 },
    });
    expect((await h.db.select().from(authSessions)).map((r) => r.id)).toEqual(['s-live']);
    expect((await h.db.select().from(authVerifications)).map((r) => r.id)).toEqual(['v-live']);
    expect(await h.db.select().from(rateLimits)).toEqual([]);
    expect((await h.call('GET', '/v1/activities/run-1')).status).toBe(200);

    const purged = log.lines.map((l) => JSON.parse(l)).filter((l) => l.msg === 'retention.purged');
    expect(purged).toHaveLength(3);
  });
});

describe('support lookups (user:find, user:delete)', () => {
  it('finds an account by id or e-mail with counts and consents, never coordinates', async () => {
    h = await backupApp();
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
    await h.call('PUT', '/v1/activities/run-1', { body: upload() });
    await h.call('PUT', '/v1/activities/run-2', { body: upload() });
    await h.call('DELETE', '/v1/activities/run-2');
    await h.call('PUT', '/v1/turf/home-city', { body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' } });

    const byId = await findAccount(h.db, 'admin');
    expect(byId).toMatchObject({
      id: 'admin',
      email: 'admin@cityturfer.com',
      signInEmail: null,
      activities: 1,
      tombstones: 1,
      lastActivityAt: upload().endedAt,
      consents: [{ purpose: 'cloud-sync', granted: true, policyVersion: '2026-10' }],
    });
    expect(await findAccount(h.db, ' Admin@CityTurfer.com ')).toEqual(byId);
    expect(JSON.stringify(byId)).not.toMatch(/21\.01|52\.22|pl-warsaw|Morning run/);
    expect(await findAccount(h.db, 'nobody@example.com')).toBeNull();
  });

  it('finds a sign-in account by its sign-in e-mail, and erasing it leaves nothing to find', async () => {
    h = await backupApp();
    const token = await h.signIn('ania@example.com');
    const me = await (await h.call('GET', '/v1/me', { token })).json();
    const found = await findAccount(h.db, 'ania@example.com');
    expect(found).toMatchObject({ id: me.id, signInEmail: 'ania@example.com', sessions: 1, activities: 0 });

    await h.store.eraseAccount(me.id);
    expect(await findAccount(h.db, me.id)).toBeNull();
    expect(await findAccount(h.db, 'ania@example.com')).toBeNull();
    const left = await h.db.execute(sql`SELECT count(*)::int AS n FROM auth_users WHERE id = ${me.id}`);
    expect((left as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
    // The other account is untouched.
    expect(await findAccount(h.db, 'admin')).toBeNull(); // never seen in this test
    expect((await h.call('GET', '/v1/me', { token: TOKENS.admin })).status).toBe(200);
  });
});
