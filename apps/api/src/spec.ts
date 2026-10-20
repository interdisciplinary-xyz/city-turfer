/** OpenAPI document settings for `app.doc31()` and `scripts/emit-openapi.ts`. */

/**
 * Version of the API contract, not of the app: bump it when the contract changes. (The app's release
 * commit bumps package.json versions; the spec must not change with it.)
 */
export const API_VERSION = '0.2.0';

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
} as const;

/** Local dev API (`pnpm --filter @cityturfer/api dev`). */
export const LOCAL_API_PORT = 8787;

export const OPENAPI_CONFIG = {
  openapi: '3.1.0',
  info: {
    title: 'CityTurfer API',
    version: API_VERSION,
    description: [
      "The CityTurfer HTTP API: the app's use cases (Identity, Sync, Activity Log, Territory) over HTTP, for backup, sync across devices and future clients.",
      '',
      '**Status:** routes marked `x-cityturfer-status: planned` are designed and answer `501` until they are built (docs/decisions/api-2026-10-20.md).',
      '',
      '**Conventions:** JSON in camelCase; SI units with a suffix (`distanceM`, `movingS`); ISO 8601 UTC timestamps; coordinates `[lon, lat]`; bounding boxes `[west, south, east, north]`; errors as `application/problem+json`.',
      '',
      '**Privacy:** GPS tracks are personal data. They belong to the user, can be exported (`GET /v1/me/export`) and erased (`DELETE /v1/me`), and are never logged.',
    ].join('\n'),
    license: { name: 'Proprietary', identifier: 'LicenseRef-Proprietary' },
  },
  servers: [
    { url: 'https://cityturfer.local/api', description: 'Local, through the website dev server (pnpm run web:dev)' },
    {
      url: `http://localhost:${LOCAL_API_PORT}`,
      description: 'Local API dev server (pnpm --filter @cityturfer/api dev)',
    },
  ],
  tags: [
    { name: 'Platform', description: 'Health and docs.' },
    { name: 'Identity', description: 'Sign-in and the current user.' },
    { name: 'Sync', description: 'The changes feed devices pull; uploads go to the Activity Log.' },
    { name: 'Activity Log', description: 'Finished activities and their tracks.' },
    { name: 'Territory', description: 'Turf summary, cells and claims (recomputed from tracks) and the Home City.' },
    { name: 'Privacy', description: 'Export and erase everything (GDPR).' },
  ],
};
