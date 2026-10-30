import CITY_DATA from './hero-cities.data.json';
import { type HeroCityId, type HeroCityOption } from './hero-city.constants';

/**
 * The hero's cities with centres from the app's Home City catalogue, so the hero and the app name
 * the same places. The centres are written by tools/gen-city-maps.mjs as plain data: public pages
 * never load @cityturfer/core (dependency rule marketing-not-core); hero-city.test.ts checks they
 * still match the catalogue.
 */
export function heroCityOptions(): readonly HeroCityOption[] {
  return CITY_DATA.map(({ id, center }) => ({ id: id as HeroCityId, center: [center[0], center[1]] as const }));
}
