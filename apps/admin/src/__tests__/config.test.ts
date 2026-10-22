import { describe, expect, it } from 'vitest';

import configPromise, { MISSING_ADMIN_URL } from '../payload.config';

const ACCESS_KEYS = ['admin', 'read', 'create', 'update', 'delete', 'unlock'] as const;

describe('payload config', async () => {
  const config = await configPromise;

  it('turns GraphQL and telemetry off', () => {
    expect(config.graphQL.disable).toBe(true);
    expect(config.telemetry).toBe(false);
  });

  it('uses its own cookie prefix, host-only Strict staff cookies and no API keys', () => {
    expect(config.cookiePrefix).toBe('ct-admin');
    const staff = config.collections.find((c) => c.slug === 'staff');
    expect(staff?.auth.cookies.sameSite).toBe('Strict');
    expect(staff?.auth.cookies.domain).toBeUndefined();
    expect(staff?.auth.useAPIKey).toBe(false);
    expect(config.admin.user).toBe('staff');
  });

  it('fails closed without ADMIN_URL: the staff cookie is accepted from no real origin', () => {
    // The tests run without ADMIN_URL, as `next build` and CI do.
    expect(process.env.ADMIN_URL).toBeFalsy();
    // Payload also adds serverURL (the same placeholder) to the CSRF list.
    expect(new Set(config.csrf)).toEqual(new Set([MISSING_ADMIN_URL]));
    expect(config.cors).toEqual([MISSING_ADMIN_URL]);
  });

  it('has no document locks (their internal collection would allow any signed-in user)', () => {
    expect(config.collections.map((c) => c.slug)).not.toContain('payload-locked-documents');
  });

  it('sets every access rule of every own collection (no Payload default left in place)', () => {
    // Payload's internal collections: payload-kv denies all, payload-preferences is per user,
    // payload-migrations has no REST endpoints; payload-locked-documents is absent (test above).
    const own = config.collections.filter((c) => !c.slug.startsWith('payload-'));
    expect(own.map((c) => c.slug)).toEqual(['staff']);
    for (const c of own) {
      for (const key of ACCESS_KEYS) {
        const fn = (c.access as Record<string, unknown>)[key];
        expect(typeof fn, `${c.slug}.access.${key}`).toBe('function');
        // The defaults allow any signed-in user; ours must refuse a signed-out visitor.
        expect((fn as (a: unknown) => unknown)({ req: { user: null } }), `${c.slug}.access.${key}`).toBe(false);
      }
    }
  });
});
