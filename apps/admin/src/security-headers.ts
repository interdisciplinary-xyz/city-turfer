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
