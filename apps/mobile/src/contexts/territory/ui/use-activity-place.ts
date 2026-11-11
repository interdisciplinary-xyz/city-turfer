import { useEffect, useMemo, useState } from 'react';

import { useLocale } from '@/i18n';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { ActivityPlaceView } from '../contract';
import { cityName } from './city-names';

/** Where an activity happened, as display names: the city in the app language, the district as local. */
export interface ActivityPlace {
  city: string | null;
  district: string | null;
}

/**
 * Where the activity happened, for the share card's place label: `undefined` while loading; both
 * null when it is in no catalogue city or can't be read. Worked out on the phone on each read, never
 * stored or logged. Re-read after a track correction (`dataVersion`); the city's name follows the
 * app language.
 */
export function useActivityPlace(activityId: string): ActivityPlace | undefined {
  const c = useContainer();
  const { dataVersion } = useApp();
  const locale = useLocale();
  const [v, set] = useState<ActivityPlaceView | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    c.territory.activityPlace.execute(activityId).then(
      (p) => live && set(p),
      () => live && set(null)
    );
    return () => {
      live = false;
    };
  }, [c, activityId, dataVersion]);
  return useMemo(() => {
    if (v === undefined) {
      return undefined;
    }
    return { city: v?.city ? cityName(v.city, locale) : null, district: v?.district ?? null };
  }, [v, locale]);
}
