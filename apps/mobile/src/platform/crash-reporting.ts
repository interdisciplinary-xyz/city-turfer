/**
 * Starts and stops crash reporting by the Turfer's "Send crash reports" setting (on by default).
 * Platform-free (the composition root passes the Sentry adapter), so it is tested without Expo.
 * Every method is safe to call from the headless background task: none throws.
 */
import { type CrashReportSetting, type ErrorReporter, noopReporter, SwitchableErrorReporter } from './error-reporter';

export interface CrashReportingDeps {
  setting: CrashReportSetting;
  /** Starts the reporting SDK; null when it could not. Omitted: reporting can't run here (no DSN, development, tests). */
  start?: () => ErrorReporter | null;
  /** Shuts the SDK down after an opt-out. */
  stop: () => Promise<void>;
}

export class CrashReporting implements CrashReportSetting {
  /** The reporter to hand out: forwards to the SDK while reporting runs, to nothing otherwise. */
  readonly reporter = new SwitchableErrorReporter();
  private running = false;
  private starting: Promise<void> | null = null;

  constructor(private readonly deps: CrashReportingDeps) {}

  /** Starts reporting if the setting allows it and it isn't running yet. Fire and forget. */
  ensureStarted(): Promise<void> {
    if (this.running || !this.deps.start) {
      return Promise.resolve();
    }
    this.starting ??= this.startIfEnabled().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** "Send crash reports" (false also while the setting can't be read). */
  async isEnabled(): Promise<boolean> {
    return this.deps.setting.isEnabled().catch(() => false);
  }

  /** Saves the choice and applies it now: off stops the SDK, on starts it. */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.deps.setting.setEnabled(enabled);
    if (enabled) {
      await this.ensureStarted();
      return;
    }
    await this.starting?.catch(() => undefined);
    this.reporter.use(noopReporter);
    if (this.running) {
      this.running = false;
      await this.deps.stop().catch(() => undefined);
    }
  }

  private async startIfEnabled(): Promise<void> {
    try {
      // Unreadable setting: stays off for now and is read again on the next call.
      if (this.running || !(await this.isEnabled())) {
        return;
      }
      const reporter = this.deps.start?.() ?? null;
      if (reporter) {
        this.reporter.use(reporter);
        this.running = true;
      }
    } catch {
      // reporting stays off
    }
  }
}
