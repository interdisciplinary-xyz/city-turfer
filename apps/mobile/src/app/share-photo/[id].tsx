import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useActivity } from '@/contexts/activity-log/ui/hooks';
import type { PickedPhoto, ShareCardActivity } from '@/contexts/share-photo';
import { SharePhotoView } from '@/contexts/share-photo/ui/share-photo-view';
import { useClaim } from '@/contexts/territory/ui/hooks';
import { useActivityPlace } from '@/contexts/territory/ui/use-activity-place';
import { usePalette } from '@/ui-kit/theme';

/**
 * Share photo (full-screen modal): composes Activity Log (the activity's numbers), Territory (new
 * turf cells, the place) and Share Photo (the card). Only plain facts cross: no track, no
 * coordinates. The photo arrives as a local cache file picked on the activity screen.
 */
export default function SharePhotoScreen() {
  const { id, uri, w, h } = useLocalSearchParams<{ id: string; uri?: string; w?: string; h?: string }>();
  const p = usePalette();
  const { detail } = useActivity(id);
  const claim = useClaim(id);
  const place = useActivityPlace(id);
  const activity = useMemo<ShareCardActivity | null>(
    () =>
      detail
        ? {
            type: detail.type,
            name: detail.name,
            startedAt: detail.startedAt,
            distanceM: detail.distanceM,
            movingS: detail.movingS,
          }
        : null,
    [detail]
  );
  const photo = useMemo<PickedPhoto | null>(
    () => (uri ? { uri, width: Number(w) || 0, height: Number(h) || 0 } : null),
    [uri, w, h]
  );

  if (!activity) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <SharePhotoView activity={activity} newCells={claim ? claim.newCellCount : null} place={place} photo={photo} />
  );
}
