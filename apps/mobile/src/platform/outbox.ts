import { DomainError, type DomainEvent } from '@/shared-kernel';

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

/** An event the dispatcher gave up on. Carries no payload or message (they may hold coordinates). */
export interface DeadLetter {
  readonly id: number;
  readonly type: string;
  readonly attempts: number;
  /** DomainError code, or the error's class name (e.g. 'SyntaxError'). */
  readonly errorCode: string;
}

export interface DispatcherOptions {
  now?: () => number;
  /** Attempts before a failing event is dead-lettered. */
  maxAttempts?: number;
  /** The n-th retry waits `retryBaseMs * 2^(n-1)`. */
  retryBaseMs?: number;
  onDeadLetter?: (d: DeadLetter) => void;
}

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_RETRY_BASE_MS = 5_000;
export const OUTBOX_PROCESSED_RETENTION_DAYS = 30;
export const OUTBOX_DEAD_LETTER_RETENTION_DAYS = 90;

type OutboxRow = { id: number; type: string; payload: string; attempts: number; next_attempt_at: number | null };

/**
 * Delivers persisted events to idempotent handlers after commit and on app start.
 *
 * Ordering: strict FIFO by outbox id across all aggregates. A failing head
 * event blocks the queue while it is retried (exponential backoff, at most
 * `maxAttempts` attempts over successive dispatch runs), so no later event —
 * in particular no later event of the same aggregate — overtakes it.
 * A DomainError (a broken business rule: deterministic) or an unreadable
 * payload dead-letters the event at once; any other error dead-letters it
 * after `maxAttempts`. Dead-lettered events are skipped and later events,
 * including ones of the same aggregate, are still delivered: handlers are
 * idempotent and tolerate a missing predecessor (e.g. releasing turf that was
 * never claimed is a no-op).
 */
export class EventDispatcher {
  private readonly handlers = new Map<string, EventHandler[]>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private readonly changeListeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly retryBaseMs: number;
  private readonly onDeadLetter: (d: DeadLetter) => void;

  constructor(
    private readonly db: Database,
    options: DispatcherOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? OUTBOX_MAX_ATTEMPTS);
    this.retryBaseMs = options.retryBaseMs ?? OUTBOX_RETRY_BASE_MS;
    this.onDeadLetter = options.onDeadLetter ?? (() => undefined);
  }

  on(type: string, handler: EventHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  /** Notified after a dispatch run processed at least one event (UI refresh hook). */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /** Coalesces concurrent calls; finishes with an empty queue or a head event waiting for its retry. */
  dispatchPending(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        if ((await this.drain()) > 0) {
          this.changeListeners.forEach((l) => l());
        }
      } while (this.rerun);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<number> {
    let processed = 0;
    for (;;) {
      const row = await this.db.first<OutboxRow>(
        `SELECT id, type, payload, attempts, next_attempt_at FROM sys_outbox
         WHERE processed_at IS NULL AND dead_lettered_at IS NULL ORDER BY id LIMIT 1`
      );
      if (!row) {
        return processed;
      }
      if (row.next_attempt_at != null && row.next_attempt_at > this.now()) {
        return processed;
      } // backing off

      const attempts = row.attempts + 1;
      let event: DomainEvent;
      try {
        event = JSON.parse(row.payload) as DomainEvent;
      } catch (e) {
        await this.deadLetter(row, attempts, e);
        processed++;
        continue;
      }
      try {
        for (const h of this.handlers.get(event.type) ?? []) {
          await h(event);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn(`[outbox] handler failed for ${event.type}`, e);
        }
        if (e instanceof DomainError || attempts >= this.maxAttempts) {
          await this.deadLetter(row, attempts, e);
          processed++;
          continue; // later events are no longer blocked
        }
        await this.db.run(
          'UPDATE sys_outbox SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ? AND processed_at IS NULL',
          [attempts, describe(e), this.now() + this.retryBaseMs * 2 ** (attempts - 1), row.id]
        );
        return processed; // keep FIFO: the head is retried on a later dispatch
      }
      await this.db.run('UPDATE sys_outbox SET processed_at = ?, attempts = ? WHERE id = ?', [
        this.now(),
        attempts,
        row.id,
      ]);
      processed++;
    }
  }

  private async deadLetter(row: OutboxRow, attempts: number, e: unknown): Promise<void> {
    await this.db.run(
      'UPDATE sys_outbox SET attempts = ?, last_error = ?, dead_lettered_at = ? WHERE id = ? AND processed_at IS NULL',
      [attempts, describe(e), this.now(), row.id]
    );
    try {
      this.onDeadLetter({ id: row.id, type: row.type, attempts, errorCode: errorCode(e) });
    } catch {
      // diagnostics must never stop delivery
    }
  }
}

const errorCode = (e: unknown): string => (e instanceof DomainError ? e.code : e instanceof Error ? e.name : typeof e);

/** Stored locally in sys_outbox.last_error for debugging; never sent to diagnostics. */
const describe = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 300);

/** Retention: delete delivered events after 30 days and dead-lettered ones after 90. Pending rows are kept. */
export async function pruneOutbox(
  db: Database,
  now: number,
  processedDays = OUTBOX_PROCESSED_RETENTION_DAYS,
  deadLetteredDays = OUTBOX_DEAD_LETTER_RETENTION_DAYS
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM sys_outbox WHERE processed_at IS NOT NULL AND processed_at < ?', [
      now - processedDays * 86_400_000,
    ]);
    await tx.run('DELETE FROM sys_outbox WHERE dead_lettered_at IS NOT NULL AND dead_lettered_at < ?', [
      now - deadLetteredDays * 86_400_000,
    ]);
  });
}
