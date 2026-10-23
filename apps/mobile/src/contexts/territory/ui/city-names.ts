import { MESSAGES } from '@/i18n/catalogue';
import { currentLocale } from '@/i18n/language-state';
import { type Locale, LOCALES } from '@/i18n/locales';

import type { CityAliases, CityView } from '../contract';

/*
 * Pure, so Jest and code outside React can use it; the hooks are in use-city-names.ts.
 *
 * Catalogue cities in the app language (L8): names by city id in `cities.names`, countries by ISO
 * code in `cities.countries`. Core keeps one English name per city (and the Home City only its
 * id); the localised name is display only. English names equal core's, so English output does not
 * change.
 */

type Named = Pick<CityView, 'id' | 'name'>;

const namesIn = (locale: Locale) => MESSAGES[locale].cities.names as Readonly<Record<string, string | undefined>>;
const countriesIn = (locale: Locale) =>
  MESSAGES[locale].cities.countries as Readonly<Record<string, string | undefined>>;

/** The city's name in `locale` (default: the app language now); core's name for a city the catalogue lacks. */
export function cityName(city: Named, locale: Locale = currentLocale()): string {
  return namesIn(locale)[city.id] ?? city.name;
}

/** A country's name for its ISO code in `locale`; the code itself when the catalogue lacks it. */
export function countryName(code: string, locale: Locale = currentLocale()): string {
  return countriesIn(locale)[code] ?? code;
}

/**
 * The city's names in every app language, for search: a Turfer finds Warsaw as "Warszawa" and
 * Vienna as "Wiedeń" (or "Vienna") whatever language the app is in.
 */
export const cityAliases: CityAliases = (cityId) =>
  LOCALES.map((l) => namesIn(l)[cityId]).filter((n): n is string => n != null);
