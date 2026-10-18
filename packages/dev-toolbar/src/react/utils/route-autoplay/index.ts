export {
  finishRouteAutoplay,
  getRouteAutoplayServerSnapshot,
  getRouteAutoplaySnapshot,
  markRouteAutoplayAttempt,
  startRouteAutoplay,
  stopRouteAutoplay,
  subscribeRouteAutoplay,
} from './route-autoplay';
export type { RouteAutoplayState } from './route-autoplay.constants';
export { AUTOPLAY_TICK_MS } from './route-autoplay.constants';
export { isPageSettled } from './route-autoplay.utils';
