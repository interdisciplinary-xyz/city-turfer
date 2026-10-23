import { afterAll, describe, expect, it } from 'vitest';

import { adoptMockAccounts, MOCK_CODE, MOCK_EMAILS, seedDemoBackup } from '../dev/mock-accounts';
import { backupApp, closeSharedDb, codeIn } from './support';

afterAll(closeSharedDb);

/** The test clock's day (support.ts: 2026-10-20 08:00 UTC): the demo plan ends the day before. */
const TODAY = Date.parse('2026-10-20T00:00:00Z');

async function signInWithMockCode(h: Awaited<ReturnType<typeof backupApp>>, email: string) {
  await h.call('POST', '/v1/auth/codes', { token: null, body: { email } });
  return h.call('POST', '/v1/auth/sign-in', { token: null, body: { email, code: MOCK_CODE } });
}

describe('local mock accounts (dev server only)', () => {
  it('signs admin@ and demo@ in with the fixed code, as their own users', async () => {
    const h = await backupApp({ fixedCode: MOCK_CODE, fixedCodeEmails: MOCK_EMAILS });
    expect(await adoptMockAccounts(h.db)).toEqual([]);
    expect(await adoptMockAccounts(h.db)).toEqual([]); // every start: idempotent

    for (const email of MOCK_EMAILS) {
      const res = await signInWithMockCode(h, email);
      expect(res.status).toBe(200);
      const { token } = (await res.json()) as { token: string };
      const me = await h.call('GET', '/v1/me', { token });
      expect(await me.json()).toMatchObject({ email });
    }
    // Other real addresses still get random codes.
    expect((await signInWithMockCode(h, 'someone@example.com')).status).toBe(401);
    expect(codeIn(h.mailer.lastTo('someone@example.com')?.text)).toMatch(/^\d{6}$/);
  });

  it('gives the mock addresses no fixed code without AUTH_FIXED_CODE (production)', async () => {
    const h = await backupApp({ fixedCodeEmails: MOCK_EMAILS });
    await adoptMockAccounts(h.db);
    expect((await signInWithMockCode(h, 'demo@cityturfer.com')).status).toBe(401);
  });

  it('notes a mock e-mail that already belongs to another local account', async () => {
    const h = await backupApp({ fixedCode: MOCK_CODE, fixedCodeEmails: MOCK_EMAILS });
    // Signed in before the mocks existed: Better Auth made a user with a random id.
    expect((await signInWithMockCode(h, 'demo@cityturfer.com')).status).toBe(200);
    expect(await adoptMockAccounts(h.db)).toEqual([expect.stringContaining('demo@cityturfer.com')]);
  });

  it('uploads the demo history to the demo account once, through the backup routes', async () => {
    const h = await backupApp({ fixedCode: MOCK_CODE, fixedCodeEmails: MOCK_EMAILS });
    await adoptMockAccounts(h.db);
    const { token } = (await (await signInWithMockCode(h, 'demo@cityturfer.com')).json()) as { token: string };
    const fetch = (request: Request) => h.app.fetch(request);

    expect(await seedDemoBackup(fetch, token, { today: TODAY, limit: 3 })).toEqual({ uploaded: 3, total: 3 });
    expect(await seedDemoBackup(fetch, token, { today: TODAY, limit: 3 })).toEqual({ uploaded: 0, total: 3 });

    const list = (await (await h.call('GET', '/v1/activities', { token })).json()) as {
      items: { id: string; source: string }[];
    };
    expect(list.items.map((a) => a.id).sort()).toEqual(['demo-gdansk-n0', 'demo-gdansk-n1', 'demo-gdansk-n2']);
    expect(list.items.every((a) => a.source === 'import')).toBe(true);
    const consents = (await (await h.call('GET', '/v1/me/consents', { token })).json()) as {
      items: { purpose: string; granted: boolean }[];
    };
    expect(consents.items).toContainEqual(expect.objectContaining({ purpose: 'cloud-sync', granted: true }));
  });
});
