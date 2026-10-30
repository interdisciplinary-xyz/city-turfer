import { describe, expect, it } from 'vitest';

import { ADMIN_BASE_PATH, ADMIN_DEV_ORIGINS, devOriginWarning } from '../admin-path';
import {
  contentSecurityPolicy,
  headerRules,
  ROOT_REDIRECTS,
  SECURITY_HEADER_SOURCE,
  securityHeaders,
} from '../security-headers';

const header = (key: string, dev = false) => securityHeaders(dev).find((h) => h.key === key)?.value;

describe('admin security headers', () => {
  it('applies to every route', () => {
    expect(SECURITY_HEADER_SOURCE).toBe('/:path*');
  });

  it('keeps admin out of search engines and frames', () => {
    expect(header('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('no-referrer');
  });

  it('allows no third-party origin in production, and no eval', () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).not.toMatch(/https?:|\*|unsafe-eval/);
    expect(header('Content-Security-Policy')).toBe(csp);
  });

  it('adds only what the dev server needs in development', () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(true)).toContain('ws: wss:');
  });

  it('also covers the paths outside the basePath, and sends the bare root to the panel', () => {
    const rules = headerRules(false);
    expect(rules.map((r) => ('basePath' in r ? r.basePath : undefined))).toEqual([undefined, false]);
    for (const rule of rules) {
      expect(rule.source).toBe(SECURITY_HEADER_SOURCE);
      expect(rule.headers).toEqual(securityHeaders(false));
    }
    expect(ROOT_REDIRECTS).toEqual([{ source: '/', destination: ADMIN_BASE_PATH, basePath: false, permanent: false }]);
  });
});

describe('dev origin warning', () => {
  it('allows only the shared dev origin, with no wildcard', () => {
    expect(ADMIN_DEV_ORIGINS).toEqual(['cityturfer.local']);
  });

  it('is quiet for cityturfer.local and for an unset ADMIN_URL', () => {
    expect(devOriginWarning('https://cityturfer.local')).toBeNull();
    expect(devOriginWarning(undefined)).toBeNull();
    expect(devOriginWarning('')).toBeNull();
  });

  it('names the stale host and the fix, and nothing else', () => {
    const w = devOriginWarning('https://admin.cityturfer.local/path?token=secret');
    expect(w).toContain('admin.cityturfer.local');
    expect(w).toContain('https://cityturfer.local');
    expect(w).not.toContain('secret');
    expect(devOriginWarning('not a url')).toMatch(/not a valid URL/);
  });
});
