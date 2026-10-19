import { useMemo } from 'react';

import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { type TrackLine, TurfMapView } from '@/contexts/territory/ui/turf-map-view';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

/** Composes Activity Log (tracks) and Territory (turf) on one map. */
export default function TurfScreen() {
  useLightStatusBar();
  const activities = useActivities();
  const tracks = useMemo<TrackLine[]>(
    () => (activities ?? []).map((a) => ({ id: a.id, type: a.type, coordinates: a.preview })),
    [activities]
  );
  return <TurfMapView tracks={tracks} />;
}
