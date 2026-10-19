import { router } from 'expo-router';

import { RecordView } from '@/contexts/recording/ui/record-view';
import { useHomeCity } from '@/contexts/territory/ui/hooks';

/** Recording, with the map starting on the Home City until the first GPS fix (Territory). */
export default function RecordScreen() {
  const homeCity = useHomeCity();
  // Wait one local read for the Home City: the map's starting view is fixed when it mounts.
  if (homeCity === undefined) {
    return null;
  }
  return <RecordView initialCenter={homeCity?.center} onFinished={(id) => router.push(`/activity/${id}`)} />;
}
