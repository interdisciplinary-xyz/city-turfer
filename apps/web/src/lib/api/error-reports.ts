// Error reports from the signed-in portal (Sentry, EU region, scrubbed): which errors are reported,
// when reporting is on at all, and a reporter that loads the SDK only when it starts. Pure: the SDK
// is behind `ErrorSinkFactory` (sentry-reporter.ts is the one adapter), so this runs in unit tests.
// Public pages never load this file (dependency-cruiser: marketing-not-api-client).
import {
  type ScrubbableBreadcrumb,
  type ScrubbableEvent,
  scrubBreadcrumb,
  scrubEvent,
} from '@cityturfer/core/error-scrub';
import { isCancelledError } from '@tanstack/react-query';

import { isPortalError } from './errors';

/** What turns reporting on. Inlined at build time (static export): a build without a DSN reports nothing. */
export type ReportingEnv = {
  /** `NEXT_PUBLIC_SENTRY_DSN`. */
  dsn?: string;
  /** `NODE_ENV` of the build. */
  nodeEnv?: string;
  /** `NEXT_PUBLIC_VERCEL_ENV`: `production`, `preview` or `development` (unset outside Vercel). */
  vercelEnv?: string;
  /** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, when Vercel exposes it. */
  commitSha?: string;
  /** The site's version (package.json, `CITYTURFER_WEB_VERSION`). */
  version: string;
};

export type ReportingConfig = {
  dsn: string;
  release: string;
  environment: 'production';
};

/** Sentry's EU data region (`o<org>.ingest.de.sentry.io`), as the API requires (apps/api/src/sentry.ts). */
const EU_INGEST_HOST = /^o\d+\.ingest\.de\.sentry\.io$/;

/** First characters of the commit in the release name. */
const SHA_LENGTH = 12;

/**
 * Reporting is on only in a production build deployed as Vercel production, with a DSN of Sentry's
 * EU region. Anything else (no DSN, `next dev`, a preview, the E2E build, a DSN outside the EU or
 * one that doesn't parse) is null: the reporter does nothing and the SDK is never downloaded.
 */
export function reportingConfig(env: ReportingEnv): ReportingConfig | null {
  const dsn = env.dsn?.trim();
  if (!dsn || env.nodeEnv !== 'production' || env.vercelEnv !== 'production') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    !url.username ||
    !/^\/\d+$/.test(url.pathname) ||
    !EU_INGEST_HOST.test(url.hostname)
  ) {
    return null;
  }
  const sha = env.commitSha?.trim().slice(0, SHA_LENGTH);
  return {
    dsn,
    release: `cityturfer-web@${env.version}${sha ? `+${sha}` : ''}`,
    environment: 'production',
  };
}

/**
 * Only unexpected errors are reported. A PortalError the API explained (a problem code: 4xx, 429,
 * `storage.unavailable`), a lost session, no answer (offline, gateway) and a cancelled request are
 * expected and already shown to the user in their words. Reported: `generic` answers with a 5xx
 * status (the API failed) and anything that is not a PortalError (a bug in the portal itself).
 */
export function isUnexpected(error: unknown): boolean {
  if (isPortalError(error)) {
    return error.code === 'generic' && error.status >= 500;
  }
  if (isCancelledError(error)) {
    return false;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }
  return true;
}

export type ReportSource = 'query' | 'mutation' | 'render';

export type ReportContext = {
  source: ReportSource;
  /** A query or mutation key; only its first part, when it is a plain name, is kept. */
  key?: readonly unknown[];
};

/** `['activity', '<id>']` → `activity`. Ids, filters and hashes never leave. */
const OPERATION = /^[a-z][a-z-]{0,39}$/;

export function operationOf(key: readonly unknown[] | undefined): string | undefined {
  const first = key?.[0];
  return typeof first === 'string' && OPERATION.test(first) ? first : undefined;
}

/** Low-cardinality tags of one report: where it came from, the operation, the status and request id. */
export function reportTags(error: unknown, context: ReportContext): Record<string, string> {
  const tags: Record<string, string> = { area: 'portal', source: context.source };
  const operation = operationOf(context.key);
  if (operation) {
    tags.operation = operation;
  }
  if (isPortalError(error)) {
    tags.status = String(error.status);
    // The API's X-Request-Id (a random id): finds the API's own log line for this 500.
    if (error.requestId) {
      tags.request_id = error.requestId;
    }
  }
  return tags;
}

/** The SDK, once started. */
export type ErrorSink = {
  capture: (error: unknown, tags: Record<string, string>) => void;
  close: () => void;
};

export type ErrorSinkFactory = (config: ReportingConfig) => Promise<ErrorSink | null>;

export type ErrorReporter = {
  /** Loads and starts the SDK (when reporting is on); returns the stop function for an effect cleanup. */
  start: () => () => void;
  /** Reports an unexpected error once; expected ones, and everything when reporting is off, are ignored. */
  report: (error: unknown, context: ReportContext) => void;
};

/**
 * A reporter over a lazily started sink. `report` before `start` starts it (a query can fail before
 * the layout's effect runs); each error object is reported at most once (a query error can also
 * reach the error boundary). Never throws.
 */
export function createErrorReporter({
  config,
  connect,
}: {
  config: ReportingConfig | null;
  connect: ErrorSinkFactory;
}): ErrorReporter {
  let sink: Promise<ErrorSink | null> | null = null;
  // Set by the portal root's cleanup: once the Turfer has left the portal (e.g. for a public
  // page), a late query failure must not load the SDK again.
  let left = false;
  const reported = new WeakSet<object>();

  const ensure = (): Promise<ErrorSink | null> | null => {
    if (!config) {
      return null;
    }
    sink ??= connect(config).catch(() => null);
    return sink;
  };

  return {
    start() {
      left = false;
      const started = ensure();
      return () => {
        left = true;
        if (started && sink === started) {
          sink = null;
          void started.then((s) => s?.close());
        }
      };
    },
    report(error, context) {
      if (!config || left || !isUnexpected(error)) {
        return;
      }
      if (typeof error === 'object' && error !== null) {
        if (reported.has(error)) {
          return;
        }
        reported.add(error);
      }
      const tags = reportTags(error, context);
      void ensure()?.then((s) => {
        try {
          s?.capture(error, tags);
        } catch {
          // never throw from reporting
        }
      });
    },
  };
}

/** An e-mail address (the portal shows the account's own): replaced before a report leaves. */
const EMAIL = /[^\s@"'<>()[\]{},;:]+@[^\s@"'<>()[\]{},;:]+\.[a-z]{2,}/gi;
export const REDACTED_EMAIL = '[email]';

export function redactEmails(text: string): string {
  return text.replace(EMAIL, REDACTED_EMAIL);
}

/**
 * Core's scrubber (no request, user, extra or server name; allow-listed contexts; URLs without
 * query; coordinates redacted), then e-mail addresses out of every text it keeps.
 */
export function scrubPortalEvent<E extends ScrubbableEvent>(event: E): E {
  const out = scrubEvent(event);
  if (typeof out.message === 'string') {
    out.message = redactEmails(out.message);
  }
  if (typeof out.logentry?.message === 'string') {
    out.logentry = { ...out.logentry, message: redactEmails(out.logentry.message) };
  }
  if (Array.isArray(out.exception?.values)) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((ex) =>
        typeof ex?.value === 'string' ? { ...ex, value: redactEmails(ex.value) } : ex
      ),
    };
  }
  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs.map((b) =>
      typeof b.message === 'string' ? { ...b, message: redactEmails(b.message) } : b
    );
  }
  return out;
}

/** Core's breadcrumb scrubber (console and network breadcrumbs dropped), then e-mail addresses out. */
export function scrubPortalBreadcrumb<B extends ScrubbableBreadcrumb>(breadcrumb: B): B | null {
  const out = scrubBreadcrumb(breadcrumb);
  if (out && typeof out.message === 'string') {
    out.message = redactEmails(out.message);
  }
  return out;
}
