import { getDevToolbarConfig } from '../dev-toolbar-config';
import { isDevToolingEnabled } from '../is-dev-tooling-enabled';
import { getRequestLogSnapshot, subscribeRequestLog } from '../request-log';
import {
  PENDING_ROUTE_NAVIGATION_TTL_MS,
  type PendingRouteNavigation,
  ROUTE_MAP_GLOBAL_KEY,
  ROUTE_MAP_SAVE_DEBOUNCE_MS,
  type RouteMap,
  type RouteMapState,
} from './route-map.constants';
import { createRouteMap, parseRouteMap, withAlias, withRedirect, withRequests, withVisit } from './route-map.utils';

const readStored = (): string | null => {
  try {
    return localStorage.getItem(getDevToolbarConfig().storageKeys.local.ROUTE_MAP);
  } catch {
    return null;
  }
};

const getState = (): RouteMapState => {
  const holder = window as unknown as Record<symbol, RouteMapState>;
  holder[ROUTE_MAP_GLOBAL_KEY] ??= {
    map: parseRouteMap(readStored(), Date.now()),
    listeners: new Set(),
    recordedIds: new Set(),
    installed: false,
    saveTimer: null,
    storageError: false,
  };
  return holder[ROUTE_MAP_GLOBAL_KEY];
};

const save = (state: RouteMapState) => {
  try {
    localStorage.setItem(getDevToolbarConfig().storageKeys.local.ROUTE_MAP, JSON.stringify(state.map));
    state.storageError = false;
  } catch {
    state.storageError = true;
  }
};

// Debounced: requests settle in bursts (a page load is dozens), and each
// write serializes the whole run.
const scheduleSave = (state: RouteMapState) => {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    save(state);
  }, ROUTE_MAP_SAVE_DEBOUNCE_MS);
};

const commit = (state: RouteMapState, map: RouteMap) => {
  state.map = map;
  scheduleSave(state);
  state.listeners.forEach((listener) => listener());
};

const ingestRequests = () => {
  const state = getState();
  const { map, consumed } = withRequests(state.map, getRequestLogSnapshot(), state.recordedIds, Date.now());
  if (consumed.length) {
    consumed.forEach((id) => state.recordedIds.add(id));
    commit(state, map);
  }
};

/**
 * Start folding request-log entries into the persisted route map. Idempotent;
 * call after `installRequestLog()`. Flushes a pending save on page unload so
 * a full-page navigation doesn't drop the last burst.
 */
export function installRouteMap(): void {
  if (!isDevToolingEnabled()) {
    return;
  }
  const state = getState();
  if (state.installed) {
    return;
  }
  state.installed = true;
  subscribeRequestLog(ingestRequests);
  ingestRequests();
  window.addEventListener('pagehide', () => {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
      save(state);
    }
  });
}

export function recordRouteVisit(path: string): void {
  const state = getState();
  commit(state, withVisit(state.map, path, Date.now()));
}

/**
 * "Clear output": restart the test run. Requests already in this page's
 * log stay consumed, so the new run starts from the NEXT navigation.
 */
export function resetRouteMap(): void {
  const state = getState();
  getRequestLogSnapshot().forEach((entry) => state.recordedIds.add(entry.id));
  commit(state, createRouteMap(Date.now()));
}

export function subscribeRouteMap(listener: () => void): () => void {
  const { listeners } = getState();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getRouteMapSnapshot = (): RouteMap => getState().map;

export const getRouteMapStorageError = (): boolean => getState().storageError;

/** See `RouteMap.aliases`. */
export function recordRouteAlias(landedPath: string, targetPath: string): void {
  const state = getState();
  commit(state, withAlias(state.map, landedPath, targetPath, Date.now()));
}

/** See `RouteMap.redirects`. */
export function recordRouteRedirect(from: string, to: string): void {
  const state = getState();
  commit(state, withRedirect(state.map, from, to));
}

/**
 * Note which route a route-map link is heading to, so the landing page can
 * detect a redirect (`takePendingRouteNavigation`).
 */
export function setPendingRouteNavigation(target: string): void {
  const pending: PendingRouteNavigation = { target, at: Date.now() };
  try {
    sessionStorage.setItem(getDevToolbarConfig().storageKeys.session.ROUTE_MAP_PENDING_NAV, JSON.stringify(pending));
  } catch {
    // Blocked storage — redirects just won't be attributed.
  }
}

/** Read and clear the pending navigation; `null` if none or stale. */
export function takePendingRouteNavigation(): PendingRouteNavigation | null {
  try {
    const raw = sessionStorage.getItem(getDevToolbarConfig().storageKeys.session.ROUTE_MAP_PENDING_NAV);
    sessionStorage.removeItem(getDevToolbarConfig().storageKeys.session.ROUTE_MAP_PENDING_NAV);
    const pending = raw ? (JSON.parse(raw) as PendingRouteNavigation) : null;
    return pending && typeof pending.target === 'string' && Date.now() - pending.at < PENDING_ROUTE_NAVIGATION_TTL_MS
      ? pending
      : null;
  } catch {
    return null;
  }
}

/** Whether a route-map navigation is still waiting to be resolved. */
export function hasPendingRouteNavigation(): boolean {
  try {
    return sessionStorage.getItem(getDevToolbarConfig().storageKeys.session.ROUTE_MAP_PENDING_NAV) !== null;
  } catch {
    return false;
  }
}
