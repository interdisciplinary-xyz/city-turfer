import { NAME } from '@cityturfer/brand';
import type { SanitizedConfig } from 'payload';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ACCESS_KEYS = ['admin', 'read', 'create', 'update', 'delete', 'unlock', 'readVersions'] as const;

/** An active support-read member: Payload's default access lets any signed-in user through. */
const SUPPORT = { id: 2, collection: 'staff', roles: ['support-read'], disabled: false };

/** Loads payload.config.ts afresh with the given env, so a developer's shell can't change the result. */
async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    vi.stubEnv(k, v);
  }
  const mod = await import('../payload.config');
  // From the same fresh module graph as the config, so the functions can be compared by identity.
  const { Staff } = await import('../collections/staff/staff');
  return { config: (await mod.default) as SanitizedConfig, mod, Staff };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('payload config', async () => {
  const { config, mod, Staff } = await loadConfig({ ADMIN_URL: '', PAYLOAD_DATABASE_URL: '' });

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
    // Payload also adds serverURL (the same placeholder) to the CSRF list.
    expect(new Set(config.csrf)).toEqual(new Set([mod.MISSING_ADMIN_URL]));
    expect(config.cors).toEqual([mod.MISSING_ADMIN_URL]);
  });

  it('accepts the staff cookie from ADMIN_URL only, when it is set', async () => {
    const { config: withUrl } = await loadConfig({ ADMIN_URL: 'https://admin.example' });
    expect(new Set(withUrl.csrf)).toEqual(new Set(['https://admin.example']));
    expect(withUrl.cors).toEqual(['https://admin.example']);
  });

  it('makes no third-party request and exposes no OG image endpoint', () => {
    expect(config.admin.avatar).toBe('default');
    expect(config.admin.meta.defaultOGImageType).toBe('off');
    expect(config.admin.meta.titleSuffix).toBe(` · ${NAME} admin`);
    expect(JSON.stringify(config.admin.meta.icons)).toContain('/admin/mark.svg');
  });

  it('puts the panel at the root of the /admin basePath, the REST API at /admin/api', () => {
    expect(config.routes.admin).toBe('/');
    // Payload's default, pinned because the proxy and the basePath rely on it: /admin + /api.
    expect(config.routes.api).toBe('/api');
  });

  it('leaves importMap.js to `pnpm run generate` (no rewrite by the dev server)', () => {
    expect(config.admin.importMap.autoGenerate).toBe(false);
  });

  it('refuses a short secret in production, and only there', () => {
    expect(() => mod.checkSecret('x', 'production')).toThrow(/at least 32/);
    expect(() => mod.checkSecret(undefined, 'production')).toThrow();
    expect(() => mod.checkSecret('a'.repeat(32), 'production')).not.toThrow();
    expect(() => mod.checkSecret('x', 'development')).not.toThrow();
  });

  it('has no document locks (their internal collection would allow any signed-in user)', () => {
    expect(config.collections.map((c) => c.slug)).not.toContain('payload-locked-documents');
  });

  it('keeps our own access rule for every key (none left to Payload’s signed-in-is-enough default)', () => {
    // Payload's internal collections: payload-kv denies all, payload-preferences is per user,
    // payload-migrations has no REST endpoints; payload-locked-documents is absent (test above).
    const own = config.collections.filter((c) => !c.slug.startsWith('payload-'));
    expect(own.map((c) => c.slug)).toEqual(['staff']);
    const staff = own[0];
    for (const key of ACCESS_KEYS) {
      const ours = (Staff.access as Record<string, unknown>)[key];
      expect(ours, `Staff.access.${key} is set in staff.ts`).toBeTypeOf('function');
      expect((staff.access as Record<string, unknown>)[key], `staff.access.${key}`).toBe(ours);
    }
    // And they behave unlike the default: a signed-in support member may not manage staff.
    const req = { user: SUPPORT };
    for (const key of ['create', 'delete', 'unlock', 'readVersions'] as const) {
      const fn = staff.access[key] as unknown as (a: { req: unknown }) => unknown;
      expect(fn({ req }), key).toBe(false);
    }
  });
});
