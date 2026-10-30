import { DISTRICT_CITY_IDS } from '@cityturfer/core/districts';

const withDistricts = new Set(DISTRICT_CITY_IDS);

/**
 * Whether the app ships district boundaries for a catalogue city: the Turf tab offers the Districts
 * screen only there. Reads the bundled index only, never a city's boundaries.
 */
export function hasDistricts(cityId: string): boolean {
  return withDistricts.has(cityId);
}
