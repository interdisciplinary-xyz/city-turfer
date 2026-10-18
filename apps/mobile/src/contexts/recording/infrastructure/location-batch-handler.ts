/**
 * The background task's batch handling, free of Expo imports so it can be
 * tested headless (background-task.ts wires it to expo-location and the
 * composition root). Never throws.
 */
import type { IngestResult } from '../application/use-cases';
import type { Fix } from '../domain/fix';

export type BatchSource = 'task' | 'live';

/** The slice of the per-user container the handler needs. */
export interface BatchContainer {
  recording: { ingestFixes: { execute(fixes: readonly Fix[]): Promise<IngestResult> } };
  diagnostics: { log(kind: 'batch' | 'task-error', data: Record<string, unknown>): void };
}

export interface BatchHandlerDeps<L> {
  /** null: nobody is signed in. Rejects: can't tell right now (e.g. keychain read error). */
  getContainer(): Promise<BatchContainer | null>;
  /** Stop location updates (no user signed in: an orphaned tracker drains the battery). */
  stopTracking(): Promise<void>;
  toFix(location: L): Fix;
  /** Diagnostics fields of a batch: counts and timings only, never coordinates. */
  describe(source: BatchSource, locations: readonly L[]): Record<string, unknown>;
  /** Upper bound for getting the container and for one ingest (a hung container must not stall batches). */
  timeoutMs: number;
  warn(message: string, error?: unknown): void;
}

class Timeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => void = () => undefined): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Timeout(`timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

type Handoff =
  | { kind: 'no-user' }
  | { kind: 'expired' }
  | { kind: 'submitted'; container: BatchContainer; result: Promise<IngestResult> };

const MAX_DEFERRED = 20;

export function createLocationBatchHandler<L>(deps: BatchHandlerDeps<L>) {
  /**
   * Batches are handed to the container's Recording command queue (shared with
   * the UI's Start/Pause/Finish/...), which serializes the ingests. This chain
   * only keeps the hand-off in delivery order: getting the container is async,
   * and a batch submitted out of order would see its fixes dropped by the Fix
   * Filter as out-of-order. It never waits for an ingest.
   */
  let handoff: Promise<unknown> = Promise.resolve();
  /** Errors seen while no container was available to log them; written with the next batch. */
  const deferred: Record<string, unknown>[] = [];

  function note(container: BatchContainer | null, data: Record<string, unknown>) {
    if (container) {
      container.diagnostics.log('task-error', data);
    } else if (deferred.length < MAX_DEFERRED) {
      deferred.push({ ...data, at: Date.now() });
    }
  }

  function handOff(locations: readonly L[]): Promise<Handoff> {
    let expired = false;
    const acquire = async (): Promise<Handoff> => {
      const container = await deps.getContainer();
      if (expired) {
        return { kind: 'expired' };
      } // too late: submitting now could reorder batches
      if (!container) {
        return { kind: 'no-user' };
      }
      // Duplicates across the two streams are dropped by the Fix Filter (out-of-order).
      return {
        kind: 'submitted',
        container,
        result: container.recording.ingestFixes.execute(locations.map(deps.toFix)),
      };
    };
    const step = handoff.then(() => withTimeout(acquire(), deps.timeoutMs, () => (expired = true)));
    handoff = step.catch(() => undefined);
    return step;
  }

  return async function handleBatch(source: BatchSource, locations: readonly L[]): Promise<void> {
    let container: BatchContainer | null = null;
    try {
      let h: Handoff;
      try {
        h = await handOff(locations);
      } catch (e) {
        // Can't tell who is signed in (or the container hangs). NOT the same as "nobody":
        // keep the tracker and the session running; only this batch is skipped.
        const code = e instanceof Timeout ? `container-timeout-${source}` : `session-read-${source}`;
        deps.warn('[location-task] no container, batch skipped', e);
        note(null, { code, message: String(e), skippedFixes: locations.length });
        return;
      }
      if (h.kind === 'no-user') {
        return void (await deps.stopTracking());
      }
      if (h.kind === 'expired') {
        return;
      }
      container = h.container;
      for (const d of deferred.splice(0)) {
        container.diagnostics.log('task-error', d);
      }

      let result: IngestResult;
      try {
        result = await withTimeout(h.result, deps.timeoutMs);
      } catch (e) {
        if (!(e instanceof Timeout)) {
          throw e;
        }
        // The command keeps its place in the queue; we just stop waiting for it.
        deps.warn('[location-task] ingest timed out', e);
        note(container, { code: `ingest-timeout-${source}`, message: String(e), fixes: locations.length });
        return;
      }
      // No active session: IngestFixes already stopped the orphaned tracker, inside the queue.
      container.diagnostics.log('batch', {
        ...deps.describe(source, locations),
        bgSession: result.kind === 'ingested' ? result.keptAlive : null,
        ...(result.kind === 'ingested'
          ? { accepted: result.accepted, status: result.status, ...result.report }
          : { result: result.kind }),
      });
    } catch (e) {
      deps.warn('[location-task] ingest failed', e);
      try {
        note(container, { code: `ingest-${source}`, message: String(e) });
      } catch {
        // never throw from the task
      }
    }
  };
}
