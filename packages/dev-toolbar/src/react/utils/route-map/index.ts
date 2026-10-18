export {
  getRouteMapSnapshot,
  getRouteMapStorageError,
  hasPendingRouteNavigation,
  installRouteMap,
  recordRouteAlias,
  recordRouteRedirect,
  recordRouteVisit,
  resetRouteMap,
  setPendingRouteNavigation,
  subscribeRouteMap,
  takePendingRouteNavigation,
} from './route-map';
export type { RouteMap, RouteMapPath, RouteMapRequest } from './route-map.constants';
export { createRouteMap } from './route-map.utils';
