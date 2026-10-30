import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { buildConfig } from 'payload';

import { devOriginWarning } from './admin-path';
import { MARK_PATH } from './brand/mark-route.constants';
import { Staff } from './collections/staff/staff';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Both fall back to a host that cannot exist, so a missing variable fails closed rather than open
// while `next build` and `payload generate` still run without them:
// - an empty connection string would make pg fill in PGHOST/PGUSER/PGDATABASE, which on Vercel's Neon
//   integration point at the API's database;
// - an empty CSRF list would make Payload accept the staff cookie from any Origin.
export const MISSING_DATABASE_URL = 'postgres://payload-database-url-not-set.invalid:5432/none';
export const MISSING_ADMIN_URL = 'https://admin-url-not-set.invalid';

// Admin's own database (decision AD2): never the API's DATABASE_URL, which admin must not know.
const databaseUrl = process.env.PAYLOAD_DATABASE_URL || MISSING_DATABASE_URL;
// The public origin, e.g. https://cityturfer.local in dev (the panel at /admin). It is the only origin allowed to
// send the staff cookie (CSRF) and the only CORS origin.
const adminUrl = process.env.ADMIN_URL || MISSING_ADMIN_URL;

// Dev server only: a stale ADMIN_URL breaks sign-in without any error (the host only, no secrets).
if (process.env.NODE_ENV === 'development') {
  const warning = devOriginWarning(process.env.ADMIN_URL);
  if (warning) {
    console.warn(`[admin] ${warning}`);
  }
}

/** It signs every staff session: `openssl rand -hex 32` (.env.example). */
export const MIN_SECRET_LENGTH = 32;

/** Refuses to start in production with a guessable secret (an empty one Payload refuses itself). */
export function checkSecret(secret: string | undefined, env: string | undefined = process.env.NODE_ENV): void {
  if (env === 'production' && (secret ?? '').length < MIN_SECRET_LENGTH) {
    throw new Error(`PAYLOAD_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
}

/**
 * Payload owns only admin data (staff accounts). User data reaches admin only through the API's
 * audited /internal/admin routes, from server code (the admin-portal skill); no collection here
 * maps onto the API's tables.
 */
export default buildConfig({
  serverURL: adminUrl,
  // Next's basePath (/admin, next.config.ts) already prefixes every route: the panel is its root and
  // the REST API is /admin/api.
  routes: { admin: '/' },
  secret: process.env.PAYLOAD_SECRET ?? '',
  admin: {
    user: Staff.slug,
    // Written only by `pnpm run generate` (Prettier-formatted, checked by generate:check), never by
    // the dev server's hot reload.
    importMap: { baseDir: dirname, autoGenerate: false },
    // No Gravatar: Payload's default avatar would send each staff e-mail's hash to gravatar.com.
    avatar: 'default',
    meta: {
      // The name as in @cityturfer/brand's NAME (config.test.ts pins it): Payload's CLI loads this file
      // with tsx, which can't load the brand package's sources, so it can't be imported here.
      titleSuffix: ' · CityTurfer admin',
      // The brand mark, not Payload's; and no public /api/og image endpoint for a staff-only panel.
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: MARK_PATH }],
      defaultOGImageType: 'off',
    },
    // Brand look (src/brand): tokens from @cityturfer/brand mapped onto Payload's theme, the logos.
    components: {
      providers: ['/brand/brand-theme#BrandTheme'],
      graphics: { Logo: '/brand/logo#Logo', Icon: '/brand/icon#Icon' },
    },
  },
  collections: [Staff],
  db: postgresAdapter({
    pool: { connectionString: databaseUrl },
    // Schema changes only through committed migrations (src/migrations, `pnpm run migrate`), run as a
    // runbook step with the unpooled URL: never in the Vercel build, never pushed by the dev server.
    push: false,
    // A typo in the database name fails instead of creating an empty, unmigrated database.
    disableCreateDatabase: true,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  graphQL: { disable: true },
  cookiePrefix: 'ct-admin',
  csrf: [adminUrl],
  cors: [adminUrl],
  telemetry: false,
  onInit: () => checkSecret(process.env.PAYLOAD_SECRET),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts'), autoGenerate: false },
});
