/**
 * Fair use of the shared public router (FOSSGIS usage policy) for Route Planning: at most one request
 * a second, at most 30 in any 5 minutes, a pause when the service says "too many requests"
 * (Retry-After) or the phone is offline. Past the budget legs stay straight. In memory only.
 * Separate from Activity Log's gap budget (core, not exported): each feature paces its own requests.
 */
export const MIN_REQUEST_INTERVAL_MS = 1_000;
export const BUDGET_WINDOW_MS = 5 * 60_000;
export const MAX_REQUESTS_PER_WINDOW = 30;
export const DEFAULT_RETRY_AFTER_MS = 60_000;
export const MAX_RETRY_AFTER_MS = 60 * 60_000;
export const OFFLINE_PAUSE_MS = 15_000;

export class StreetRouterBudget {
  private sent: number[] = [];
  private pausedUntil = 0;

  constructor(
    private readonly now: () => number,
    private readonly wait: (ms: number) => Promise<void>
  ) {}

  /** Takes one request from the budget (waiting out the interval), or false while paused or spent. */
  async take(): Promise<boolean> {
    const now = this.now();
    if (now < this.pausedUntil) {
      return false;
    }
    this.sent = this.sent.filter((t) => now - t < BUDGET_WINDOW_MS);
    if (this.sent.length >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    const last = this.sent[this.sent.length - 1];
    const ms = last == null ? 0 : last + MIN_REQUEST_INTERVAL_MS - now;
    if (ms > 0) {
      await this.wait(ms);
    }
    this.sent.push(this.now());
    return true;
  }

  rateLimited(retryAfterMs: number | null): void {
    this.pause(Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAfterMs ?? DEFAULT_RETRY_AFTER_MS)));
  }

  offline(): void {
    this.pause(OFFLINE_PAUSE_MS);
  }

  private pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
  }
}
