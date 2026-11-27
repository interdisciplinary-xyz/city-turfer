import { useState } from 'react';
import { View } from 'react-native';

import { DARK } from '@/constants/colors';
import { usePlannedRoute } from '@/contexts/route-planning/ui/hooks';
import { PlannerView } from '@/contexts/route-planning/ui/planner-view';
import { PLANNED_ROUTE_BOTTOM_LAYER, type PlannerMapView } from '@/contexts/route-planning/ui/planner-view.constants';
import { useHomeCity, useTurfViewport } from '@/contexts/territory/ui/hooks';
import { TurfLayers } from '@/contexts/territory/ui/layers';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

/**
 * Turf Map › Plan route. Composes Route Planning (the plan, the map) with Territory (the Turfer's
 * turf under the route, so ground not yet theirs shows as gaps; the Home City as the opening view).
 */
export default function PlanRouteScreen() {
  useLightStatusBar();
  const route = usePlannedRoute();
  const homeCity = useHomeCity();
  const [view, setView] = useState<PlannerMapView | null>(null);
  const cells = useTurfViewport(view);
  // Wait one local read for both: the map's camera must exist, with its starting view, from the
  // map's first layout (iOS MapLibre ignores a Camera mounted later).
  if (route === undefined || homeCity === undefined) {
    return <View style={{ flex: 1, backgroundColor: DARK.bg }} />;
  }
  return (
    <PlannerView
      route={route}
      cityCenter={homeCity?.center ?? null}
      onViewChange={setView}
      underlay={<TurfLayers cells={cells} beforeId={PLANNED_ROUTE_BOTTOM_LAYER} />}
    />
  );
}
