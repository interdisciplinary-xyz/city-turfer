import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { buildConfig } from 'payload';

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
// The public origin, e.g. https://admin.cityturfer.local in dev. It is the only origin allowed to
// send the staff cookie (CSRF) and the only CORS origin.
const adminUrl = process.env.ADMIN_URL || MISSING_ADMIN_URL;

/**
 * Payload owns only admin data (staff accounts). User data reaches admin only through the API's
 * audited /internal/admin routes, from server code (the admin-portal skill); no collection here
 * maps onto the API's tables.
 */
export default buildConfig({
  serverURL: adminUrl,
  secret: process.env.PAYLOAD_SECRET ?? '',
  admin: {
    user: Staff.slug,
    importMap: { baseDir: dirname },
    meta: { titleSuffix: ' · CityTurfer admin' },
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
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  graphQL: { disable: true },
  cookiePrefix: 'ct-admin',
  csrf: [adminUrl],
  cors: [adminUrl],
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts'), autoGenerate: false },
});
