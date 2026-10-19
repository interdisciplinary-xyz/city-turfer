import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DARK } from '@/constants/colors';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useHomeCity } from '@/contexts/territory/ui/hooks';
import { type TrackLine, TurfMapView } from '@/contexts/territory/ui/turf-map-view';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

/** Composes Activity Log (tracks) and Territory (turf, Home City) on one map. */
export default function TurfScreen() {
  useLightStatusBar();
  const activities = useActivities();
  const homeCity = useHomeCity();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  const tracks = useMemo<TrackLine[]>(
    () => (activities ?? []).map((a) => ({ id: a.id, type: a.type, coordinates: a.preview })),
    [activities]
  );
  // Wait one local read for the Home City: the map's camera must exist, with its starting view, from
  // the map's first layout (iOS MapLibre ignores a Camera mounted later).
  if (homeCity === undefined) {
    return <View style={{ flex: 1, backgroundColor: DARK.bg }} />;
  }
  return <TurfMapView tracks={tracks} homeCity={homeCity} focused={focused} onPickCity={() => router.push('/city')} />;
}
