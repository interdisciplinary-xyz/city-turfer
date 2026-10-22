import type { CookieOptions } from 'hono/utils/cookie';

/**
 * The browser session cookie (docs/decisions/api-web-sessions-2026-10-22.md). The website reaches
 * the API through a same-site rewrite (`/api/v1/*` → this API's `/v1/*`), so the cookie is scoped
 * to that path on the website's host: host-only (no `Domain`), `Secure` (the `__Secure-` prefix
 * demands it), `HttpOnly` (page scripts never see the token) and `SameSite=Strict`.
 */
export const SESSION_COOKIE = '__Secure-ct_session';

export const SESSION_COOKIE_ATTRIBUTES = {
  path: '/api/v1',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
} as const satisfies CookieOptions;
