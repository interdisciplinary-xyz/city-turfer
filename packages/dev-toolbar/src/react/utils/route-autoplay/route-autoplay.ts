import { getDevToolbarConfig } from '../dev-toolbar-config';
import {
  IDLE_ROUTE_AUTOPLAY,
  ROUTE_AUTOPLAY_GLOBAL_KEY,
  type RouteAutoplayState,
  type RouteAutoplayStore,
} from './route-autoplay.constants';

const read = (): RouteAutoplayState => {
  try {
    const raw = sessionStorage.getItem(getDevToolbarConfig().storageKeys.session.ROUTE_AUTOPLAY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RouteAutoplayState>) : {};
    return {
      playing: parsed.playing === true,
      attempted: Array.isArray(parsed.attempted) ? parsed.attempted : [],
      finishedAt: typeof parsed.finishedAt === 'number' ? parsed.finishedAt : null,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
    };
  } catch {
    return IDLE_ROUTE_AUTOPLAY;
  }
};

const getStore = (): RouteAutoplayStore => {
  const holder = window as unknown as Record<symbol, RouteAutoplayStore>;
  holder[ROUTE_AUTOPLAY_GLOBAL_KEY] ??= {
    state: read(),
    listeners: new Set(),
  };
  return holder[ROUTE_AUTOPLAY_GLOBAL_KEY];
};

const commit = (state: RouteAutoplayState) => {
  const store = getStore();
  store.state = state;
  try {
    sessionStorage.setItem(getDevToolbarConfig().storageKeys.session.ROUTE_AUTOPLAY, JSON.stringify(state));
  } catch {
    // Blocked storage — autoplay just won't survive the next reload.
  }
  store.listeners.forEach((listener) => listener());
};

export function startRouteAutoplay(): void {
  commit({
    playing: true,
    attempted: [],
    finishedAt: null,
    startedAt: Date.now(),
  });
}

export function stopRouteAutoplay(): void {
  commit({ ...getStore().state, playing: false });
}

/** Nothing unvisited left: stop and remember the run completed. */
export function finishRouteAutoplay(): void {
  commit({ ...getStore().state, playing: false, finishedAt: Date.now() });
}

export function markRouteAutoplayAttempt(route: string): void {
  const { state } = getStore();
  commit({ ...state, attempted: [...state.attempted, route] });
}

export function subscribeRouteAutoplay(listener: () => void): () => void {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getRouteAutoplaySnapshot = (): RouteAutoplayState => getStore().state;

export const getRouteAutoplayServerSnapshot = (): RouteAutoplayState => IDLE_ROUTE_AUTOPLAY;
