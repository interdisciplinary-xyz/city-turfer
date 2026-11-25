/**
 * Error reporting port: how infrastructure and UI code hand an *unexpected* error to crash
 * reporting. Expected outcomes (offline, permission denied, validation) are never reported.
 * Domain and application layers never see it (dependency rule): they throw, and the adapter or
 * driving code that catches decides. The context must be coordinate-free; the Sentry adapter
 * scrubs every event again (@cityturfer/core/error-scrub) before it leaves the phone.
 */
export interface ErrorContext {
  /** Where it happened: 'recording', 'outbox', 'health-sync', 'cloud-backup', 'ui'… */
  area: string;
  /** A stable, coordinate-free code ('outbox.dead-letter', 'ingest-task'…): groups the reports. */
  code?: string;
  /** Extra low-cardinality, coordinate-free tags. */
  tags?: Record<string, string>;
}

export interface ErrorReporter {
  /** Never throws, never blocks. */
  report(error: unknown, ctx: ErrorContext): void;
}

/** Reporting off (opt-out, no DSN, development, tests). */
export const noopReporter: ErrorReporter = { report: () => undefined };

/**
 * The process-wide reporter the containers hold: it forwards to whichever reporter is active now
 * (no-op until crash reporting starts, again after the Turfer turns it off).
 */
export class SwitchableErrorReporter implements ErrorReporter {
  private target: ErrorReporter = noopReporter;

  use(target: ErrorReporter): void {
    this.target = target;
  }

  report(error: unknown, ctx: ErrorContext): void {
    try {
      this.target.report(error, ctx);
    } catch {
      // reporting must never break the caller (the background task included)
    }
  }
}

/** An error built from a diagnostics code and message (no original error object to report). */
export class ReportedFailure extends Error {
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'ReportedFailure';
  }
}

/** The per-device "Send crash reports" switch (on unless the Turfer turned it off). */
export interface CrashReportSetting {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}
