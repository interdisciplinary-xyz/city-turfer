/** OpenAPI document settings for `app.doc31()` and `scripts/emit-openapi.ts`. */
import { API_GUIDE } from './guide';

/**
 * Version of the API contract, not of the app: bump it when the contract changes. (The app's release
 * commit bumps package.json versions; the spec must not change with it.)
 */
export const API_VERSION = '0.4.0';

export const SPEC_PATH = '/openapi.json';

/**
 * Swagger UI options shared by the API's /swagger and the website's dev route
 * (apps/web/tools/swagger-route.mjs keeps the same values; both are tested). `showExtensions` makes
 * `x-cityturfer-status: planned` visible.
 */
export const SWAGGER_UI_OPTIONS = {
  deepLinking: true,
  displayRequestDuration: true,
  persistAuthorization: true,
  showExtensions: true,
  docExpansion: 'list',
  // Light code blocks, to match the site's light theme (SITE_SCHEME in @cityturfer/brand).
  syntaxHighlight: { activated: true, theme: 'idea' },
} as const;

/** Local dev API (`pnpm --filter @cityturfer/api dev`). */
export const LOCAL_API_PORT = 8787;

export const OPENAPI_CONFIG = {
  openapi: '3.1.0',
  info: {
    title: 'CityTurfer API',
    version: API_VERSION,
    description: API_GUIDE,
    license: { name: 'Proprietary', identifier: 'LicenseRef-Proprietary' },
  },
  servers: [
    { url: 'https://cityturfer.local/api', description: 'Local, through the website dev server (pnpm run web:dev)' },
    {
      url: `http://localhost:${LOCAL_API_PORT}`,
      description: 'Local API dev server (pnpm --filter @cityturfer/api dev)',
    },
  ],
  externalDocs: {
    description: 'Design record: route table, sync protocol, decisions (docs/decisions/api-sync-2026-10-20.md)',
    url: 'https://github.com/interdisciplinary-xyz/city-turfer/blob/main/docs/decisions/api-sync-2026-10-20.md',
  },
  tags: [
    { name: 'Platform', description: 'Liveness. Public.' },
    {
      name: 'Identity',
      description:
        'Sign-in with an e-mailed one-time code (Better Auth behind our own routes), sign-out and the signed-in user.',
    },
    {
      name: 'Privacy',
      description:
        'Consents for cloud sync, the GDPR export (async, a file) and erasure of everything the server holds.',
    },
    {
      name: 'Sync',
      description:
        'The one feed every device pulls: activity upserts, tombstones and the Home City since a cursor. Uploads go to the Activity Log. See **Sync flow** below.',
    },
    {
      name: 'Activity Log',
      description:
        'Finished activities with their tracks, under ids the phone minted. Versioned (`ETag`, `If-Match`); deletes leave tombstones (`410` on re-upload).',
    },
    {
      name: 'Territory',
      description:
        "Turf recomputed on the server from uploaded tracks (never uploaded by phones) and the Home City. Numbers can differ slightly from the phone's (upload order, float maths); the server's are canonical for server views.",
    },
  ],
};
