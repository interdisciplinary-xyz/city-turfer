import type { Database } from './database';
import { type ErrorReporter, noopReporter, ReportedFailure } from './error-reporter';

type DiagnosticsKind = 'launch' | 'app-state' | 'batch' | 'task-error' | 'maintenance' | 'tracker' | 'backup';

/** How a `task-error` is forwarded to crash reporting; `false`: an expected outcome, not reported. */
export type ForwardOptions = { area?: string; tags?: Record<string, string> } | false;

/** Codes that are expected outcomes (the Turfer's own choices), kept on the phone only. */
const NOT_REPORTED = new Set(['health.route-not-saved']);

/** Area of a `task-error` code, for grouping and for the scrubber (health-sync keeps name + code only). */
export function areaOf(code: string): string {
  if (code.startsWith('health.')) {
    return 'health-sync';
  }
  if (code.startsWith('outbox.')) {
    return 'outbox';
  }
  if (code === 'maintenance') {
    return 'maintenance';
  }
  if (/^(ingest|session-read|container-timeout)-/.test(code)) {
    return 'recording';
  }
  return 'app';
}

/**
 * Field diagnostics for tracking reliability (why do points go missing?).
 * Records counts, app state and timings only — never coordinates.
 * A `task-error` is also forwarded to crash reporting (its code, and its message for the scrubber
 * to clean); nothing else is.
 */
export class Diagnostics {
  constructor(
    private readonly db: Database,
    private readonly reporter: ErrorReporter = noopReporter
  ) {}

  log(kind: DiagnosticsKind, data: Record<string, unknown>, forward: ForwardOptions = {}): void {
    void this.db
      .run('INSERT INTO sys_diagnostics (at, kind, data) VALUES (?, ?, ?)', [Date.now(), kind, JSON.stringify(data)])
      .catch(() => undefined);
    if (kind === 'task-error' && forward !== false) {
      this.forward(data, forward);
    }
  }

  prune(olderThanDays = 14): Promise<void> {
    return this.db.run('DELETE FROM sys_diagnostics WHERE at < ?', [Date.now() - olderThanDays * 86_400_000]);
  }

  private forward(data: Record<string, unknown>, options: { area?: string; tags?: Record<string, string> }): void {
    try {
      const code = data.code == null ? 'unknown' : String(data.code);
      if (NOT_REPORTED.has(code)) {
        return;
      }
      const message = typeof data.message === 'string' ? data.message : undefined;
      this.reporter.report(new ReportedFailure(code, message), {
        area: options.area ?? areaOf(code),
        code,
        ...(options.tags ? { tags: options.tags } : {}),
      });
    } catch {
      // diagnostics never throw
    }
  }
}
