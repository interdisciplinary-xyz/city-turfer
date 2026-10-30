import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, SECURITY_HEADER_SOURCE, securityHeaders } from '../security-headers';

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
});
