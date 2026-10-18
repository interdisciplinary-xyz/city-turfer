import type { RouteInventoryItem } from '../route-inventory';
import type { RouteMapPath, RouteMapRequest } from '../route-map';

export type RouteCoverageFilter = 'all' | 'visited' | 'unvisited';

export type RouteCoverageRow = {
  /** Inventory key, or the concrete path for an unlisted route. */
  key: string;
  kind: RouteInventoryItem['kind'] | 'unlisted';
  /** Concrete paths recorded under this route (several for a pattern). */
  paths: RouteMapPath[];
  /** Viewed at least once, or redirected elsewhere when opened. */
  visited: boolean;
  /** The other known route this one redirected to, if it did. */
  redirectsTo: string | null;
  /** Other URLs recorded as this same page (slug-translated redirects). */
  aliases: string[];
  visits: number;
  /** Distinct requests (source + method + URL) across the paths. */
  uniqueRequests: number;
  /** Every call, duplicates included. */
  totalCalls: number;
  /** Sum of each distinct request's largest known size. */
  totalBytes: number;
};

export type RouteCoverage = {
  rows: RouteCoverageRow[];
  total: number;
  visited: number;
};

export type RouteMapExport = {
  startedAt: string;
  exportedAt: string;
  coverage: { visited: number; total: number };
  routes: Array<{
    route: string;
    kind: RouteCoverageRow['kind'];
    visited: boolean;
    redirectsTo: string | null;
    aliases: string[];
    visits: number;
    uniqueRequests: number;
    totalCalls: number;
    totalBytes: number;
    paths: Array<{
      path: string;
      visits: number;
      requests: RouteMapRequest[];
    }>;
  }>;
};

export const ROUTE_COVERAGE_FILTERS: ReadonlyArray<{
  value: RouteCoverageFilter;
  label: string;
}> = [
  { value: 'all', label: 'All routes' },
  { value: 'unvisited', label: 'Not visited' },
  { value: 'visited', label: 'Visited' },
];
