/**
 * Crash reporting adapter: Sentry (EU region, scrubbed). The only module that loads
 * @sentry/react-native, and only when crash reporting starts (lazy require), so an opted-out
 * phone, a development build and the tests never load it. Every event and breadcrumb goes
 * through @cityturfer/core/error-scrub; no user, no PII, no tracing, replay or profiling.
 * Never throws.
 */
import { scrubBreadcrumb, scrubEvent } from '@cityturfer/core/error-scrub';

import { type ErrorContext, type ErrorReporter, ReportedFailure } from './error-reporter';

type SentrySdk = typeof import('@sentry/react-native');

export interface SentryReporterConfig {
  dsn: string;
  /** EAS Update channel (or the app environment when there is none). */
  environment: string;
  /** App version + runtime version. */
  release: string;
  /** Low-cardinality tags on every event (e.g. the OTA update id). */
  tags?: Record<string, string>;
}

let sdk: SentrySdk | null = null;

/** Sentry's EU data region (`o<org>.ingest.de.sentry.io`), as the API and the portal require. */
const EU_INGEST_HOST = /^o\d+\.ingest\.de\.sentry\.io$/;

/** True for a DSN that parses and points at Sentry's EU region. */
export function isEuDsn(dsn: string): boolean {
  const match = /^https:\/\/[^@/]+@([^/:]+)\//.exec(dsn.trim());
  return match !== null && EU_INGEST_HOST.test(match[1]!);
}

function load(): SentrySdk {
  // Lazy: the background task imports the composition root at launch; Sentry loads only when used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk ??= require('@sentry/react-native') as SentrySdk;
  return sdk;
}

/** Starts Sentry and returns a reporter on it; null when it could not start (reporting stays off). */
export function startSentryReporter(config: SentryReporterConfig): ErrorReporter | null {
  if (!isEuDsn(config.dsn)) {
    // Personal-data hosting stays in the EU: a DSN of any other region never starts reporting.
    return null;
  }
  try {
    const Sentry = load();
    // enableNetworkBreadcrumbs is read by the native iOS SDK (options pass through as-is): its
    // NSURLSession breadcrumbs would carry router URLs with coordinates into native crash reports,
    // which JS beforeSend never sees.
    const options: Parameters<SentrySdk['init']>[0] & { enableNetworkBreadcrumbs: boolean } = {
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      sendDefaultPii: false,
      // Errors only: no release-health sessions (the native SDKs send one per app open, with an
      // install id) and no client reports about dropped events.
      enableAutoSessionTracking: false,
      sendClientReports: false,
      tracesSampleRate: 0,
      // No trace headers on any request (the router and our API included).
      tracePropagationTargets: [],
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableAutoPerformanceTracing: false,
      enableUserInteractionTracing: false,
      enableCaptureFailedRequests: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: 50,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      initialScope: { tags: config.tags ?? {} },
      enableNetworkBreadcrumbs: false,
    };
    Sentry.init(options);
    return { report: (error, ctx) => capture(Sentry, error, ctx) };
  } catch {
    return null;
  }
}

function capture(Sentry: SentrySdk, error: unknown, ctx: ErrorContext): void {
  try {
    const tags: Record<string, string> = { ...ctx.tags, area: ctx.area };
    if (ctx.code) {
      tags.code = ctx.code;
    }
    // A failure rebuilt from a diagnostics code has the same stack wherever it came from: group by code.
    const fingerprint = error instanceof ReportedFailure ? ['reported-failure', ctx.area, ctx.code ?? ''] : undefined;
    Sentry.captureException(error, { tags, ...(fingerprint ? { fingerprint } : {}) });
  } catch {
    // never throw from reporting
  }
}

/** Stops Sentry (the Turfer turned crash reports off). No-op when it never started. */
export async function stopSentry(): Promise<void> {
  try {
    await sdk?.close();
  } catch {
    // never throw from reporting
  }
}
