// @cityturfer/core/districts: the bundled adapter of Territory's DistrictCatalog port. District
// boundaries from OpenStreetMap (© OpenStreetMap contributors, ODbL), generated at development time
// by apps/mobile/tools/gen-districts.mjs. A separate entry so @cityturfer/core/territory (the API,
// the web portal) never loads the data.
import type { District, DistrictCatalog, LonLat } from '../contexts/territory/ports';
import { DISTRICT_FILES } from './data';
import type { DistrictFile } from './district-file';

export type { DistrictFile } from './district-file';

/** Every city with bundled districts, by catalogue id. */
export const DISTRICT_CITY_IDS: readonly string[] = Object.keys(DISTRICT_FILES).sort();

export function districtsFromFile(file: DistrictFile): District[] {
  return file.districts.map((d) => ({
    id: d.id,
    cityId: file.cityId,
    name: d.name,
    polygons: d.polygons.map((p) => p.map((ring) => ring.map(([lon, lat]): LonLat => [lon, lat]))),
  }));
}

/** Loaded and converted once per city, on first use. */
const cache = new Map<string, readonly District[]>();

export const bundledDistricts: DistrictCatalog = {
  districtsOf(cityId) {
    const load = DISTRICT_FILES[cityId];
    if (!load) {
      return [];
    }
    let districts = cache.get(cityId);
    if (!districts) {
      districts = districtsFromFile(load());
      cache.set(cityId, districts);
    }
    return districts;
  },
};
