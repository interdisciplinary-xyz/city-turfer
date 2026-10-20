// Local dev server: `pnpm --filter @cityturfer/api dev` → http://localhost:8787 (Swagger at /swagger).
// The website's dev server proxies https://cityturfer.local/api/* here.
//
// - With DATABASE_URL: the Neon database it names. Without: PGlite persisted in apps/api/.data/
//   (gitignored), migrated on start.
// - With API_TOKENS: those device tokens. Without: one dev token, `dev-token`, for user `admin`
//   (local only: src/index.ts, the Vercel entry, has no such fallback).
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createPgliteDb } from './db/pglite';
import { DrizzleBackupStore } from './db/store';
import { LOCAL_API_PORT } from './spec';
import { productionDeps } from './wiring';

const DEV_TOKEN = 'dev-token';

const env = { ...process.env };
if (!env.API_TOKENS) {
  env.API_TOKENS = JSON.stringify({ [createHash('sha256').update(DEV_TOKEN).digest('hex')]: 'admin' });
}
const deps = productionDeps(env);
if (!env.DATABASE_URL) {
  const dataDir = path.join(import.meta.dirname, '..', '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  const { db } = await createPgliteDb(dataDir);
  deps.store = new DrizzleBackupStore(db);
}

const port = Number(process.env.PORT ?? LOCAL_API_PORT);
serve({ fetch: createApp(deps).fetch, port }, (info) => {
  const notes = [
    env.DATABASE_URL ? 'database: DATABASE_URL' : 'database: PGlite in apps/api/.data',
    process.env.API_TOKENS ? 'tokens: API_TOKENS' : `token: Bearer ${DEV_TOKEN} (user admin)`,
  ];
  process.stdout.write(`CityTurfer API on http://localhost:${info.port} (docs: /swagger; ${notes.join('; ')})\n`);
});
