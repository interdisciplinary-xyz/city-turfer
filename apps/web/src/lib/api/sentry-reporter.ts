// The portal's one Sentry adapter (dependency-cruiser: sentry-only-in-its-adapter, with
// sentry-sdk.ts). The SDK is a dynamic import of ./sentry-sdk, so it is its own chunk, downloaded
// only when reporting starts on a portal page of a production deployment; public pages never
// reference it (tools/check-export.mjs).
import type { BrowserOptions } from '@sentry/react';

import { type ErrorSink, type ReportingConfig, scrubPortalBreadcrumb, scrubPortalEvent } from './error-reports';

type SentrySdk = typeof import('./sentry-sdk');

/** The integrations the portal keeps: the SDK's defaults minus anything that reads data or phones home. */
type IntegrationFactories = Pick<
  SentrySdk,
  | 'breadcrumbsIntegration'
  | 'browserApiErrorsIntegration'
  | 'dedupeIntegration'
  | 'eventFiltersIntegration'
  | 'functionToStringIntegration'
  | 'globalHandlersIntegration'
  | 'linkedErrorsIntegration'
>;

/**
 * Errors only, nothing about the person: no user, IP, cookies, headers, query or bodies
 * (`dataCollection`, v11's replacement for `sendDefaultPii: false`), no tracing, replay, profiling,
 * logs, sessions or client reports, no trace headers on our requests. Breadcrumbs: page changes
 * only (as route patterns), no console, clicks, fetch or XHR. Every event and breadcrumb goes
 * through core's scrubber plus the portal's e-mail pass.
 */
export function sentryOptions(config: ReportingConfig, sdk: IntegrationFactories): BrowserOptions {
  return {
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendClientReports: false,
    enhanceFetchErrorMessages: false,
    maxBreadcrumbs: 30,
    // Not the defaults: no session tracking (a request per page view), culture context (time
    // zone), HTTP context (URL, user agent) or console capture (its own integration in v11).
    defaultIntegrations: false,
    integrations: [
      sdk.eventFiltersIntegration(),
      sdk.functionToStringIntegration(),
      sdk.browserApiErrorsIntegration(),
      sdk.breadcrumbsIntegration({
        dom: false,
        fetch: false,
        xhr: false,
        sentry: false,
        history: true,
      }),
      sdk.globalHandlersIntegration(),
      sdk.linkedErrorsIntegration(),
      sdk.dedupeIntegration(),
    ],
    beforeSend: (event) => scrubPortalEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubPortalBreadcrumb(breadcrumb),
  };
}

/** Downloads and starts the SDK; null when it could not (reporting stays off). Never throws. */
export async function connectSentry(config: ReportingConfig): Promise<ErrorSink | null> {
  try {
    const Sentry = await import('./sentry-sdk');
    const client = Sentry.init(sentryOptions(config, Sentry));
    if (!client) {
      return null;
    }
    return {
      capture: (error, tags) => {
        Sentry.captureException(error, { tags });
      },
      close: () => {
        void client.close();
      },
    };
  } catch {
    return null;
  }
}
