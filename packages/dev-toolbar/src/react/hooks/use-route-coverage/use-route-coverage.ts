import { usePathname } from 'next/navigation';

import {
  buildRouteCoverage,
  filterCoverageRows,
  nextUnvisitedHref,
  type RouteCoverageFilter,
} from '../../utils/route-coverage';
import { matchRouteItem } from '../../utils/route-inventory';
import { createRouteMap } from '../../utils/route-map';
import { useRouteInventory } from '../use-route-inventory';
import { useRouteMap } from '../use-route-map';
import type { RouteCoverageModel } from './use-route-coverage.constants';

/** The persisted route map joined with the route inventory. */
export function useRouteCoverage(filter: RouteCoverageFilter): RouteCoverageModel {
  const pathname = usePathname();
  const map = useRouteMap();
  const inventory = useRouteInventory(true);

  const items = inventory.status === 'ready' ? inventory.items : [];
  const coverage = buildRouteCoverage(items, map ?? createRouteMap(0));
  const currentKey = matchRouteItem(items, pathname)?.key ?? pathname;

  return {
    inventory,
    map,
    coverage,
    rows: filterCoverageRows(coverage.rows, filter),
    currentKey,
    percent: coverage.total ? Math.round((coverage.visited / coverage.total) * 100) : 0,
    nextUnvisited: nextUnvisitedHref(coverage.rows, currentKey),
  };
}
