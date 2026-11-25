/**
 * @cityturfer/core/error-scrub: what an error report may carry, for the phone and the server.
 * Pure and SDK-free (events are typed structurally); the apps plug `scrubEvent` into their error
 * tracker's beforeSend and `scrubBreadcrumb` into beforeBreadcrumb. Location and Apple Health data
 * are personal data: no coordinates, no user, no request, no Health messages leave through it.
 */
export { routePattern, type ScrubbableBreadcrumb, scrubBreadcrumb } from './scrub-breadcrumb';
export {
  ALLOWED_CONTEXTS,
  HEALTH_SYNC_AREA,
  type ScrubbableEvent,
  type ScrubbableException,
  scrubEvent,
} from './scrub-event';
export { redactCoordinates, REDACTED_COORD, REDACTED_PAIR, scrubText, scrubUrl } from './scrub-text';
