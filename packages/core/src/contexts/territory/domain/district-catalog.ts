import type { District } from './district';

/**
 * Port: the districts of a catalogue city (empty when the app has no boundaries for it). The bundled
 * adapter is `@cityturfer/core/districts`; tests use an in-memory one.
 */
export interface DistrictCatalog {
  districtsOf(cityId: string): readonly District[];
}
