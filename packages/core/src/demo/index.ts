// @cityturfer/core/demo: dev and demo data only (the Gdańsk demo account). Never imported by
// production code paths: the phone uses it for the demo@ account (and Cloud Backup's id check, LP3),
// the API only in its local server.
export {
  DEMO_PREFIX,
  DEMO_USER_ID,
  demoActivityId,
  type DemoRoute,
  GDANSK_CITY_ID,
  GDANSK_ROUTES,
  isGdanskPlanActivityId,
  planGdanskDemo,
  type PlannedActivity,
  pointsOf,
  trackAlongPath,
} from './gdansk';
export { destination, gaussian, mulberry32 } from './random';
