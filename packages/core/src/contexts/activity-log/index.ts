// Public API of the Activity Log context.
import {
  ActivityArchiveQuery,
  type ActivityLogDeps,
  ActivityTrackQuery,
  AssignMissingTimeZones,
  CapEstimatedMovingTime,
  DeleteActivity,
  EstimateGapRoutes,
  GetActivityDetail,
  GetGapEstimationSetting,
  ImportActivity,
  ListActivities,
  OverlappingActivitiesQuery,
  RecordActivityFromSession,
  RenameActivity,
  RestoreActivity,
  SetGapEstimationSetting,
  SplitTrackGaps,
} from './application/use-cases';

export function createActivityLogApi(deps: ActivityLogDeps) {
  return {
    recordFromSession: new RecordActivityFromSession(deps),
    importActivity: new ImportActivity(deps),
    restoreActivity: new RestoreActivity(deps),
    list: new ListActivities(deps),
    detail: new GetActivityDetail(deps),
    rename: new RenameActivity(deps),
    remove: new DeleteActivity(deps),
    trackQuery: new ActivityTrackQuery(deps),
    archive: new ActivityArchiveQuery(deps),
    overlapping: new OverlappingActivitiesQuery(deps),
    splitTrackGaps: new SplitTrackGaps(deps),
    estimateGapRoutes: new EstimateGapRoutes(deps),
    capEstimatedMovingTime: new CapEstimatedMovingTime(deps),
    assignMissingTimeZones: new AssignMissingTimeZones(deps),
    gapEstimationEnabled: new GetGapEstimationSetting(deps),
    setGapEstimationEnabled: new SetGapEstimationSetting(deps),
  };
}
export type ActivityLogApi = ReturnType<typeof createActivityLogApi>;
export type {
  ActivityLogDeps,
  FinishedTrackSource,
  GapEstimationSetting,
  GapRoutingEnvironment,
  RouteEstimator,
} from './application/use-cases';
export { RouterRateLimited, RouterUnreachable } from './application/use-cases';
export type * from './contract';
export { ACTIVITY_NAME_MAX_LENGTH, activityNameProblem } from './domain/activity';
