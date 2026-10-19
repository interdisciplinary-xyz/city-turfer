import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { RecordView } from '@/contexts/recording/ui/record-view';
import { useHomeCity } from '@/contexts/territory/ui/hooks';

/** Recording, with the Home City (Territory) on the chip at the top and as the map's starting view. */
export default function RecordScreen() {
  const homeCity = useHomeCity();
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
  return (
    <RecordView
      city={homeCity && { id: homeCity.id, name: homeCity.name, center: homeCity.center }}
      onPickCity={() => router.push('/city')}
      focused={focused}
      onFinished={(id) => router.push(`/activity/${id}`)}
    />
  );
}
