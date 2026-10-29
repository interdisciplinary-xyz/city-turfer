import { router } from 'expo-router';

import { DistrictsView } from '@/contexts/territory/ui/districts-view';

/** Turf tab → Districts (modal): the Home City split into districts, with the turf held in each. */
export default function DistrictsScreen() {
  // Close the modal first: on iOS a pushed screen would open underneath it.
  return (
    <DistrictsView
      onPickCity={() => {
        router.dismiss();
        router.push('/city');
      }}
    />
  );
}
