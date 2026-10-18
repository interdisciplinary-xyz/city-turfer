import type { RouteCoverageModel } from '../../../../hooks/use-route-coverage';
import type { RouteCoverageFilter } from '../../../../utils/route-coverage';

export type RouteMapControlsProps = {
  model: RouteCoverageModel;
  filter: RouteCoverageFilter;
  onFilterChange: (filter: RouteCoverageFilter) => void;
};
