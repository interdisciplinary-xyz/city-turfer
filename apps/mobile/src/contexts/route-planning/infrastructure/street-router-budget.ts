/**
 * Route Planning's own share of the shared public router (FOSSGIS usage policy): at most 30 requests
 * in any 5 minutes; past it legs stay straight. The one-a-second pacing and the pauses after a 429 or
 * an offline error are app-wide, in the OsmRouterGate (platform/osm-router-gate.ts) that Activity
 * Log's gap estimates pass through too. In memory only.
 */
export const BUDGET_WINDOW_MS = 5 * 60_000;
export const MAX_REQUESTS_PER_WINDOW = 30;

export class StreetRouterBudget {
  private sent: number[] = [];

  constructor(private readonly now: () => number) {}

  /** Whether the window still has a request left (takes nothing). */
  hasRoom(): boolean {
    const now = this.now();
    this.sent = this.sent.filter((t) => now - t < BUDGET_WINDOW_MS);
    return this.sent.length < MAX_REQUESTS_PER_WINDOW;
  }

  /** Counts a request that is about to leave. */
  record(): void {
    this.sent.push(this.now());
  }
}
