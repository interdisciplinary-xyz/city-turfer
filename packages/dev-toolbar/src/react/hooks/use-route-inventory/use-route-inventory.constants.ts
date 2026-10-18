import type { RouteInventoryItem } from '../../utils/route-inventory';

export type RouteInventoryState =
  | { status: 'loading' }
  /** Not served — e.g. plain `next dev` without the custom server.js. */
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; items: RouteInventoryItem[] };

export const INVENTORY_TIMEOUT_MS = 60_000;
