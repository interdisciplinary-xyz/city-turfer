import type { RouteCoverage, RouteCoverageRow } from '../../utils/route-coverage';
import type { RouteMap } from '../../utils/route-map';
import type { RouteInventoryState } from '../use-route-inventory';

export type RouteCoverageModel = {
  inventory: RouteInventoryState;
  /** `null` only before the persisted map is read (SSR). */
  map: RouteMap | null;
  /**
   * Joined against the inventory when it is ready; otherwise every recorded
   * path as its own row, so the run stays browsable while it loads or fails.
   */
  coverage: RouteCoverage;
  /** `coverage.rows` narrowed by the active filter. */
  rows: RouteCoverageRow[];
  /** Row key of the route the browser is on. */
  currentKey: string;
  percent: number;
  /** Link to the next unvisited page, when there is one. */
  nextUnvisited: string | null;
};
