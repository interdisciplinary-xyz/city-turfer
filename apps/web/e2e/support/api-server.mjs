// The API for the portal E2E: the same app and wiring as `pnpm --filter @cityturfer/api dev`
// (apps/api/src/server.ts), but on an in-memory PGlite, so every run starts empty and never opens
// apps/api/.data (which a running dev API may hold). Run with tsx (it loads the API's TypeScript).
//
// Env (set by playwright.config.ts): PORT, WEB_ORIGIN (the E2E site's https origin, for the CSRF
// guard), AUTH_FIXED_CODE (the code for @e2e.cityturfer.test addresses only).
import process from 'node:process';

import { serve } from '@hono/node-server';

import { createApp } from '../../../api/src/app';
import { createPgliteDb } from '../../../api/src/db/pglite';
import { FakeBreachedPasswords } from '../../../api/src/identity/breached-passwords';
import { nullMailer } from '../../../api/src/identity/mailer';
import { productionDeps } from '../../../api/src/wiring';

/** Local only: a published, worthless secret (the same idea as server.ts's dev secret). */
const E2E_AUTH_SECRET = 'cityturfer-e2e-secret-not-for-deployments-0000';

const env = { ...process.env, BETTER_AUTH_SECRET: E2E_AUTH_SECRET };
delete env.DATABASE_URL;
delete env.API_TOKENS;
delete env.VERCEL_ENV;

const { db } = await createPgliteDb();
// No mail at all: test addresses sign in with AUTH_FIXED_CODE. No network for the breach check.
const deps = productionDeps(env, { db, mailer: nullMailer, breached: new FakeBreachedPasswords() });
if (!deps.identity) {
  throw new Error('E2E API: sign-in is off (BETTER_AUTH_SECRET not accepted)');
}

const port = Number(env.PORT);
serve({ fetch: createApp(deps).fetch, port, hostname: '127.0.0.1' }, (info) => {
  process.stdout.write(`E2E API on http://127.0.0.1:${info.port} (in-memory PGlite)\n`);
});
