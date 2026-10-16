import type { DomainEvent } from '@/shared-kernel';

import type { Database, SqlExecutor } from './database';

/** Append events inside the caller's transaction (transactional outbox). */
export async function appendToOutbox(tx: SqlExecutor, events: readonly DomainEvent[], now: number): Promise<void> {
  for (const e of events) {
    await tx.run('INSERT INTO sys_outbox (type, payload, created_at) VALUES (?, ?, ?)', [
      e.type,
      JSON.stringify(e),
      now,
    ]);
  }
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Delivers persisted events to idempotent handlers after commit and on app
 * start. A failing handler leaves the event pending for the next run.
 */
export class EventDispatcher {
  private readonly handlers = new Map<string, EventHandler[]>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private readonly changeListeners = new Set<() => void>();

  constructor(private readonly db: Database) {}

  on(type: string, handler: EventHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  /** Notified after a dispatch run processed at least one event (UI refresh hook). */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /** Coalesces concurrent calls; always finishes with an empty queue or a failing event. */
  dispatchPending(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        if ((await this.drain()) > 0) this.changeListeners.forEach((l) => l());
      } while (this.rerun);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<number> {
    let processed = 0;
    for (;;) {
      const row = await this.db.first<{ id: number; payload: string }>(
        'SELECT id, payload FROM sys_outbox WHERE processed_at IS NULL ORDER BY id LIMIT 1'
      );
      if (!row) return processed;
      const event = JSON.parse(row.payload) as DomainEvent;
      try {
        for (const h of this.handlers.get(event.type) ?? []) await h(event);
      } catch (e) {
        if (__DEV__) console.warn(`[outbox] handler failed for ${event.type}`, e);
        return processed; // retry on next dispatch
      }
      await this.db.run('UPDATE sys_outbox SET processed_at = ? WHERE id = ?', [Date.now(), row.id]);
      processed++;
    }
  }
}
