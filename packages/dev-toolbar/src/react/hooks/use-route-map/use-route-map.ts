import { useSyncExternalStore } from 'react';

import { installRequestLog } from '../../utils/request-log';
import { getRouteMapSnapshot, installRouteMap, type RouteMap, subscribeRouteMap } from '../../utils/route-map';

// Module load, for the same reason as `use-request-log`: the page's first
// requests fire before any toolbar effect runs. Both installs are
// idempotent and no-op outside local development.
if (typeof window !== 'undefined') {
  installRequestLog();
  installRouteMap();
}

const getServerSnapshot = (): RouteMap | null => null;

/** The persisted route-map test run (`null` during SSR). */
export function useRouteMap(): RouteMap | null {
  return useSyncExternalStore(subscribeRouteMap, getRouteMapSnapshot, getServerSnapshot);
}
