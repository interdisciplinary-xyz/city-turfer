// Public API of the Territory context.
import {
  ChooseHomeCity,
  GetHomeCity,
  HomeCityChoiceQuery,
  type HomeCityDeps,
  SearchCities,
} from './application/home-city';
import {
  ClaimTurfFromActivity,
  GetClaimForActivity,
  GetTurfInViewport,
  GetTurfSummary,
  ListTurfCells,
  ReclaimTurfOfActivity,
  ReleaseTurfOfActivity,
  type TerritoryDeps,
} from './application/use-cases';

/**
 * The turf use cases alone (claims, the projection's reads), without the Home City: what a server
 * projection needs. `createTerritoryApi` is this plus the viewport query and the Home City.
 */
export function createTurfApi(deps: TerritoryDeps) {
  return {
    claimFromActivity: new ClaimTurfFromActivity(deps),
    release: new ReleaseTurfOfActivity(deps),
    reclaim: new ReclaimTurfOfActivity(deps),
    summary: new GetTurfSummary(deps),
    claimOf: new GetClaimForActivity(deps),
    cells: new ListTurfCells(deps),
  };
}
export type TurfApi = ReturnType<typeof createTurfApi>;

export function createTerritoryApi(deps: TerritoryDeps & HomeCityDeps) {
  return {
    ...createTurfApi(deps),
    viewport: new GetTurfInViewport(deps),
    homeCity: new GetHomeCity(deps),
    homeCityChoice: new HomeCityChoiceQuery(deps),
    chooseHomeCity: new ChooseHomeCity(deps),
    searchCities: new SearchCities(),
  };
}
export type TerritoryApi = ReturnType<typeof createTerritoryApi>;
export { catalogueCityView, type HomeCityDeps } from './application/home-city';
export type { ActivityTrackSource, TerritoryDeps } from './application/use-cases';
export type * from './contract';
/** The turf strength rule (pure): clients holding `TurfCellCounts` derive visits, strength and tier here. */
export { isStrong, strengthOf, tierOf, TURF_SATURATION_K, visitsOf } from './domain/strength';
