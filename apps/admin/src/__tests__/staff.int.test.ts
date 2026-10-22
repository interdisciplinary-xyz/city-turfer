/**
 * The staff rules against a real Payload and Postgres, through the Local API and through Payload's
 * REST handler (the code behind `src/app/(payload)/api/[...slug]/route.ts`). Runs only when
 * PAYLOAD_TEST_DATABASE_URL names a throwaway database whose name ends in `_test` (it applies the
 * migrations and deletes every staff account in it); CI sets it to a Postgres service container and
 * fails if it goes missing:
 *
 *   PAYLOAD_TEST_DATABASE_URL=postgres://…/cityturfer_admin_test pnpm --filter @cityturfer/admin test:unit
 */
import type { Payload } from 'payload';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const url = process.env.PAYLOAD_TEST_DATABASE_URL;
const PASSWORD = 'correct horse battery staple';
const ORIGIN = 'https://admin.test';

if (process.env.CI && !url) {
  // Without this, a lost variable turns the whole suite into "skipped" and CI stays green.
  throw new Error('PAYLOAD_TEST_DATABASE_URL must be set in CI: the staff security tests would be skipped.');
}

/** Refuses any database that isn't plainly a throwaway: the suite deletes every staff account. */
function assertThrowaway(raw: string): void {
  const name = new URL(raw).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`PAYLOAD_TEST_DATABASE_URL must name a database ending in _test (got "${name}").`);
  }
  if (process.env.PAYLOAD_DATABASE_URL && process.env.PAYLOAD_DATABASE_URL === raw) {
    throw new Error('PAYLOAD_TEST_DATABASE_URL must differ from PAYLOAD_DATABASE_URL.');
  }
}

describe.skipIf(!url)('staff against Postgres', () => {
  let payload: Payload;
  let p: typeof import('payload');
  let bootstrap: string;

  beforeAll(async () => {
    assertThrowaway(url!);
    process.env.PAYLOAD_DATABASE_URL = url;
    process.env.ADMIN_URL = ORIGIN;
    process.env.PAYLOAD_SECRET ??= 'test-only-secret-0123456789abcdef';
    p = await import('payload');
    bootstrap = (await import('../collections/staff/hooks')).STAFF_BOOTSTRAP;
    const config = (await import('../payload.config')).default;
    payload = await p.getPayload({ config });
    const { migrations } = await import('../migrations');
    await payload.db.migrate({ migrations: migrations as never });
  });

  beforeEach(async () => {
    // Every test owns its rows.
    await payload.delete({ collection: 'staff', where: { id: { exists: true } }, overrideAccess: true });
  });

  afterAll(async () => {
    await payload?.destroy();
  });

  const create = (email: string, roles: string[], disabled = false) =>
    payload.create({
      collection: 'staff',
      data: { email, password: PASSWORD, roles: roles as never, disabled },
      overrideAccess: true,
      context: { [bootstrap]: true },
    });

  const count = async () => (await payload.count({ collection: 'staff', overrideAccess: true })).totalDocs;

  /** A request through Payload's REST handler, as the Next route sends it. */
  const rest = (method: string, path: string, init: { body?: unknown; headers?: Record<string, string> } = {}) =>
    p.handleEndpoints({
      config: payload.config,
      path: `/api${path}`,
      request: new Request(`${ORIGIN}/api${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    });

  const login = async (email: string) => {
    const { token } = await payload.login({ collection: 'staff', data: { email, password: PASSWORD } });
    return token!;
  };

  it("never pushes schema changes: admin's database changes only through migrations", () => {
    expect((payload.db as unknown as { push?: boolean }).push).toBe(false);
  });

  it("closes Payload's public create-first-user form on an empty database", async () => {
    const req = await p.createLocalReq({}, payload);
    await expect(
      p.registerFirstUserOperation({
        collection: payload.collections.staff,
        data: { email: 'intruder@example.com', password: PASSWORD, roles: ['staff-admin'] } as never,
        req,
      })
    ).rejects.toBeInstanceOf(p.Forbidden);
    expect(await count()).toBe(0);
  });

  it('refuses the public REST endpoints: first-register, an anonymous create, GraphQL', async () => {
    const intruder = { email: 'intruder@example.com', password: PASSWORD, roles: ['staff-admin'] };
    expect((await rest('POST', '/staff/first-register', { body: intruder, headers: { origin: ORIGIN } })).status).toBe(
      403
    );
    expect((await rest('POST', '/staff', { body: intruder, headers: { origin: ORIGIN } })).status).toBe(403);
    expect(await count()).toBe(0);
    expect((await rest('POST', '/graphql', { body: { query: '{ __typename }' } })).status).toBe(404);
  });

  it('refuses an anonymous Local API create without the bootstrap flag', async () => {
    await expect(
      payload.create({
        collection: 'staff',
        data: { email: 'anon@example.com', password: PASSWORD, roles: ['support-read'] },
        overrideAccess: true,
      })
    ).rejects.toBeInstanceOf(p.Forbidden);
    expect(await count()).toBe(0);
  });

  it('refuses a staff password shorter than 12 characters, in the panel too', async () => {
    await expect(
      payload.create({
        collection: 'staff',
        data: { email: 'short@example.com', password: 'abc', roles: ['support-read'] },
        overrideAccess: true,
        context: { [bootstrap]: true },
      })
    ).rejects.toBeInstanceOf(p.ValidationError);
    const member = await create('member@example.com', ['support-read']);
    await expect(
      payload.update({
        collection: 'staff',
        id: member.id,
        data: { password: 'abc' },
        overrideAccess: false,
        user: { ...member, collection: 'staff' } as never,
      })
    ).rejects.toBeInstanceOf(p.ValidationError);
  });

  it('signs in active staff and refuses a disabled one with the same error as a wrong password', async () => {
    await create('admin@example.com', ['staff-admin']);
    await create('gone@example.com', ['support-read'], true);
    expect(await login('admin@example.com')).toBeTruthy();
    const refuse = (email: string, password: string) =>
      payload.login({ collection: 'staff', data: { email, password } }).then(
        () => null,
        (e: Error) => e
      );
    const disabled = await refuse('gone@example.com', PASSWORD);
    const wrong = await refuse('admin@example.com', 'not the password at all');
    expect(disabled).toBeInstanceOf(p.AuthenticationError);
    expect(wrong).toBeInstanceOf(p.AuthenticationError);
    expect(disabled?.message).toBe(wrong?.message);
  });

  it('sets a host-only, HttpOnly, SameSite=Strict staff cookie on REST login', async () => {
    await create('admin@example.com', ['staff-admin']);
    const res = await rest('POST', '/staff/login', {
      body: { email: 'admin@example.com', password: PASSWORD },
      headers: { origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^ct-admin-token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('accepts the staff cookie from ADMIN_URL only (CSRF)', async () => {
    await create('admin@example.com', ['staff-admin']);
    const token = await login('admin@example.com');
    const as = (headers: Record<string, string>) =>
      payload.auth({ headers: new Headers({ cookie: `ct-admin-token=${token}`, ...headers }) }).then((r) => r.user);
    expect((await as({ origin: ORIGIN }))?.email).toBe('admin@example.com');
    expect(await as({ origin: 'https://evil.example' })).toBeNull();
    expect(await as({ 'sec-fetch-site': 'cross-site' })).toBeNull();
  });

  it('shows support staff only themselves and ignores their attempt to raise their roles', async () => {
    const support = await create('support@example.com', ['support-read']);
    await create('other@example.com', ['support-read']);
    const user = { ...support, collection: 'staff' } as never;
    const seen = await payload.find({ collection: 'staff', overrideAccess: false, user });
    expect(seen.docs.map((d) => d.email)).toEqual(['support@example.com']);
    const after = await payload.update({
      collection: 'staff',
      id: support.id,
      data: { roles: ['staff-admin'] },
      overrideAccess: false,
      user,
    });
    expect(after.roles).toEqual(['support-read']);
    await expect(
      payload.create({
        collection: 'staff',
        data: { email: 'friend@example.com', password: PASSWORD, roles: ['staff-admin'] },
        overrideAccess: false,
        user,
      })
    ).rejects.toBeInstanceOf(p.Forbidden);
  });

  it("ends a signed-in member's session when they are disabled, also after re-enabling", async () => {
    const member = await create('leaver@example.com', ['support-read']);
    const token = await login('leaver@example.com');
    // The browser's path: the cookie, from the admin's own origin.
    const headers = new Headers({ cookie: `ct-admin-token=${token}`, origin: ORIGIN });
    expect((await payload.auth({ headers })).user?.id).toBe(member.id);
    await payload.update({ collection: 'staff', id: member.id, data: { disabled: true }, overrideAccess: true });
    expect((await payload.auth({ headers })).user).toBeNull();
    await payload.update({ collection: 'staff', id: member.id, data: { disabled: false }, overrideAccess: true });
    expect((await payload.auth({ headers })).user).toBeNull();
  });

  it('refuses forgot-password for a real staff e-mail (no e-mail adapter; the endpoint is public)', async () => {
    await create('known@example.com', ['support-read']);
    await expect(
      payload.forgotPassword({ collection: 'staff', data: { email: 'known@example.com' }, disableEmail: true })
    ).rejects.toBeInstanceOf(p.Forbidden);
    expect((await rest('POST', '/staff/forgot-password', { body: { email: 'known@example.com' } })).status).toBe(403);
  });
});
