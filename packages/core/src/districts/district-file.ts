/** One generated file in ./data: a city's districts as apps/mobile/tools/gen-districts.mjs writes them. */
export interface DistrictFile {
  cityId: string;
  /** The OpenStreetMap admin_level the districts come from. */
  adminLevel: number;
  districts: {
    id: string;
    name: string;
    /** Polygons of [outer, ...holes] rings of [lon, lat]. */
    polygons: number[][][][];
  }[];
}
