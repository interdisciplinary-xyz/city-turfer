/**
 * One gate in front of the shared FOSSGIS OSM router (constants/routing.ts) for the whole process:
 * Activity Log's gap estimates and Route Planning's street snapping both pass through it, so the
 * service's usage policy holds for the app, not per feature. Requests leave at least
 * OSM_ROUTER_MIN_INTERVAL_MS apart, and a "too many requests" (Retry-After) or an offline error seen
 * by either feature pauses both. In memory only; each feature keeps its own window cap on top.
 */
export const OSM_ROUTER_MIN_INTERVAL_MS = 1_000;
export const OSM_ROUTER_DEFAULT_RETRY_AFTER_MS = 60_000;
export const OSM_ROUTER_MAX_RETRY_AFTER_MS = 60 * 60_000;
export const OSM_ROUTER_OFFLINE_PAUSE_MS = 15_000;

export type OsmRouterTurn = { go: true } | { go: false; pausedMs: number };

export class OsmRouterGate {
  /** When the latest granted request may leave (its slot is reserved at once, so concurrent callers queue). */
  private nextSlotAt = Number.NEGATIVE_INFINITY;
  private pausedUntil = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))
  ) {}

  /**
   * A turn to send one request: waits out the interval since the previous one (from either feature),
   * or refuses while the router is paused (with how long the pause still runs).
   */
  async acquire(): Promise<OsmRouterTurn> {
    const paused = this.pausedFor();
    if (paused > 0) {
      return { go: false, pausedMs: paused };
    }
    const now = this.now();
    const slot = Math.max(now, this.nextSlotAt + OSM_ROUTER_MIN_INTERVAL_MS);
    this.nextSlotAt = slot;
    if (slot > now) {
      await this.wait(slot - now);
    }
    const pausedMeanwhile = this.pausedFor(); // a 429 may have arrived while this caller waited
    return pausedMeanwhile > 0 ? { go: false, pausedMs: pausedMeanwhile } : { go: true };
  }

  /** The router said 429: nobody asks until Retry-After (default a minute, at most an hour). */
  rateLimited(retryAfterMs: number | null): void {
    this.pause(Math.min(OSM_ROUTER_MAX_RETRY_AFTER_MS, Math.max(0, retryAfterMs ?? OSM_ROUTER_DEFAULT_RETRY_AFTER_MS)));
  }

  /** No connection at all: a short pause before anyone asks again. */
  offline(): void {
    this.pause(OSM_ROUTER_OFFLINE_PAUSE_MS);
  }

  private pausedFor(): number {
    return Math.max(0, this.pausedUntil - this.now());
  }

  private pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
  }
}

/** Retry-After is either delay-seconds or an HTTP date; null when missing or unreadable. */
export function retryAfterMs(header: string | null, nowMs: number): number | null {
  if (!header) {
    return null;
  }
  const s = Number(header);
  if (Number.isFinite(s)) {
    return Math.max(0, s * 1000);
  }
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - nowMs);
}
