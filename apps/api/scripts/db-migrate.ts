// Applies the committed migrations in apps/api/drizzle/ to the Neon database.
//   DATABASE_URL=… pnpm --filter @cityturfer/api run db:migrate
// Uses DATABASE_URL_UNPOOLED (direct connection) when set, else DATABASE_URL. Safe to re-run:
// drizzle records applied migrations in drizzle.__drizzle_migrations and runs only new ones, all in
// one transaction. Prints no connection details.
import path from 'node:path';

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) to the Neon connection string.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });
  console.log('Migrations applied.');
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
