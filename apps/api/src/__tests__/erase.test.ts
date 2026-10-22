import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backupApp, closeSharedDb, TOKENS, upload } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

beforeEach(async () => {
  h = await backupApp();
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

/** Rows per table that belong to `userId` (by `user_id`, or `id` for the account tables). */
async function rowsOf(userId: string): Promise<Record<string, number>> {
  const tables = [
    'consents',
    'activities',
    'activity_tracks',
    'gap_routes',
    'tombstones',
    'home_cities',
    'auth_sessions',
  ];
  const out: Record<string, number> = {};
  for (const t of tables) {
    const r = await h.db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${t}" WHERE user_id = '${userId}'`));
    out[t] = (r as unknown as { rows: { n: number }[] }).rows[0].n;
  }
  for (const t of ['users', 'auth_users']) {
    const r = await h.db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${t}" WHERE id = '${userId}'`));
    out[t] = (r as unknown as { rows: { n: number }[] }).rows[0].n;
  }
  return out;
}

describe('DELETE /v1/me', () => {
  it('erases every row of the account in one go; the session token answers 401 afterwards', async () => {
    const token = await h.signIn('ania@example.com');
    const me = await (await h.call('GET', '/v1/me', { token })).json();
    const consent = { granted: true, policyVersion: '2026-10' };
    await h.call('PUT', '/v1/me/consents/cloud-sync', { token, body: consent });
    await h.call('PUT', '/v1/activities/a1', { token, body: upload() });
    await h.call('PUT', '/v1/activities/a2', { token, body: upload() });
    await h.call('PUT', '/v1/activities/a1/gap-routes', {
      token,
      body: { checkedAt: '2026-10-19T08:00:00Z', routes: [] },
    });
    await h.call('DELETE', '/v1/activities/a2', { token });
    await h.call('PUT', '/v1/turf/home-city', {
      token,
      body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' },
    });
    // A pending code for the same address (a minute later: one mail per address per minute).
    h.clock.t += 61_000;
    await h.call('POST', '/v1/auth/codes', { token: null, body: { email: 'ania@example.com' } });

    // Another user's data must survive.
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: consent });
    await h.call('PUT', '/v1/activities/a1', { body: upload() });

    const before = await rowsOf(me.id);
    expect(Object.values(before).every((n) => n > 0)).toBe(true);

    expect((await h.call('DELETE', '/v1/me', { token })).status).toBe(204);
    expect(Object.values(await rowsOf(me.id)).every((n) => n === 0)).toBe(true);
    const codes = await h.db.execute(sql`SELECT count(*)::int AS n FROM auth_verifications`);
    expect((codes as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
    expect((await h.call('GET', '/v1/me', { token })).status).toBe(401);

    expect((await h.call('GET', '/v1/activities/a1')).status).toBe(200);
    expect((await rowsOf('admin')).activities).toBe(1);

    // Signing in again starts a new, empty account.
    h.clock.t += 61_000;
    const again = await h.signIn('ania@example.com', '198.51.100.2');
    const fresh = await (await h.call('GET', '/v1/me', { token: again })).json();
    expect(fresh.id).not.toBe(me.id);
    expect((await (await h.call('GET', '/v1/sync/changes', { token: again })).json()).changes).toEqual([]);
  });

  it('erases a device-token user too; its next request starts an empty account', async () => {
    await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
    await h.call('PUT', '/v1/activities/a1', { body: upload() });
    expect((await h.call('DELETE', '/v1/me')).status).toBe(204);
    expect((await h.call('DELETE', '/v1/me')).status).toBe(204);
    expect((await h.call('GET', '/v1/activities/a1')).status).toBe(404);
    expect((await (await h.call('GET', '/v1/me/consents')).json()).items).toEqual([]);
    // Writes work again (the user row is re-created), behind a fresh consent.
    expect((await h.call('PUT', '/v1/activities/a1', { body: upload() })).status).toBe(403);
    expect((await h.call('GET', '/v1/me', { token: TOKENS.other })).status).toBe(200);
  });
});
