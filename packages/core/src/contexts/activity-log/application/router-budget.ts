/**
 * Fair use of a shared public router (FOSSGIS usage policy): at most one request
 * per second, a cap per estimation run, a pause when the service says "too many
 * requests" or the device is offline, and exponential backoff for an activity
 * whose gaps keep failing. In memory only: a fresh app start begins a fresh budget.
 */
export const MIN_REQUEST_INTERVAL_MS = 1_000;
export const MAX_REQUESTS_PER_RUN = 20;
/** After a run used its whole budget, wait this long before starting another one. */
export const RUN_COOLDOWN_MS = 60_000;
export const DEFAULT_RETRY_AFTER_MS = 60_000;
export const MAX_RETRY_AFTER_MS = 60 * 60_000;
export const OFFLINE_RETRY_MS = 30_000;
export const FIRST_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 6 * 60 * 60_000;

export class RouterBudget {
  private lastRequestAt: number | null = null;
  private requestsThisRun = 0;
  private pausedUntil = 0;
  private readonly failures = new Map<string, { count: number; retryAt: number }>();

  constructor(
    private readonly now: () => number,
    private readonly wait: (ms: number) => Promise<void>
  ) {}

  /** False while paused (rate limited, offline, cooling down); otherwise opens a new run. */
  beginRun(): boolean {
    if (this.now() < this.pausedUntil) {
      return false;
    }
    this.requestsThisRun = 0;
    return true;
  }

  /** Whether another request fits into this run. Exhausting the run starts the cooldown. */
  hasRequestLeft(): boolean {
    if (this.requestsThisRun < MAX_REQUESTS_PER_RUN) {
      return true;
    }
    this.pauseFor(RUN_COOLDOWN_MS);
    return false;
  }

  /** Waits until the next request is allowed, then counts it. */
  async acquire(): Promise<void> {
    if (this.lastRequestAt != null) {
      const ms = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - this.now();
      if (ms > 0) {
        await this.wait(ms);
      }
    }
    this.lastRequestAt = this.now();
    this.requestsThisRun++;
  }

  pauseFor(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
  }

  rateLimited(retryAfterMs: number | null): void {
    this.pauseFor(Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAfterMs ?? DEFAULT_RETRY_AFTER_MS)));
  }

  isBackingOff(activityId: string): boolean {
    const f = this.failures.get(activityId);
    return f != null && this.now() < f.retryAt;
  }

  failed(activityId: string): void {
    const count = (this.failures.get(activityId)?.count ?? 0) + 1;
    const delay = Math.min(MAX_BACKOFF_MS, FIRST_BACKOFF_MS * 2 ** (count - 1));
    this.failures.set(activityId, { count, retryAt: this.now() + delay });
  }

  succeeded(activityId: string): void {
    this.failures.delete(activityId);
  }
}
