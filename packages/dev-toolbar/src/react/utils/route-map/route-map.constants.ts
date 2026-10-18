import type { RequestLogSource, RequestLogStatus } from '../request-log/request-log.constants';

/** One distinct request (source + method + URL) made on behalf of a path. */
export type RouteMapRequest = {
  key: string;
  source: RequestLogSource;
  method: string;
  url: string;
  /** Server only: the route that made it (e.g. `/api/pages`, `… (prefetch)`). */
  via: string | null;
  /** Times it was made, across every recorded visit. */
  count: number;
  lastStatus: RequestLogStatus;
  /** Largest response seen, in bytes (`null` = never measurable). */
  sizeBytes: number | null;
  maxDurationMs: number | null;
};

export type RouteMapPath = {
  path: string;
  /** Page views recorded. `0` = only prefetched from another page so far. */
  visits: number;
  firstSeenAt: number;
  lastVisitedAt: number | null;
  requests: Record<string, RouteMapRequest>;
};

/** The persisted test run. */
export type RouteMap = {
  version: typeof ROUTE_MAP_VERSION;
  startedAt: number;
  paths: Record<string, RouteMapPath>;
  /**
   * Landed path → the route it stands in for, learned when a link to a
   * sitemap route redirected to a URL the inventory doesn't list (e.g.
   * `/pl/how-to-work-with-me` → `/pl/jak-ze-mna-pracowac`). Visits and
   * requests on the landed path are recorded under the route.
   */
  aliases: Record<string, string>;
  /**
   * Route → the OTHER known route it redirected to (e.g. `/app/account` →
   * `/` when signed out). The route counts as tested; its data stays with
   * the destination.
   */
  redirects: Record<string, string>;
};

/** A route-map link click, awaiting the landing page to confirm it. */
export type PendingRouteNavigation = {
  target: string;
  at: number;
};

export type RouteMapState = {
  map: RouteMap;
  listeners: Set<() => void>;
  /** Request-log entry ids already folded in (per document). */
  recordedIds: Set<string>;
  installed: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  /** Set when localStorage refused the write (quota / blocked). */
  storageError: boolean;
};

export const ROUTE_MAP_VERSION = 1;

/** On `window` so HMR re-evaluations share one state, like the request log. */
export const ROUTE_MAP_GLOBAL_KEY = Symbol.for('interdisciplinary.dev-toolbar.routeMap');

export const ROUTE_MAP_SAVE_DEBOUNCE_MS = 400;

/** A pending navigation older than this is stale (the tab was left). */
export const PENDING_ROUTE_NAVIGATION_TTL_MS = 30_000;
