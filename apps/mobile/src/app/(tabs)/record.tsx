import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { RecordView } from '@/contexts/recording/ui/record-view';
import { LIVE_TRACK_BOTTOM_LAYER } from '@/contexts/recording/ui/record-view.constants';
import { useHomeCity, useTurfOverlay } from '@/contexts/territory/ui/hooks';
import { TurfLayers } from '@/contexts/territory/ui/layers';

/**
 * Recording, with Territory composed in by the screen (Recording never imports Territory): the
 * Home City on the chip at the top and as the map's starting view, and the Turfer's turf under the
 * live track behind the "Turf" toggle (shown by default, remembered per user).
 */
export default function RecordScreen() {
  const homeCity = useHomeCity();
  const turf = useTurfOverlay();
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
      city={homeCity && { id: homeCity.id, name: homeCity.name, center: homeCity.center }}
      onPickCity={() => router.push('/city')}
      focused={focused}
      onFinished={(id) => router.push(`/activity/${id}`)}
      mapOverlay={<TurfLayers cells={turf.cells} beforeId={LIVE_TRACK_BOTTOM_LAYER} />}
      onViewChange={turf.onViewChange}
      turf={{ shown, onToggle: () => turf.setShown(!shown) }}
    />
  );
}
