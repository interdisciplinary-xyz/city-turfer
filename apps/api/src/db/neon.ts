import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

import type { Db } from './store';

/**
 * Neon Postgres over WebSockets (`@neondatabase/serverless` Pool): supports transactions, which the
 * backup needs (per-user lock + change counter). Node 22 has a global WebSocket, so no `ws`
 * package. One pool per function instance; connections are opened lazily on the first query.
 */
export function createNeonDb(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url, max: 5 });
  // An idle client dropped by the server must not crash the function; the next query reconnects.
  pool.on('error', () => undefined);
  return { db: drizzle({ client: pool }) as unknown as Db, close: () => pool.end() };
}
