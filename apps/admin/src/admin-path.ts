/**
 * Where the admin lives: Next's basePath (next.config.ts). The panel, Payload's REST API
 * (`/admin/api`) and Next's own files (`/admin/_next`) all sit under it, so in dev the website's
 * server can hand this one prefix over to the admin (https://cityturfer.local/admin, see
 * apps/web/tools/admin-route.mjs) without clashing with the site's own `/api` and `/_next`.
 */
export const ADMIN_BASE_PATH = '/admin';

/**
 * Production host (decision, review of PR 197): the admin keeps its OWN origin, e.g.
 * `https://admin.<domain>` with the panel at `/admin`, never a path under the public site's origin
 * and never a rewrite from it. On one origin the staff cookie (Payload sets `Path=/`) would travel
 * with every site and portal request, the portal's session cookie would reach the admin, and
 * SameSite and the Origin check would protect nothing. The shared origin below is dev only.
 */

/**
 * Dev only: the website's dev server proxies https://cityturfer.local/admin to the admin's dev
 * server (http://127.0.0.1:3100, the port in this package's `dev` script; apps/web's
 * tools/admin-route.mjs has the same default, which it can't import from here).
 */
export const ADMIN_DEV_ORIGINS = ['cityturfer.local'];

/**
 * A dev-only hint: the host of `adminUrl` (ADMIN_URL) when it is not one the dev proxy serves, so
 * sign-in would otherwise fail silently (CSRF rejects the Origin). Null when all is well.
 */
export function devOriginWarning(adminUrl: string | undefined): string | null {
  if (!adminUrl) {
    return null;
  }
  let host: string;
  try {
    host = new URL(adminUrl).hostname;
  } catch {
    return `ADMIN_URL is not a valid URL (apps/admin/.env.example).`;
  }
  if (ADMIN_DEV_ORIGINS.includes(host)) {
    return null;
  }
  return (
    `ADMIN_URL host "${host}" is not ${ADMIN_DEV_ORIGINS.join(', ')}: sign-in at ` +
    `https://${ADMIN_DEV_ORIGINS[0]}/admin will fail. If your .env still has ` +
    `https://admin.cityturfer.local, change it to https://cityturfer.local.`
  );
}
