import { catalogueCityView } from '@cityturfer/core/territory';

import { HERO_CITY_IDS, type HeroCityOption } from './hero-city.constants';

/**
 * The hero's cities with centres from the app's Home City catalogue, so the hero and the app name
 * the same places. Server side only: the client picker gets the result as props, which keeps the
 * catalogue out of the browser bundle.
 */
export function heroCityOptions(): readonly HeroCityOption[] {
  return HERO_CITY_IDS.map((id) => ({ id, center: catalogueCityView(id).center }));
}
