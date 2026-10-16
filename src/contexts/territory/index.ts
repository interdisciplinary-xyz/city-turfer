// Public API of the Territory context.
import {
  ClaimTurfFromActivity,
  GetClaimForActivity,
  GetTurfInViewport,
  GetTurfSummary,
  ReclaimTurfOfActivity,
  ReleaseTurfOfActivity,
  type TerritoryDeps,
} from './application/useCases';

export function createTerritoryApi(deps: TerritoryDeps) {
  return {
    claimFromActivity: new ClaimTurfFromActivity(deps),
    release: new ReleaseTurfOfActivity(deps),
    reclaim: new ReclaimTurfOfActivity(deps),
    viewport: new GetTurfInViewport(deps),
    summary: new GetTurfSummary(deps),
    claimOf: new GetClaimForActivity(deps),
  };
}
export type TerritoryApi = ReturnType<typeof createTerritoryApi>;
export type { ActivityTrackSource, TerritoryDeps } from './application/useCases';
export { DETAIL_ZOOM } from './application/useCases';
export type * from './contract';
