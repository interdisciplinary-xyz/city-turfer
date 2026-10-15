import type { Database } from './database';

/**
 * Field diagnostics for tracking reliability (why do points go missing?).
 * Records counts, app state and timings only — never coordinates.
 */
export class Diagnostics {
  constructor(private readonly db: Database) {}

  log(kind: 'launch' | 'app-state' | 'batch' | 'task-error', data: Record<string, unknown>): void {
    void this.db
      .run('INSERT INTO sys_diagnostics (at, kind, data) VALUES (?, ?, ?)', [Date.now(), kind, JSON.stringify(data)])
      .catch(() => undefined);
  }

  prune(olderThanDays = 14): Promise<void> {
    return this.db.run('DELETE FROM sys_diagnostics WHERE at < ?', [Date.now() - olderThanDays * 86_400_000]);
  }
}
