import type { Database } from './database';

/** Runs a named one-off maintenance job once per database; a failed job is retried next launch. */
export async function runOnce<T>(db: Database, name: string, job: () => Promise<T>): Promise<T | null> {
  if (await db.first('SELECT 1 AS x FROM sys_jobs WHERE name = ?', [name])) {
    return null;
  }
  const result = await job();
  await db.run('INSERT OR REPLACE INTO sys_jobs (name, done_at, result) VALUES (?, ?, ?)', [
    name,
    Date.now(),
    JSON.stringify(result ?? null),
  ]);
  return result;
}
