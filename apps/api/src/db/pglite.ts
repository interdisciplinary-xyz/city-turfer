// In-process Postgres (PGlite) for tests and the local dev server — never bundled into the Vercel
// function (src/index.ts does not import it). Same migrations as production.
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import type { Db } from './store';

export const MIGRATIONS_FOLDER = path.join(import.meta.dirname, '..', '..', 'drizzle');

/** A migrated PGlite database: in memory, or persisted in `dataDir`. */
export async function createPgliteDb(dataDir?: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite(dataDir);
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: db as unknown as Db, close: () => client.close() };
}
