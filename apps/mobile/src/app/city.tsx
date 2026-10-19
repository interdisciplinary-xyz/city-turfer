import { router } from 'expo-router';

import { CityPicker } from '@/contexts/territory/ui/city-picker';

/** Me menu → City, or the Turf Map's city chip: choose the Home City the maps open on. */
export default function CityScreen() {
  return <CityPicker onDone={() => router.back()} />;
}
