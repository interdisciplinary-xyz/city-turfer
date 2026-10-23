import { useCallback, useMemo } from 'react';

import { useLocale } from '@/i18n';
import { useContainer } from '@/ui-kit/app-context';

import type { CityView } from '../contract';
import { cityAliases, cityName } from './city-names';

type Named = Pick<CityView, 'id' | 'name'>;

/** `cityName` that re-renders on a language change (for screens showing the Home City). */
export function useCityName(): (city: Named) => string {
  const locale = useLocale();
  return useCallback((city: Named) => cityName(city, locale), [locale]);
}

/** Catalogue cities matching the query on their names in every app language (synchronous). */
export function useCitySearchInAllLanguages(query: string): CityView[] {
  const c = useContainer();
  return useMemo(() => c.territory.searchCities.execute(query, cityAliases), [c, query]);
}
