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

/**
 * The last city read, converted once: the screen reads one city (the Home City) again and again, and
 * an earlier city's districts (and the index built on them) can be freed once another is read.
 */
let last: { cityId: string; districts: readonly District[] } | null = null;

export const bundledDistricts: DistrictCatalog = {
  districtsOf(cityId) {
    const load = DISTRICT_FILES[cityId];
    if (!load) {
      return [];
    }
    if (last?.cityId !== cityId) {
      last = { cityId, districts: districtsFromFile(load()) };
    }
    return last.districts;
  },
};
