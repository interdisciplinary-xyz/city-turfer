import { scrubBreadcrumb, scrubEvent } from '@cityturfer/core/error-scrub';
import {
  type BaseTransportOptions,
  createStackParser,
  createTransport,
  type ErrorEvent,
  linkedErrorsIntegration,
  Scope,
  type Transport,
} from '@sentry/core';
import { nodeStackLineParser, ServerRuntimeClient } from '@sentry/core/server';

import type { ErrorReportContext } from './deps';

/**
 * Error reports to Sentry (docs/operations/api-deploy.md, "Error reports"). Only the unexpected
 * errors that become `500 internal` are reported (`app.ts` onError); refusals with a catalogue code
 * (AppError, DomainError, invalid JSON, 404, 413) are expected answers, never reports.
 *
 * Built on `@sentry/core` (the runtime-agnostic client that `@sentry/hono` wraps): `@sentry/hono`'s
 * Node entry needs `@sentry/node` (OpenTelemetry auto-instrumentation, loaded with `--import`), which
 * is not installed and would not survive the esbuild bundle of scripts/build.ts. So: no tracing, no
 * auto-instrumentation, no request data — one explicit `captureException` per 500.
 *
 * What a report holds: the error's class name and stack frames, its `cause` chain (names and frames
 * too), the request id, the method and the route **pattern** (`/v1/activities/:activityId`). Never the
 * error message (database errors quote their parameters: e-mails, coordinates), the path, query,
 * body, cookies, headers or the caller's IP — and `scrubEvent`/`scrubBreadcrumb` from
 * `@cityturfer/core/error-scrub` run on everything before it leaves the process.
 */

export type ReportError = (err: unknown, ctx: ErrorReportContext) => Promise<void>;

/** How long a 500 waits for its report to leave (a Vercel function may freeze right after). */
export const REPORT_FLUSH_MS = 2000;

/** Sentry's EU data region (`*.ingest.de.sentry.io`): personal-data hosting stays in the EU. */
const EU_INGEST_HOST = /^o\d+\.ingest\.de\.sentry\.io$/;

/** Stands in for every exception message: messages may quote input (never sent). */
export const REDACTED_MESSAGE = '[message not sent]';

export type ReporterState = 'on' | 'off' | 'not-production' | 'not-eu' | 'invalid-dsn';

/**
 * Whether reports go out, and why not: only on Vercel production (`VERCEL_ENV=production`), never
 * under a test runner, with a `SENTRY_DSN` of the EU region.
 */
export function reporterState(env: NodeJS.ProcessEnv): ReporterState {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return 'off';
  }
  if (env.VERCEL_ENV !== 'production' || env.VITEST || env.NODE_ENV === 'test') {
    return 'not-production';
  }
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return 'invalid-dsn';
  }
  if (url.protocol !== 'https:' || !url.username || !/^\/\d+$/.test(url.pathname)) {
    return 'invalid-dsn';
  }
  return EU_INGEST_HOST.test(url.hostname) ? 'on' : 'not-eu';
}

/** Sends envelopes with fetch (Node 22 has it); the SDK's own transports live in @sentry/node. */
function fetchTransport(options: BaseTransportOptions): Transport {
  return createTransport(options, async (request) => {
    const res = await fetch(options.url, { method: 'POST', body: request.body as BodyInit });
    return {
      statusCode: res.status,
      headers: {
        'x-sentry-rate-limits': res.headers.get('x-sentry-rate-limits'),
        'retry-after': res.headers.get('retry-after'),
      },
    };
  });
}

/**
 * The API's own pass after the shared scrubber: drop every exception message (also of the
 * `cause` chain) and anything request- or user-shaped that an integration might have added.
 */
export function stripEvent(event: ErrorEvent): ErrorEvent {
  for (const value of event.exception?.values ?? []) {
    if (value.value !== undefined) {
      value.value = REDACTED_MESSAGE;
    }
  }
  delete event.message;
  delete event.logentry;
  delete event.request;
  delete event.user;
  delete event.extra;
  delete event.server_name;
  return event;
}

export interface ReporterOptions {
  /** Tests: where envelopes go instead of Sentry. */
  transport?: (options: BaseTransportOptions) => Transport;
}

/**
 * The `reportError` of productionDeps, or null when reports are off (`reporterState`). It never
 * throws and never rejects: a failing report must not change the 500 the caller gets.
 */
export function createErrorReporter(env: NodeJS.ProcessEnv, options: ReporterOptions = {}): ReportError | null {
  if (reporterState(env) !== 'on') {
    return null;
  }
  const client = new ServerRuntimeClient({
    dsn: env.SENTRY_DSN?.trim(),
    environment: env.VERCEL_ENV,
    release: env.VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    sendClientReports: false,
    maxBreadcrumbs: 20,
    platform: 'node',
    runtime: { name: 'node', version: process.version },
    stackParser: createStackParser(nodeStackLineParser()),
    transport: options.transport ?? fetchTransport,
    // No default integrations: nothing reads requests, consoles or local variables.
    integrations: [linkedErrorsIntegration()],
    beforeSend: (event) => stripEvent(scrubEvent(event)),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
  client.init();

  return async (err, ctx) => {
    try {
      // A fresh scope per report: concurrent requests never share tags.
      const scope = new Scope();
      scope.setClient(client);
      scope.setTags({ request_id: ctx.requestId, method: ctx.method, route: ctx.route });
      scope.setTransactionName(`${ctx.method} ${ctx.route}`);
      client.captureException(
        err,
        { originalException: err, mechanism: { type: 'hono.onError', handled: false } },
        scope
      );
      await client.flush(REPORT_FLUSH_MS);
    } catch {
      // Reporting is best effort; the request log line (request.error) is still written.
    }
  };
}
