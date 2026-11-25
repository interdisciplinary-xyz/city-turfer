// The parts of the Sentry SDK the portal uses, as named re-exports: `sentry-reporter.ts` imports
// this module dynamically, so the bundler keeps only these (a dynamic import of '@sentry/react'
// itself would ship the whole SDK: tracing, replay, feedback). Loaded only when reporting starts.
export {
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  captureException,
  dedupeIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
} from '@sentry/react';
