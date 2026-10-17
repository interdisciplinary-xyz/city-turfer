// Public API of the Activity Log context.
import {
  type ActivityLogDeps,
  ActivityTrackQuery,
  DeleteActivity,
  EstimateGapRoutes,
  GetActivityDetail,
  ImportActivity,
  ListActivities,
  RecordActivityFromSession,
  RenameActivity,
  SplitTrackGaps,
} from './application/use-cases';

export function createActivityLogApi(deps: ActivityLogDeps) {
  return {
    recordFromSession: new RecordActivityFromSession(deps),
    importActivity: new ImportActivity(deps),
    list: new ListActivities(deps),
    detail: new GetActivityDetail(deps),
    rename: new RenameActivity(deps),
    remove: new DeleteActivity(deps),
    trackQuery: new ActivityTrackQuery(deps),
    splitTrackGaps: new SplitTrackGaps(deps),
    estimateGapRoutes: new EstimateGapRoutes(deps),
  };
}
export type ActivityLogApi = ReturnType<typeof createActivityLogApi>;
export type { ActivityLogDeps, FinishedTrackSource, RouteEstimator } from './application/use-cases';
export type * from './contract';
