import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useActivity } from '@/contexts/activity-log/ui/hooks';
import type { PickedPhoto, ShareCardActivity } from '@/contexts/share-photo';
import { pendingPhoto } from '@/contexts/share-photo/ui/pending-photo';
import { SharePhotoView } from '@/contexts/share-photo/ui/share-photo-view';
import { useClaim } from '@/contexts/territory/ui/hooks';
import { useActivityPlace } from '@/contexts/territory/ui/use-activity-place';
import { usePalette } from '@/ui-kit/theme';

/**
 * Share photo (full-screen modal): composes Activity Log (the activity's numbers), Territory (new
 * turf cells, the place) and Share Photo (the card). Only plain facts cross: no track, no
 * coordinates. The photo, a cache file picked on the activity screen, arrives in memory: the route
 * carries only the handoff token (`photo`), taken once here. A deep link with any other value opens
 * the screen without a photo, in its "pick a photo" state.
 */
export default function SharePhotoScreen() {
  const { id, photo: token } = useLocalSearchParams<{ id: string; photo?: string }>();
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
  // Taken on the first render only: later renders (and a second mount) find nothing.
  const [photo] = useState<PickedPhoto | null>(() => pendingPhoto.take(token));

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
