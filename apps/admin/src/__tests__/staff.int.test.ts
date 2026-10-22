/**
 * The staff rules against a real Payload and Postgres. Runs only when PAYLOAD_TEST_DATABASE_URL names
 * a throwaway database (it applies the migrations and deletes every staff account in it); CI sets it
 * to a Postgres service container:
 *
 *   PAYLOAD_TEST_DATABASE_URL=$URL pnpm --filter @cityturfer/admin test:unit
 */
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.PAYLOAD_TEST_DATABASE_URL;
const PASSWORD = 'correct horse battery staple';

describe.skipIf(!url)('staff against Postgres', () => {
  let payload: Payload;
  let p: typeof import('payload');
  let bootstrap: string;

  beforeAll(async () => {
    process.env.PAYLOAD_DATABASE_URL = url;
    process.env.PAYLOAD_SECRET ??= 'test-only-secret-0123456789abcdef';
    p = await import('payload');
    bootstrap = (await import('../collections/staff/hooks')).STAFF_BOOTSTRAP;
    const config = (await import('../payload.config')).default;
    payload = await p.getPayload({ config });
    const { migrations } = await import('../migrations');
    await payload.db.migrate({ migrations: migrations as never });
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
    ).rejects.toThrow();
    expect((await payload.count({ collection: 'staff', overrideAccess: true })).totalDocs).toBe(0);
  });

  it('refuses an anonymous Local API create without the bootstrap flag', async () => {
    await expect(
      payload.create({
        collection: 'staff',
        data: { email: 'anon@example.com', password: PASSWORD, roles: ['support-read'] },
        overrideAccess: true,
      })
    ).rejects.toThrow();
  });

  it('signs in active staff and refuses a disabled one', async () => {
    await create('admin@example.com', ['staff-admin']);
    await create('gone@example.com', ['support-read'], true);
    const ok = await payload.login({ collection: 'staff', data: { email: 'admin@example.com', password: PASSWORD } });
    expect(ok.token).toBeTruthy();
    await expect(
      payload.login({ collection: 'staff', data: { email: 'gone@example.com', password: PASSWORD } })
    ).rejects.toThrow();
  });

  it('shows support staff only themselves and ignores their attempt to raise their roles', async () => {
    const support = await create('support@example.com', ['support-read']);
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
    ).rejects.toThrow();
  });

  it("ends a signed-in member's session when they are disabled, also after re-enabling", async () => {
    const member = await create('leaver@example.com', ['support-read']);
    const { token } = await payload.login({
      collection: 'staff',
      data: { email: 'leaver@example.com', password: PASSWORD },
    });
    const headers = new Headers({ Authorization: `JWT ${token}` });
    expect((await payload.auth({ headers })).user?.id).toBe(member.id);
    await payload.update({ collection: 'staff', id: member.id, data: { disabled: true }, overrideAccess: true });
    expect((await payload.auth({ headers })).user).toBeNull();
    await payload.update({ collection: 'staff', id: member.id, data: { disabled: false }, overrideAccess: true });
    expect((await payload.auth({ headers })).user).toBeNull();
  });

  it('refuses forgot-password (no e-mail adapter; the endpoint is public)', async () => {
    await expect(
      payload.forgotPassword({ collection: 'staff', data: { email: 'admin@example.com' }, disableEmail: true })
    ).rejects.toThrow();
  });
});
