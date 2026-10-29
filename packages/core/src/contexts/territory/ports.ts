// Territory's adapter SPI (@cityturfer/core/territory/ports): the ports its adapters implement and
// the aggregate they rehydrate. Only this context's adapters, test doubles and composition roots
// import it; everything else uses the public API (@cityturfer/core/territory).
export type { CellGrid, CellId } from './domain/cell-grid';
export { Claim } from './domain/claim';
export type { District, DistrictPolygon, LonLat, Ring } from './domain/district';
export type { DistrictCatalog } from './domain/district-catalog';
export type { HomeCityRepository } from './domain/home-city-repository';
export type { CellRow, TerritoryRepository } from './domain/territory-repository';
