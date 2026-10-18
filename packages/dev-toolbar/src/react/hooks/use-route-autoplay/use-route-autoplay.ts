import { useEffect, useRef } from 'react';

import { getRequestLogSnapshot } from '../../utils/request-log';
import {
  AUTOPLAY_TICK_MS,
  finishRouteAutoplay,
  getRouteAutoplaySnapshot,
  isPageSettled,
  markRouteAutoplayAttempt,
} from '../../utils/route-autoplay';
import { nextUnvisitedHref } from '../../utils/route-coverage';
import { hasPendingRouteNavigation, setPendingRouteNavigation } from '../../utils/route-map';
import { useRouteAutoplayState } from '../use-route-autoplay-state';
import { useRouteCoverage } from '../use-route-coverage';

/**
 * Drives route-map autoplay: while a run is on, wait for the current page
 * to settle (see `isPageSettled`), then open the next unvisited route — as
 * a full page load, through the same pending-navigation path as a manual
 * route-map click, so redirects are attributed. Each route is tried once
 * per run; when nothing is left the run finishes by itself.
 *
 * Lives in the always-mounted DevToolbar, so it keeps going with the
 * toolbar collapsed.
 */
export function useRouteAutoplay(enabled: boolean): void {
  const autoplay = useRouteAutoplayState();
  const model = useRouteCoverage('all');
  // Read inside the interval: the model changes on every recorded request.
  const modelRef = useRef(model);
  modelRef.current = model;

  const active = enabled && autoplay.playing;

  useEffect(() => {
    if (!active) {
      return;
    }
    const loadedAt = Math.floor(performance.timeOrigin);
    let leaving = false;

    const tick = () => {
      const { inventory, coverage, currentKey } = modelRef.current;
      // Wait for the inventory, and for the redirect check of the step
      // that brought us here — otherwise this route still looks unvisited.
      if (leaving || inventory.status !== 'ready' || hasPendingRouteNavigation()) {
        return;
      }
      const settled = isPageSettled({
        entries: getRequestLogSnapshot(),
        page: window.location.pathname,
        loadedAt,
        now: Date.now(),
      });
      if (!settled) {
        return;
      }

      const next = nextUnvisitedHref(coverage.rows, currentKey, new Set(getRouteAutoplaySnapshot().attempted));
      if (!next) {
        finishRouteAutoplay();
        return;
      }
      leaving = true;
      markRouteAutoplayAttempt(next);
      setPendingRouteNavigation(next);
      window.location.assign(next);
    };

    const id = window.setInterval(tick, AUTOPLAY_TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [active]);
}
