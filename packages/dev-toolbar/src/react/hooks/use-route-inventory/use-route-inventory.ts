import { useEffect, useState } from 'react';

import { DEV_ROUTES_PATH } from '../../../protocol.js';
import { getDevToolbarConfig } from '../../utils/dev-toolbar-config';
import { fetchWithTimeout } from '../../utils/fetch-with-timeout';
import { buildRouteInventory, type RouteInventoryResponse } from '../../utils/route-inventory';
import { INVENTORY_TIMEOUT_MS, type RouteInventoryState } from './use-route-inventory.constants';

// One fetch per document: the inventory only changes when a page.tsx or a
// CMS page is added, and a reload picks that up.
let inventoryPromise: Promise<RouteInventoryState> | null = null;

const loadInventory = (): Promise<RouteInventoryState> => {
  inventoryPromise ??= fetchWithTimeout(
    DEV_ROUTES_PATH,
    { cache: 'no-store' },
    // The dev server may compile /sitemap.xml on first request.
    INVENTORY_TIMEOUT_MS
  )
    .then(async (response): Promise<RouteInventoryState> => {
      if (!response.ok) {
        // 404 = no custom server (plain `next dev`); 500 carries a reason.
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        inventoryPromise = null;
        return {
          status: 'unavailable',
          reason:
            body?.error ??
            (response.status === 404
              ? 'not served — run pnpm start:dev (custom server.js)'
              : `HTTP ${response.status}`),
        };
      }
      const body = (await response.json()) as RouteInventoryResponse;
      return {
        status: 'ready',
        items: buildRouteInventory(body, getDevToolbarConfig().localePrefixes),
      };
    })
    .catch((error: unknown): RouteInventoryState => {
      inventoryPromise = null;
      return {
        status: 'unavailable',
        reason: error instanceof Error ? error.message : String(error),
      };
    });
  return inventoryPromise;
};

/** Every web route to cover, loaded lazily from the dev server. */
export function useRouteInventory(enabled: boolean): RouteInventoryState {
  const [state, setState] = useState<RouteInventoryState>({
    status: 'loading',
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    void loadInventory().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
