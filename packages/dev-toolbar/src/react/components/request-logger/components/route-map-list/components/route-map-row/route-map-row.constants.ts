import type { RouteCoverageRow } from '../../../../../../utils/route-coverage';

export type RouteMapRowProps = {
  row: RouteCoverageRow;
  /** The route the browser is on right now. */
  current: boolean;
  expanded: boolean;
  onToggle: () => void;
  /**
   * Whether the inventory is loaded. Until it is, every recorded path is
   * "unlisted" by construction, so the badge would be noise.
   */
  inventoryReady: boolean;
};
