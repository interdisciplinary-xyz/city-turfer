import type { CookieOptions } from 'hono/utils/cookie';

/**
 * The browser session cookie (decision W1, docs/decisions/api-web-sessions-2026-10-22.md). The
 * website reaches the API through a same-site rewrite (`/api/v1/*` → this API's `/v1/*`), so the
 * cookie lives on the website's host. `__Host-`: the browser takes it only with `Secure`, `Path=/`
 * and no `Domain`, so a sibling host on the site's domain (the planned admin host, any future
 * subdomain) cannot plant or shadow it. `HttpOnly` (page scripts never see the token) and
 * `SameSite=Strict`. Hono's setCookie refuses a `__Host-` cookie without these attributes.
 */
export const SESSION_COOKIE = '__Host-ct_session';

export const SESSION_COOKIE_ATTRIBUTES = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
} as const satisfies CookieOptions;
