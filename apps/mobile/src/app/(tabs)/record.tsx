import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { RecordView } from '@/contexts/recording/ui/record-view';
import { LIVE_TRACK_BOTTOM_LAYER } from '@/contexts/recording/ui/record-view.constants';
import { HideRouteChip } from '@/contexts/route-planning/ui/hide-route-chip';
import { usePlannedRoute, usePlannerActions } from '@/contexts/route-planning/ui/hooks';
import { PlannedRouteGuide } from '@/contexts/route-planning/ui/planned-route-layer';
import { useHomeCity, useTurfOverlay } from '@/contexts/territory/ui/hooks';
import { TurfLayers } from '@/contexts/territory/ui/layers';
import { useCityName } from '@/contexts/territory/ui/use-city-names';

/**
 * Recording, with Territory and Route Planning composed in by the screen (Recording imports
 * neither): the Home City on the chip at the top and as the map's starting view, the Turfer's turf
 * under the live track behind the "Turf" toggle (shown by default, remembered per user), and the
 * Planned Route as a guide line between the two when the Turfer chose "Use on Record", with a chip
 * to hide it.
 */
export default function RecordScreen() {
  const homeCity = useHomeCity();
  const turf = useTurfOverlay();
  const cityName = useCityName();
  const plan = usePlannedRoute({ estimate: false }); // the guide draws only the legs
  const planner = usePlannerActions();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  // Wait one local read for the Home City: the map's starting view is fixed when it mounts.
  if (homeCity === undefined) {
    return null;
  }
  // While the remembered choice loads, show the default (on) so the chips don't jump.
  const shown = turf.shown ?? true;
  return (
    <RecordView
      city={homeCity && { id: homeCity.id, name: cityName(homeCity), center: homeCity.center }}
      onPickCity={() => router.push('/city')}
      focused={focused}
      onFinished={(id) => router.push(`/activity/${id}?justFinished=1`)}
      // Turf first, then the guide: each goes just under the live track, so the guide sits over the turf.
      mapOverlay={
        <>
          <TurfLayers cells={turf.cells} beforeId={LIVE_TRACK_BOTTOM_LAYER} />
          <PlannedRouteGuide route={plan ?? null} beforeId={LIVE_TRACK_BOTTOM_LAYER} />
        </>
      }
      onViewChange={turf.onViewChange}
      turf={{ shown, onToggle: () => turf.setShown(!shown) }}
      mapChips={
        plan?.showOnRecord ? (
          <HideRouteChip onHide={() => void planner.showOnRecord(false).catch(() => undefined)} />
        ) : null
      }
    />
  );
}
