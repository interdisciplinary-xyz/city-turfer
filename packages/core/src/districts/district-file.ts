/** One generated file in ./data: a city's districts as apps/mobile/tools/gen-districts.mjs writes them. */
export interface DistrictFile {
  cityId: string;
  /** The OpenStreetMap admin_level the districts come from. */
  adminLevel: number;
  /**
   * The city's area in m², which the districts must cover (97–103 %): its OSM boundary, or the
   * official land area where that boundary takes in the sea (Gdańsk, Gdynia).
   */
  cityAreaM2: number;
  districts: {
    id: string;
    name: string;
    /**
     * Polygons of [outer, ...holes] rings of [lon, lat]: outer rings counter-clockwise, holes
     * clockwise (RFC 7946). Neighbours share the vertices of their common border exactly.
     */
    polygons: number[][][][];
  }[];
}
