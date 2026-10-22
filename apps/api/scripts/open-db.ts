// The database of the support scripts: DATABASE_URL_UNPOOLED or DATABASE_URL (Neon), else the local
// dev server's PGlite in apps/api/.data/pglite (stop the dev server first). Prints no connection
// details.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { createNeonDb } from '../src/db/neon';
import { createPgliteDb } from '../src/db/pglite';
import type { Db } from '../src/db/store';

export async function openDb(): Promise<{ db: Db; close: () => Promise<void>; where: 'neon' | 'local PGlite' }> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (url) {
    return { ...createNeonDb(url), where: 'neon' };
  }
  const dataDir = path.join(import.meta.dirname, '..', '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  return { ...(await createPgliteDb(dataDir)), where: 'local PGlite' };
}
