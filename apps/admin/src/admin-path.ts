/**
 * Where the admin lives: Next's basePath (next.config.ts). The panel, Payload's REST API
 * (`/admin/api`) and Next's own files (`/admin/_next`) all sit under it, so in dev the website's
 * server can hand this one prefix over to the admin (https://cityturfer.local/admin, see
 * apps/web/tools/admin-route.mjs) without clashing with the site's own `/api` and `/_next`.
 */
export const ADMIN_BASE_PATH = '/admin';

/** The admin's dev server (`pnpm --filter @cityturfer/admin dev`); apps/web proxies /admin to it. */
export const ADMIN_DEV_PORT = 3100;
