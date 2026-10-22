// Local dev server: `pnpm --filter @cityturfer/api dev` → http://localhost:8787 (Swagger at /swagger).
// The website's dev server proxies https://cityturfer.local/api/* here.
//
// - With DATABASE_URL: the Neon database it names. Without: PGlite persisted in apps/api/.data/
//   (gitignored), migrated on start.
// - With API_TOKENS: those device tokens. Without API_TOKENS and DATABASE_URL: one dev token,
//   `dev-token`, for user `admin` on PGlite only (src/index.ts, the Vercel entry, has no fallback).
// - Sign-in codes are printed here (ConsoleMailer), never e-mailed. On PGlite a dev
//   BETTER_AUTH_SECRET is used when none is set; AUTH_FIXED_CODE=000000 is the code for
//   addresses @e2e.cityturfer.test only (sign-in, step-up and new-address codes).
// - The breached-password check is a fake (no network): `password1234` counts as breached.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createPgliteDb } from './db/pglite';
import { FakeBreachedPasswords } from './identity/breached-passwords';
import { consoleMailer } from './identity/mailer';
import { LOCAL_API_PORT } from './spec';
import { productionDeps } from './wiring';

const DEV_TOKEN = 'dev-token';
/** Local PGlite only: a published, worthless secret. */
const DEV_AUTH_SECRET = 'cityturfer-local-dev-secret-not-for-deployments';

const env = { ...process.env };
const local = !env.DATABASE_URL;
// The dev token only ever reaches the local PGlite database, never one DATABASE_URL names (Neon).
const devToken = !env.API_TOKENS && local;
if (devToken) {
  env.API_TOKENS = JSON.stringify({ [createHash('sha256').update(DEV_TOKEN).digest('hex')]: 'admin' });
}
if (local && !env.BETTER_AUTH_SECRET) {
  env.BETTER_AUTH_SECRET = DEV_AUTH_SECRET;
}
let db;
if (local) {
  const dataDir = path.join(import.meta.dirname, '..', '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  ({ db } = await createPgliteDb(dataDir));
}
// No network for the breach check here: the fake refuses DEV_BREACHED_PASSWORDS only.
const deps = productionDeps(env, { db, mailer: consoleMailer, breached: new FakeBreachedPasswords() });

const port = Number(process.env.PORT ?? LOCAL_API_PORT);
serve({ fetch: createApp(deps).fetch, port }, (info) => {
  const notes = [
    local ? 'database: PGlite in apps/api/.data' : 'database: DATABASE_URL',
    devToken ? `token: Bearer ${DEV_TOKEN} (user admin)` : env.API_TOKENS ? 'tokens: API_TOKENS' : 'no device tokens',
    deps.identity ? 'sign-in codes: printed here' : 'sign-in: off (set BETTER_AUTH_SECRET)',
  ];
  process.stdout.write(`CityTurfer API on http://localhost:${info.port} (docs: /swagger; ${notes.join('; ')})\n`);
});
