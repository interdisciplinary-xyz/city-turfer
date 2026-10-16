import { useMemo } from 'react';

import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { type TrackLine, TurfMapView } from '@/contexts/territory/ui/TurfMapView';

/** Composes Activity Log (tracks) and Territory (turf) on one map. */
export default function TurfScreen() {
  const activities = useActivities();
  const tracks = useMemo<TrackLine[]>(
    () => (activities ?? []).map((a) => ({ id: a.id, type: a.type, coordinates: a.preview })),
    [activities]
  );
  return <TurfMapView tracks={tracks} />;
}
