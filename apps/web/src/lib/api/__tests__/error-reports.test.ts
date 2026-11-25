import * as Sentry from '@sentry/react';
import { CancelledError } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createErrorReporter,
  type ErrorSink,
  isUnexpected,
  operationOf,
  REDACTED_EMAIL,
  type ReportingConfig,
  reportingConfig,
  scrubPortalBreadcrumb,
  scrubPortalEvent,
} from '@/lib/api/error-reports';
import { PortalError, unreachableError } from '@/lib/api/errors';
import { createPortalQueryClient } from '@/lib/api/query-client';
import { sentryOptions } from '@/lib/api/sentry-reporter';

const EU_DSN = 'https://public123@o123456.ingest.de.sentry.io/4500000000000001';
const PROD = { dsn: EU_DSN, nodeEnv: 'production', vercelEnv: 'production', version: '0.17.0' };
const CONFIG: ReportingConfig = { dsn: EU_DSN, release: 'cityturfer-web@0.17.0', environment: 'production' };

/** A sink that records what it was asked to send. */
function fakeSink() {
  const captured: { error: unknown; tags: Record<string, string> }[] = [];
  const sink: ErrorSink = { capture: (error, tags) => captured.push({ error, tags }), close: vi.fn() };
  const connect = vi.fn(async () => sink);
  return { captured, sink, connect };
}

/** Lets the reporter's `then` callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('reportingConfig', () => {
  it('is off without a DSN (the default: local, E2E and forks)', () => {
    expect(reportingConfig({ ...PROD, dsn: undefined })).toBeNull();
    expect(reportingConfig({ ...PROD, dsn: '   ' })).toBeNull();
  });

  it('is off outside a production build deployed as Vercel production', () => {
    expect(reportingConfig({ ...PROD, nodeEnv: 'development' })).toBeNull();
    expect(reportingConfig({ ...PROD, vercelEnv: 'preview' })).toBeNull();
    expect(reportingConfig({ ...PROD, vercelEnv: undefined })).toBeNull();
  });

  it('is off for a DSN outside the EU region or one that does not parse', () => {
    expect(reportingConfig({ ...PROD, dsn: 'https://public123@o123456.ingest.sentry.io/4500000000000001' })).toBeNull();
    expect(reportingConfig({ ...PROD, dsn: 'https://public123@o123456.ingest.us.sentry.io/1' })).toBeNull();
    expect(reportingConfig({ ...PROD, dsn: 'http://public123@o123456.ingest.de.sentry.io/1' })).toBeNull();
    expect(reportingConfig({ ...PROD, dsn: 'not a url' })).toBeNull();
  });

  it('names the release after the version and the commit', () => {
    expect(reportingConfig(PROD)).toEqual(CONFIG);
    expect(reportingConfig({ ...PROD, commitSha: '0123456789abcdef0123' })?.release).toBe(
      'cityturfer-web@0.17.0+0123456789ab'
    );
  });
});

describe('isUnexpected', () => {
  it('ignores every error the portal already explains to the user', () => {
    for (const code of [
      'not-found',
      'auth.invalid-code',
      'rate-limited',
      'consent.required',
      'storage.unavailable',
    ] as const) {
      expect(isUnexpected(new PortalError(code, { status: 400 })), code).toBe(false);
    }
    expect(isUnexpected(new PortalError('signed-out', { status: 401 }))).toBe(false);
    expect(isUnexpected(unreachableError())).toBe(false);
    expect(isUnexpected(new PortalError('unreachable', { status: 503 }))).toBe(false);
    // An unknown 4xx code shows the generic copy but is still the API refusing, not failing.
    expect(isUnexpected(new PortalError('generic', { status: 409 }))).toBe(false);
    expect(isUnexpected(new CancelledError())).toBe(false);
    expect(isUnexpected(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(false);
  });

  it('reports a 5xx the API did not explain, and any bug in the portal', () => {
    expect(isUnexpected(new PortalError('generic', { status: 500 }))).toBe(true);
    expect(isUnexpected(new TypeError("Cannot read properties of undefined (reading 'km')"))).toBe(true);
    expect(isUnexpected('a thrown string')).toBe(true);
  });
});

describe('operationOf', () => {
  it('keeps the plain name of a key, never its ids or filters', () => {
    expect(operationOf(['activity', '01J9Z3'])).toBe('activity');
    expect(operationOf(['track', '01J9Z3', 'hash'])).toBe('track');
    expect(operationOf(['01J9Z3'])).toBeUndefined();
    expect(operationOf(undefined)).toBeUndefined();
  });
});

describe('createErrorReporter', () => {
  it('without a config does nothing: the SDK is never loaded', async () => {
    const { connect } = fakeSink();
    const reporter = createErrorReporter({ config: null, connect });
    const stop = reporter.start();
    reporter.report(new TypeError('boom'), { source: 'render' });
    stop();
    await settle();
    expect(connect).not.toHaveBeenCalled();
  });

  it('never reports an expected error, and does not load the SDK for one', async () => {
    const { connect, captured } = fakeSink();
    const reporter = createErrorReporter({ config: CONFIG, connect });
    reporter.report(new PortalError('not-found', { status: 404 }), { source: 'query' });
    reporter.report(unreachableError(), { source: 'query' });
    reporter.report(new PortalError('signed-out', { status: 401 }), { source: 'query' });
    await settle();
    expect(connect).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });

  it('reports an unexpected error once, with low-cardinality tags only', async () => {
    const { connect, captured } = fakeSink();
    const reporter = createErrorReporter({ config: CONFIG, connect });
    reporter.start();
    const error = new PortalError('generic', { status: 500, requestId: 'req_abc' });
    reporter.report(error, { source: 'query', key: ['activity', '01J9Z3ABCDEF'] });
    reporter.report(error, { source: 'render' });
    await settle();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].tags).toEqual({
      area: 'portal',
      source: 'query',
      operation: 'activity',
      status: '500',
      request_id: 'req_abc',
    });
    expect(JSON.stringify(captured[0].tags)).not.toContain('01J9Z3ABCDEF');
  });

  it('starts the SDK on the first report when it was not started yet; stop closes it', async () => {
    const { connect, captured, sink } = fakeSink();
    const reporter = createErrorReporter({ config: CONFIG, connect });
    reporter.report(new TypeError('boom'), { source: 'render' });
    await settle();
    expect(captured).toHaveLength(1);
    const stop = reporter.start();
    stop();
    await settle();
    expect(sink.close).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the SDK fails to load', async () => {
    const reporter = createErrorReporter({ config: CONFIG, connect: () => Promise.reject(new Error('chunk')) });
    expect(() => reporter.report(new TypeError('boom'), { source: 'render' })).not.toThrow();
    await settle();
  });
});

describe('the query client reports through the cache', () => {
  it('reports a failed read or write once when unexpected, never when the API explained it', async () => {
    const { connect, captured } = fakeSink();
    const reporter = createErrorReporter({ config: CONFIG, connect });
    const queryClient = createPortalQueryClient(reporter.report);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['activity', '01J9Z3ABCDEF'],
        queryFn: () => Promise.reject(new PortalError('not-found', { status: 404 })),
      })
    ).rejects.toThrow();
    await expect(
      queryClient.fetchQuery({
        queryKey: ['activity-totals'],
        queryFn: () => Promise.reject(new PortalError('generic', { status: 500 })),
      })
    ).rejects.toThrow();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new PortalError('generic', { status: 502, requestId: 'req_m' })),
    });
    await expect(mutation.execute(undefined)).rejects.toThrow();
    await settle();

    expect(captured.map((c) => c.tags)).toEqual([
      { area: 'portal', source: 'query', operation: 'activity-totals', status: '500' },
      { area: 'portal', source: 'mutation', status: '502', request_id: 'req_m' },
    ]);
  });
});

describe('what leaves: scrubbed events and breadcrumbs', () => {
  it('drops the request, user and extra, and redacts coordinates and e-mails', () => {
    const event = scrubPortalEvent({
      message: 'failed for ania@example.com at 54.35212,18.64663',
      exception: { values: [{ type: 'TypeError', value: 'no track for ania@example.com near lat=54.352' }] },
      request: {
        url: 'https://cityturfer.app/en/account/activity?id=01J9Z3',
        headers: { Cookie: '__Host-ct_session=x' },
      },
      user: { email: 'ania@example.com', ip_address: '203.0.113.7' },
      extra: { body: '{"email":"ania@example.com"}' },
      contexts: { culture: { timezone: 'Europe/Warsaw' }, os: { name: 'macOS' } },
      breadcrumbs: [
        { category: 'fetch', data: { url: '/api/v1/activities/01J9Z3' } },
        { category: 'navigation', data: { from: '/en/account/activities', to: '/en/account/activity?id=01J9Z3' } },
      ],
    });
    const text = JSON.stringify(event);
    expect(text).not.toContain('ania@example.com');
    expect(text).not.toContain('54.35');
    expect(text).not.toContain('01J9Z3');
    expect(text).not.toContain('ct_session');
    expect(text).not.toContain('203.0.113.7');
    expect(text).not.toContain('Europe/Warsaw');
    expect(event.message).toContain(REDACTED_EMAIL);
    expect(event.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/en/account/activities', to: '/en/account/activity' } },
    ]);
  });

  it('drops console and network breadcrumbs as they are recorded', () => {
    expect(scrubPortalBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(scrubPortalBreadcrumb({ category: 'xhr', data: { url: '/api/v1/me' } })).toBeNull();
    expect(scrubPortalBreadcrumb({ category: 'ui', message: 'sent to ania@example.com' })?.message).toBe(
      `sent to ${REDACTED_EMAIL}`
    );
  });
});

describe('the Sentry options', () => {
  const options = sentryOptions(CONFIG, Sentry);

  it('collect nothing about the person and trace nothing', () => {
    expect(options.dsn).toBe(EU_DSN);
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    });
    expect(options.tracesSampleRate).toBe(0);
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    expect(options.sendClientReports).toBe(false);
    expect(options.defaultIntegrations).toBe(false);
  });

  it('keep only error capture integrations: no sessions, HTTP or culture context, console or replay', () => {
    const names = (Array.isArray(options.integrations) ? options.integrations : []).map((i) => i.name).sort();
    expect(names).toEqual(
      [
        'Breadcrumbs',
        'BrowserApiErrors',
        'Dedupe',
        'EventFilters',
        'FunctionToString',
        'GlobalHandlers',
        'LinkedErrors',
      ].sort()
    );
  });

  it('send what the scrubbers return', () => {
    const event = options.beforeSend?.({ type: undefined, message: 'ania@example.com', user: { id: '1' } }, {}) as {
      message?: string;
      user?: unknown;
    };
    expect(event.message).toBe(REDACTED_EMAIL);
    expect(event.user).toBeUndefined();
    expect(options.beforeBreadcrumb?.({ category: 'fetch' })).toBeNull();
  });
});

describe('the SDK, end to end (fake transport)', () => {
  afterEach(async () => {
    await Sentry.close();
  });

  it('sends one scrubbed event for one unexpected error', async () => {
    const sent: string[] = [];
    const client = Sentry.init({
      ...sentryOptions(CONFIG, Sentry),
      // The browser SDK refuses to start in what looks like an extension; node has no window at all.
      skipBrowserExtensionCheck: true,
      transport: (transportOptions) =>
        Sentry.createTransport(transportOptions, async (request) => {
          sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body));
          return { statusCode: 200 };
        }),
    });
    expect(client).toBeDefined();
    const reporter = createErrorReporter({
      config: CONFIG,
      connect: async () => ({
        capture: (error, tags) => {
          Sentry.captureException(error, { tags });
        },
        close: () => undefined,
      }),
    });
    const error = new TypeError('no track for ania@example.com at 54.35212,18.64663');
    reporter.report(error, { source: 'render' });
    reporter.report(error, { source: 'render' });
    reporter.report(new PortalError('not-found', { status: 404 }), { source: 'query' });
    await settle();
    await Sentry.flush(2000);

    const events = sent.filter((body) => body.includes('"type":"event"'));
    expect(events).toHaveLength(1);
    expect(events[0]).toContain('TypeError');
    expect(events[0]).not.toContain('ania@example.com');
    expect(events[0]).not.toContain('54.35212');
    expect(events[0]).not.toMatch(/"user"\s*:/);
    expect(events[0]).not.toMatch(/"request"\s*:/);
  });
});
