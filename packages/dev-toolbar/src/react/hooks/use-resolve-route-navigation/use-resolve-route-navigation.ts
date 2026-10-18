import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { matchRouteItem, normalizeRoutePath } from '../../utils/route-inventory';
import { recordRouteAlias, recordRouteRedirect, takePendingRouteNavigation } from '../../utils/route-map';
import { useRouteInventory } from '../use-route-inventory';

/**
 * After a route-map link click, compare where we landed with where we were
 * heading. A mismatch is a redirect:
 *
 *   - landed on a path the inventory doesn't list → the same page under a
 *     translated slug (`/pl/how-to-work-with-me` → `/pl/jak-ze-mna-pracowac`):
 *     alias it onto the route, merging what was recorded;
 *   - landed on another known route (`/app/account` → `/` when signed out) →
 *     record the redirect; the route counts as tested.
 *
 * Either way the route stops being "unvisited", so "Next unvisited" can't
 * loop on it. Lives in the always-mounted DevToolbar.
 */
export function useResolveRouteNavigation(enabled: boolean): void {
  const pathname = usePathname();
  const inventory = useRouteInventory(enabled);

  useEffect(() => {
    if (!enabled || inventory.status !== 'ready') {
      return;
    }
    const pending = takePendingRouteNavigation();
    if (!pending) {
      return;
    }
    const target = normalizeRoutePath(pending.target);
    const landed = normalizeRoutePath(pathname);
    if (landed === target) {
      return;
    }
    if (matchRouteItem(inventory.items, landed)) {
      recordRouteRedirect(target, landed);
    } else {
      recordRouteAlias(landed, target);
    }
  }, [enabled, inventory, pathname]);
}
