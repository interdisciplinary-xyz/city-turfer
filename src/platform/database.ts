/**
 * Minimal database interface used by every repository. Implemented by
 * expo-sqlite in the app and by better-sqlite3 in tests, so repository tests
 * run real SQL.
 */
export type SqlParam = string | number | null;

export interface SqlExecutor {
  run(sql: string, params?: readonly SqlParam[]): Promise<void>;
  all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
}

export interface Database extends SqlExecutor {
  exec(sql: string): Promise<void>;
  /** Serialised: only one transaction runs at a time across the whole app. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Promise-queue mutex so background-task writes and UI writes never interleave. */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  lock<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
