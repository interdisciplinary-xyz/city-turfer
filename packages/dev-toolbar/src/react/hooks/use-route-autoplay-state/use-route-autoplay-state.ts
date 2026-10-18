import { useSyncExternalStore } from 'react';

import {
  getRouteAutoplayServerSnapshot,
  getRouteAutoplaySnapshot,
  type RouteAutoplayState,
  subscribeRouteAutoplay,
} from '../../utils/route-autoplay';

/** The route-map autoplay run (persisted per tab). */
export function useRouteAutoplayState(): RouteAutoplayState {
  return useSyncExternalStore(subscribeRouteAutoplay, getRouteAutoplaySnapshot, getRouteAutoplayServerSnapshot);
}
