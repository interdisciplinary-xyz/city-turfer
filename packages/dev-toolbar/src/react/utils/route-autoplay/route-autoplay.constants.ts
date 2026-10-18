/** Persisted per tab (sessionStorage): it must survive each step's reload. */
export type RouteAutoplayState = {
  playing: boolean;
  /** Routes autoplay has opened this run — never opened twice. */
  attempted: string[];
  /** Set when the run ended by itself: nothing unvisited was left. */
  finishedAt: number | null;
  startedAt: number | null;
};

export type RouteAutoplayStore = {
  state: RouteAutoplayState;
  listeners: Set<() => void>;
};

export type PageSettleInput = {
  /** Request-log entries (any page). */
  entries: ReadonlyArray<{
    page: string | null;
    status: number | 'pending' | 'failed';
    startedAt: number;
    durationMs: number | null;
  }>;
  /** The page being measured (`location.pathname`). */
  page: string;
  /** When this document started loading (epoch ms). */
  loadedAt: number;
  now: number;
};

export const IDLE_ROUTE_AUTOPLAY: RouteAutoplayState = {
  playing: false,
  attempted: [],
  finishedAt: null,
  startedAt: null,
};

/** Always stay at least this long, so late client effects get a chance. */
export const AUTOPLAY_MIN_DWELL_MS = 3_000;

/**
 * Nothing may have started or finished for this long. Covers one server
 * log poll (1.5 s), so SSR requests are in before the page is left.
 */
export const AUTOPLAY_QUIET_MS = 2_000;

/** Leave anyway — a page that keeps polling must not stall the run. */
export const AUTOPLAY_MAX_DWELL_MS = 20_000;

/** How often the controller re-checks whether the page has settled. */
export const AUTOPLAY_TICK_MS = 500;

/** On `window`, like the other dev stores, so HMR keeps one instance. */
export const ROUTE_AUTOPLAY_GLOBAL_KEY = Symbol.for('interdisciplinary.dev-toolbar.routeAutoplay');
