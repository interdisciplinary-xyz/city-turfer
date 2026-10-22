import { describe, expect, it } from 'vitest';

import { clientIp, edgeSecretMatches, WEB_EDGE_HEADER } from '../client-ip';
import { checkProductionEnv, webEdgeSecretOf } from '../wiring';

/** Which forwarded header the per-IP sign-in limits trust (src/client-ip.ts). Documentation addresses only. */

const SECRET = 'e'.repeat(64);
const headersOf = (h: Record<string, string>) => (name: string) =>
  Object.entries(h).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];

describe('clientIp', () => {
  it('ignores a forged x-vercel-forwarded-for from a direct caller', () => {
    const forged = { 'x-vercel-forwarded-for': '198.51.100.99', 'x-forwarded-for': '203.0.113.7' };
    expect(clientIp(headersOf(forged), null)).toBe('203.0.113.7');
    expect(clientIp(headersOf(forged), SECRET)).toBe('203.0.113.7');
    expect(clientIp(headersOf({ ...forged, [WEB_EDGE_HEADER]: 'wrong' }), SECRET)).toBe('203.0.113.7');
    expect(clientIp(headersOf({ ...forged, [WEB_EDGE_HEADER]: '' }), SECRET)).toBe('203.0.113.7');
  });

  it('trusts x-vercel-forwarded-for only with the website edge secret', () => {
    const viaWebsite = {
      [WEB_EDGE_HEADER]: SECRET,
      'x-vercel-forwarded-for': '198.51.100.20',
      'x-real-ip': '192.0.2.1',
      'x-forwarded-for': '192.0.2.1',
    };
    expect(clientIp(headersOf(viaWebsite), SECRET)).toBe('198.51.100.20');
    // The same headers without a configured secret: the address that reached the API.
    expect(clientIp(headersOf(viaWebsite), null)).toBe('192.0.2.1');
  });

  it('takes the last x-forwarded-for entry: the one the platform wrote, not one the caller prepended', () => {
    expect(clientIp(headersOf({ 'x-forwarded-for': '198.51.100.99, 203.0.113.7' }), null)).toBe('203.0.113.7');
    expect(clientIp(headersOf({ 'x-forwarded-for': ' 203.0.113.7 ' }), null)).toBe('203.0.113.7');
  });

  it('falls through x-forwarded-for → x-real-ip → unknown', () => {
    expect(clientIp(headersOf({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '192.0.2.1' }), null)).toBe(
      '203.0.113.7'
    );
    expect(clientIp(headersOf({ 'x-real-ip': '192.0.2.1' }), null)).toBe('192.0.2.1');
    expect(clientIp(headersOf({ 'x-forwarded-for': '203.0.113.7' }), null)).toBe('203.0.113.7');
    expect(clientIp(headersOf({}), null)).toBe('unknown');
    // Through the website without x-vercel-forwarded-for: the same fallbacks.
    expect(clientIp(headersOf({ [WEB_EDGE_HEADER]: SECRET, 'x-real-ip': '192.0.2.1' }), SECRET)).toBe('192.0.2.1');
  });

  it('compares the edge secret only when one is configured', () => {
    expect(edgeSecretMatches(SECRET, SECRET)).toBe(true);
    expect(edgeSecretMatches(undefined, SECRET)).toBe(false);
    expect(edgeSecretMatches('', null)).toBe(false);
    expect(edgeSecretMatches(SECRET.slice(1), SECRET)).toBe(false);
  });
});

describe('WEB_EDGE_SECRET', () => {
  const PROD = {
    VERCEL_ENV: 'production',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BREVO_API_KEY: 'brevo-test-key',
    MAIL_FROM: 'CityTurfer <hello@example.com>',
    API_PUBLIC_URL: 'https://api.example.com',
    DATABASE_URL: 'postgres://user:pass@db.example.com/cityturfer',
    CRON_SECRET: 'test-cron-secret-0123456789',
  };

  it('needs 32 characters, else it is off', () => {
    expect(webEdgeSecretOf({})).toBeNull();
    expect(webEdgeSecretOf({ WEB_EDGE_SECRET: 'short' })).toBeNull();
    expect(webEdgeSecretOf({ WEB_EDGE_SECRET: ` ${SECRET} ` })).toBe(SECRET);
  });

  it('is required in production once WEB_ORIGIN is set, and never named by value', () => {
    expect(() => checkProductionEnv(PROD)).not.toThrow();
    expect(() => checkProductionEnv({ ...PROD, WEB_ORIGIN: 'https://example.com' })).toThrow(/WEB_EDGE_SECRET/);
    expect(() =>
      checkProductionEnv({ ...PROD, WEB_ORIGIN: 'https://example.com', WEB_EDGE_SECRET: SECRET })
    ).not.toThrow();
    try {
      checkProductionEnv({ ...PROD, WEB_ORIGIN: 'https://example.com', WEB_EDGE_SECRET: 'tiny-edge' });
    } catch (error) {
      expect(String(error)).not.toContain('tiny-edge');
    }
  });
});
