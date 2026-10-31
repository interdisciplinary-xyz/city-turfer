/**
 * Response headers for every admin route (next.config.ts). Staff only: nothing here is for search
 * engines, for framing by another site, or for loading anything from a third party.
 */
export function contentSecurityPolicy(dev: boolean): string {
  return [
    "default-src 'self'",
    // Next streams the page payload in inline scripts (no nonces with Payload's root layout); dev
    // also needs eval for React's tooling.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    // Payload's UI sets inline styles, and the brand theme is an inline <style>.
    "style-src 'self' 'unsafe-inline'",
    // No third-party images (Payload's Gravatar is off: payload.config.ts admin.avatar).
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function securityHeaders(dev: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
  ];
}

export const SECURITY_HEADER_SOURCE = '/:path*';

/**
 * Next prefixes a header `source` with the basePath (/admin), so SECURITY_HEADER_SOURCE alone covers
 * only /admin and below. The second rule (`basePath: false`) puts the same headers on every other
 * path of the admin's host, such as its 404s, so nothing there goes out without CSP or noindex.
 */
export function headerRules(dev: boolean) {
  const headers = securityHeaders(dev);
  return [
    { source: SECURITY_HEADER_SOURCE, headers },
    { source: SECURITY_HEADER_SOURCE, basePath: false as const, headers },
  ];
}

/** The admin host's root has nothing: staff land on the panel instead of a bare 404. */
export const ROOT_REDIRECTS = [{ source: '/', destination: '/admin', basePath: false as const, permanent: false }];
