import * as SQLite from 'expo-sqlite';

import { type Database, Mutex, type SqlExecutor, type SqlParam } from './database';

class ExpoDatabase implements Database {
  private readonly mutex = new Mutex();
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  private executor(): SqlExecutor {
    const db = this.db;
    return {
      run: async (sql, params = []) => {
        await db.runAsync(sql, params as SqlParam[]);
      },
      all: (sql, params = []) => db.getAllAsync(sql, params as SqlParam[]),
      first: (sql, params = []) => db.getFirstAsync(sql, params as SqlParam[]),
    };
  }

  // One native connection: while a transaction is open, ANY statement on it runs
  // inside that transaction. So reads queue behind the mutex too — otherwise a
  // read could see another caller's uncommitted (maybe later rolled back) writes.
  // Inside `transaction(work)` use the `tx` executor, which bypasses the mutex
  // (calling `db.*` from inside `work` would wait for the transaction itself).
  run(sql: string, params?: readonly SqlParam[]) {
    return this.mutex.lock(() => this.executor().run(sql, params));
  }
  all<T>(sql: string, params?: readonly SqlParam[]) {
    return this.mutex.lock(() => this.executor().all<T>(sql, params));
  }
  first<T>(sql: string, params?: readonly SqlParam[]) {
    return this.mutex.lock(() => this.executor().first<T>(sql, params));
  }
  exec(sql: string) {
    return this.mutex.lock(() => this.db.execAsync(sql));
  }
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.mutex.lock(async () => {
      let result!: T;
      await this.db.withTransactionAsync(async () => {
        result = await work(this.executor());
      });
      return result;
    });
  }
  close() {
    return this.mutex.lock(() => this.db.closeAsync()); // never close under an open transaction
  }
}

export async function openExpoDatabase(name: string): Promise<Database> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return new ExpoDatabase(db);
}
