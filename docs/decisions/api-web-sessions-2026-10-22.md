---
status: canonical
verified: 2026-10-22
owner: founder
scope:
  [
    apps/api/src/middleware.ts,
    apps/api/src/session-cookie.ts,
    apps/api/src/identity,
    apps/api/src/routes/identity.ts,
    apps/api/drizzle/0004_browser_sessions.sql,
  ]
summary:
  Browser sessions for the web portal (contract 0.5.0) — an HttpOnly cookie on the website's /api/v1
  rewrite instead of a token in the page, requireCaller (bearer or cookie, realm user), the CSRF
  guard, 14/30-day and 8-hour lifetimes, signed-in devices, and the no-store caching default
---

# Browser sessions for the web portal (contract 0.5.0)

Web portal Slice 0 ("trust page", the web portal plan of 2026-10-22; the site side in
`docs/decisions/web-portal-2026-10-22.md`) lets a user who backed up from the phone sign in on the
website to see, export and delete that copy. The founder decided on 2026-10-22: keep the static
export, so pages fetch from the browser through a same-site rewrite `/api/v1/*` → the API (D1); the
portal lives at `/[locale]/account` (D3); web sessions last **14 days sliding, 30 days absolute**,
and "This is a shared computer" makes it a browser-session cookie with an **8-hour** cap (D4); "sign
out everywhere" includes phones (D11, recommended). Everything is additive: phones send nothing new
and get the same answers plus two fields. Accounts and phone sessions:
`docs/decisions/api-accounts-2026-10-22.md`.

## Decisions

| #   | Decision         | Chosen                                                                                                                                                                                                                                                                                        | Rejected                                                                                                                                                        |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Credential       | `POST /v1/auth/sign-in` with `client: "browser"` sets `__Secure-ct_session=<signed token>; Path=/api/v1; HttpOnly; Secure; SameSite=Strict`, host-only, `Max-Age` 30 days (none when shared), and leaves `token` out of the body. Same signed Better Auth token as phones, different delivery | the token in the body kept in `localStorage`/memory (any XSS steals it); Better Auth's own cookie via `auth.handler` (ungenerated spec, its cookie names/paths) |
| W2  | One middleware   | `requireCaller`: `Authorization: Bearer` (wins when both are sent) or the cookie; principals carry `realm: 'user'` and the `credential`; any other realm → 401                                                                                                                                | a second set of `/web/*` routes (two contracts)                                                                                                                 |
| W3  | Binding          | phone sessions and device tokens only as bearer; browser sessions only from the cookie (`auth_sessions.client`)                                                                                                                                                                               | accepting any session anywhere (a leaked phone token would get the browser's CSRF-free path and vice versa)                                                     |
| W4  | CSRF             | cookie + POST/PUT/PATCH/DELETE (and the browser sign-in, against login CSRF) need `Origin` = `WEB_ORIGIN`, `Sec-Fetch-Site: same-origin` when sent, and `CityTurfer-Client: web/<version>`; else `403 auth.csrf`. Bearer requests are exempt. GETs rely on `SameSite=Strict`                  | CSRF tokens (state for the static pages to fetch and echo; the three checks already cover browsers we support); CORS (the rewrite makes it same-origin)         |
| W5  | Lifetime         | IdentityService slides sessions itself (Better Auth's refresh is off): phones 60 days as before; browsers 14 days, at most once a day, never past `absolute_expires_at` (30 days, or 8 hours shared, not sliding). Migration `0004_browser_sessions` adds `client` and `absolute_expires_at`  | Better Auth's single global `expiresIn` (one lifetime for both); a separate table for browser sessions (two lookups)                                            |
| W6  | Signed-in list   | `GET /v1/auth/sessions` → `id` (Better Auth's random row id, not the token), `client`, `createdAt`, `lastActiveAt` (to the day), `expiresAt`, `current`; still no IP or user agent stored (A4)                                                                                                | showing browser/OS names (needs the user agent: personal data we said we don't keep)                                                                            |
| W7  | Revoke           | `DELETE /v1/auth/sessions/{id}`: own live sessions only, anything else 404 (also a second revoke); `DELETE /v1/auth/sessions?scope=others\|all`; sign-out, revoking the current browser session, `scope=all` and `DELETE /v1/me` clear the cookie (`Max-Age=0`)                               | 204 for unknown ids, the usual DELETE convention (the plan wants 404 for someone else's id, and one answer for both keeps them indistinguishable)               |
| W8  | Caching          | middleware default on `/v1/*`: `Cache-Control: private, no-store` unless a route sets its own (tracks keep `private, no-cache` + ETag), and `Vary: Cookie, Authorization` always                                                                                                              | per-route headers only (easy to forget one; Vercel caches external rewrites that send cacheable headers)                                                        |
| W9  | Client IP        | `x-vercel-forwarded-for`, then `x-real-ip`, then the first `x-forwarded-for` (Vercel's docs: a proxy in front can overwrite `x-forwarded-for`, not `x-vercel-forwarded-for`)                                                                                                                  | `x-forwarded-for` first (the rewrite hop may replace it)                                                                                                        |
| W10 | `WEB_ORIGIN` env | a bare `https://` origin; off Vercel it defaults to `https://cityturfer.local`; on Vercel unset → browser sessions off (phones unaffected); malformed → boot fails                                                                                                                            | required in production (a forgotten variable would take the phone API down with it)                                                                             |

## Contract (0.5.0)

- `POST /v1/auth/sign-in` `{ email, code, client?: "phone" | "browser", sharedComputer?: boolean }`
  (`sharedComputer: true` with a phone is 400) →
  `200 { token?, client, expiresAt, absoluteExpiresAt | null, user: { id, email } }`; browsers: no
  `token`, the cookie in `Set-Cookie`; outside the website `403 auth.csrf`.
- Every protected route: `bearerAuth` **or** `cookieAuth`; writes with the cookie may answer
  `403 auth.csrf`; a refused cookie (`401`) is cleared in the same answer.
- `GET /v1/auth/sessions` →
  `{ sessions: [{ id, client, createdAt, lastActiveAt, expiresAt, current }] }`.
- `DELETE /v1/auth/sessions/{sessionId}` → 204 | 404. `DELETE /v1/auth/sessions?scope=others|all`
  → 204. Device tokens are not sessions: never listed, never revoked here.

## Open (prove on a Vercel preview before production)

1. The cookie survives the website's rewrite: `Set-Cookie` arrives on the website's host with
   `Path=/api/v1`, and the browser sends it back on `/api/v1/*` only (Chrome and Safari).
2. `Origin` and `Sec-Fetch-Site` reach the API unchanged through the rewrite.
3. The client IP: an echo of `x-vercel-forwarded-for`, `x-real-ip` and `x-forwarded-for` through the
   rewrite shows the visitor's IP, not a Vercel address. If not, every web sign-in shares one per-IP
   bucket (`AUTH_LIMITS`: 20 failed sign-ins and 30 codes per 10 minutes); the per-address limits
   still hold. Fallback: a secret header set by the website's rewrite (`transforms`) to mark trusted
   hops, or the Vercel Firewall for per-IP limits.
4. Nothing is cached at the edge (`x-vercel-cache` is `MISS`/absent on personal answers).
5. The phone handles a `401` after "sign out everywhere" (mobile check, mobile-reviewer).
