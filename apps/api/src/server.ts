// Local dev server: `pnpm --filter @cityturfer/api dev` → http://localhost:8787 (Swagger at /swagger).
// The website's dev server proxies https://cityturfer.local/api/* here.
//
// - With DATABASE_URL: the Neon database it names. Without: PGlite persisted in apps/api/.data/
//   (gitignored), migrated on start; PGLITE_DIR=<folder> persists it there instead, and
//   PGLITE_DIR=memory keeps it in memory (test runs that must not touch your dev data).
// - With API_TOKENS: those device tokens. Without API_TOKENS and DATABASE_URL: one dev token,
//   `dev-token`, for user `admin` on PGlite only (src/index.ts, the Vercel entry, has no fallback).
// - Sign-in codes are printed here (ConsoleMailer), never e-mailed. On PGlite a dev
//   BETTER_AUTH_SECRET is used when none is set; AUTH_FIXED_CODE=000000 is the code for
//   addresses @e2e.cityturfer.test only (sign-in, step-up and new-address codes).
// - The breached-password check is a fake (no network): `password1234` counts as breached.
// - On PGlite the app's mock accounts exist too (src/dev/mock-accounts.ts): admin@cityturfer.com and
//   demo@cityturfer.com sign in with the code 000000 (AUTH_FIXED_CODE defaults to it here), and the
//   demo account is filled with the phone's Gdańsk demo history on first start.
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createPgliteDb } from './db/pglite';
import { adoptMockAccounts, MOCK_CODE, MOCK_EMAILS, seedDemoBackup } from './dev/mock-accounts';
import { FakeBreachedPasswords } from './identity/breached-passwords';
import { consoleMailer } from './identity/mailer';
import { LOCAL_API_PORT } from './spec';
import { productionDeps } from './wiring';

const DEV_TOKEN = 'dev-token';
/** Local PGlite only: a published, worthless secret. */
const DEV_AUTH_SECRET = 'cityturfer-local-dev-secret-not-for-deployments';

/** Where the local PGlite database lives: apps/api/.data by default, undefined for memory. */
function pgliteDir(value: string | undefined): string | undefined {
  if (value === 'memory') {
    return undefined;
  }
  return value ? path.resolve(value) : path.join(import.meta.dirname, '..', '.data', 'pglite');
}

const env = { ...process.env };
const local = !env.DATABASE_URL;
// The dev token only ever reaches the local PGlite database, never one DATABASE_URL names (Neon).
const devToken = !env.API_TOKENS && local;
const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');
// The demo seed uploads as user `demo` with a token that lives in this process only (never printed).
const seedToken = local ? randomBytes(32).toString('base64url') : null;
const tokens: Record<string, string> = devToken ? { [sha256(DEV_TOKEN)]: 'admin' } : {};
if (seedToken) {
  tokens[sha256(seedToken)] = 'demo';
}
if (Object.keys(tokens).length > 0) {
  const own = env.API_TOKENS ? (JSON.parse(env.API_TOKENS) as Record<string, string>) : {};
  env.API_TOKENS = JSON.stringify({ ...own, ...tokens });
}
if (local && !env.BETTER_AUTH_SECRET) {
  env.BETTER_AUTH_SECRET = DEV_AUTH_SECRET;
}
if (local && !env.AUTH_FIXED_CODE) {
  env.AUTH_FIXED_CODE = MOCK_CODE;
}
let db;
if (local) {
  const dataDir = pgliteDir(env.PGLITE_DIR);
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true });
  }
  ({ db } = await createPgliteDb(dataDir));
  for (const note of await adoptMockAccounts(db)) {
    process.stdout.write(`mock accounts: ${note}\n`);
  }
}
// No network for the breach check here: the fake refuses DEV_BREACHED_PASSWORDS only.
const deps = productionDeps(env, {
  db,
  mailer: consoleMailer,
  breached: new FakeBreachedPasswords(),
  fixedCodeEmails: local ? MOCK_EMAILS : [],
});
const app = createApp(deps);

const port = Number(process.env.PORT ?? LOCAL_API_PORT);
// API_HOST=127.0.0.1 keeps a test run (fixed sign-in code) off the local network. Not HOST: some
// shells and CI images export that as the machine's name.
const hostname = process.env.API_HOST;
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const notes = [
    local ? `database: PGlite (${env.PGLITE_DIR ?? 'apps/api/.data'})` : 'database: DATABASE_URL',
    devToken ? `token: Bearer ${DEV_TOKEN} (user admin)` : env.API_TOKENS ? 'tokens: API_TOKENS' : 'no device tokens',
    deps.identity ? 'sign-in codes: printed here' : 'sign-in: off (set BETTER_AUTH_SECRET)',
    ...(local && deps.identity ? [`mock accounts: ${MOCK_EMAILS.join(', ')} (code ${env.AUTH_FIXED_CODE})`] : []),
  ];
  process.stdout.write(
    `CityTurfer API on http://${hostname ?? 'localhost'}:${info.port} (docs: /swagger; ${notes.join('; ')})\n`
  );
});

if (seedToken && deps.identity) {
  seedDemoBackup((request) => app.fetch(request), seedToken)
    .then(({ uploaded, total }) => {
      if (uploaded > 0) {
        process.stdout.write(`demo@cityturfer.com: uploaded ${uploaded} of ${total} demo activities\n`);
      }
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `demo@cityturfer.com: demo seed failed (${error instanceof Error ? error.message : 'error'})\n`
      );
    });
}
