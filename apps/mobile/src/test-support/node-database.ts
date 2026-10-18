import BetterSqlite3 from 'better-sqlite3';

import { type Database, Mutex, type SqlExecutor, type SqlParam } from '@/platform/database';

/** better-sqlite3 behind the platform Database interface — tests run real SQL. */
export function openNodeDatabase(): Database {
  const raw = new BetterSqlite3(':memory:');
  raw.pragma('foreign_keys = ON');
  const mutex = new Mutex();
  const exec: SqlExecutor = {
    run: async (sql, params = []) => void raw.prepare(sql).run(...(params as SqlParam[])),
    all: async <T>(sql: string, params: readonly SqlParam[] = []) =>
      raw.prepare(sql).all(...(params as SqlParam[])) as T[],
    first: async <T>(sql: string, params: readonly SqlParam[] = []) =>
      (raw.prepare(sql).get(...(params as SqlParam[])) as T) ?? null,
  };
  return {
    // Same locking as the app's expo-sqlite adapter: reads and writes queue behind open transactions.
    run: (sql, params) => mutex.lock(() => exec.run(sql, params)),
    all: (sql, params) => mutex.lock(() => exec.all(sql, params)),
    first: (sql, params) => mutex.lock(() => exec.first(sql, params)),
    exec: (sql) => mutex.lock(async () => void raw.exec(sql)),
    transaction: (work) =>
      mutex.lock(async () => {
        raw.exec('BEGIN');
        try {
          const r = await work(exec);
          raw.exec('COMMIT');
          return r;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      }),
    close: async () => void raw.close(),
  };
}
