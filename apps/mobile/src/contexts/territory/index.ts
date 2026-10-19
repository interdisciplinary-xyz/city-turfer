// Public API of the Territory context.
import { ChooseHomeCity, GetHomeCity, type HomeCityDeps, SearchCities } from './application/home-city';
import {
  ClaimTurfFromActivity,
  GetClaimForActivity,
  GetTurfInViewport,
  GetTurfSummary,
  ReclaimTurfOfActivity,
  ReleaseTurfOfActivity,
  type TerritoryDeps,
} from './application/use-cases';

export function createTerritoryApi(deps: TerritoryDeps & HomeCityDeps) {
  return {
    claimFromActivity: new ClaimTurfFromActivity(deps),
    release: new ReleaseTurfOfActivity(deps),
    reclaim: new ReclaimTurfOfActivity(deps),
    viewport: new GetTurfInViewport(deps),
    summary: new GetTurfSummary(deps),
    claimOf: new GetClaimForActivity(deps),
    homeCity: new GetHomeCity(deps),
    chooseHomeCity: new ChooseHomeCity(deps),
    searchCities: new SearchCities(),
  };
}
export type TerritoryApi = ReturnType<typeof createTerritoryApi>;
export type { HomeCityDeps } from './application/home-city';
export type { ActivityTrackSource, TerritoryDeps } from './application/use-cases';
export type * from './contract';
