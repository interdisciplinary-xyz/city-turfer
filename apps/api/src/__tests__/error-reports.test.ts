import { DomainError } from '@cityturfer/core/shared-kernel';
import { type BaseTransportOptions, createTransport, type ErrorEvent, type Transport } from '@sentry/core';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { AppError } from '../backup/app-error';
import { defaultDeps, type ErrorReportContext, silentLog } from '../deps';
import { createErrorReporter, REDACTED_MESSAGE, reporterState } from '../sentry';
import { productionDeps } from '../wiring';

// Wrap the shared scrubber in spies (same behaviour), to prove the reporter runs it.
vi.mock('@cityturfer/core/error-scrub', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cityturfer/core/error-scrub')>();
  return { ...actual, scrubEvent: vi.fn(actual.scrubEvent), scrubBreadcrumb: vi.fn(actual.scrubBreadcrumb) };
});
const scrub = await import('@cityturfer/core/error-scrub');

/** A made-up EU DSN (key and ids are not real). */
const EU_DSN = 'https://0123456789abcdef0123456789abcdef@o1.ingest.de.sentry.io/2';
const PRODUCTION = { SENTRY_DSN: EU_DSN, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'abc1234' };

/** Envelopes the reporter would send, parsed (header line, item header, item payload, …). */
function capturingTransport(): { sent: Record<string, unknown>[][]; make: (o: BaseTransportOptions) => Transport } {
  const sent: Record<string, unknown>[][] = [];
  return {
    sent,
    make: (options) =>
      createTransport(options, (request) => {
        const text = typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body);
        sent.push(
          text
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as Record<string, unknown>)
        );
        return Promise.resolve({ statusCode: 200 });
      }),
  };
}

/** The event items of every envelope sent. */
function events(sent: Record<string, unknown>[][]): Record<string, unknown>[] {
  return sent.flatMap((items) => items.filter((_, i) => i > 0 && items[i - 1]?.type === 'event'));
}

/** The app with test routes that fail in every way onError knows, and a recording reportError. */
function failingApp(reportError: (err: unknown, ctx: ErrorReportContext) => Promise<void>) {
  const app = createApp(defaultDeps({ log: silentLog, reportError }));
  app.post('/v1/boom/:id', () => {
    const cause = Object.assign(new Error('duplicate key (email)=(ania@example.com)'), { code: '23505' });
    throw Object.assign(new Error('insert failed at 21.0122,52.2297 for ania@example.com', { cause }), {
      name: 'DrizzleQueryError',
    });
  });
  app.get('/v1/refuse/:code', (c) => {
    throw new AppError(c.req.param('code') as never);
  });
  app.get('/v1/rule', () => {
    throw new DomainError('activity.track-too-short', 'only one point');
  });
  app.post(
    '/v1/echo',
    validator('json', (v) => v),
    (c) => c.json({})
  );
  app.get('/v1/teapot', () => {
    throw new HTTPException(400);
  });
  return app;
}

const SECRET_REQUEST = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer secret-bearer-token',
    Cookie: 'cityturfer_session=secret-cookie-value',
    'Content-Type': 'application/json',
    'X-Request-Id': 'req-test-1',
  },
  body: JSON.stringify({ lat: 54.3482, lon: 18.6533, email: 'ania@example.com' }),
};
const LEAKS =
  /ania|example\.com|21\.0122|52\.2297|54\.3482|18\.6533|secret-|act-secret-id|q=private|insert failed|duplicate/;

describe('error reports', () => {
  it('report a forced 500 once, with the route pattern and request id but no input', async () => {
    const transport = capturingTransport();
    const report = createErrorReporter(PRODUCTION, { transport: transport.make });
    expect(report).not.toBeNull();
    const app = failingApp(report!);

    const res = await app.request('/v1/boom/act-secret-id?q=private', SECRET_REQUEST);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'internal' });

    const sent = events(transport.sent);
    expect(sent).toHaveLength(1);
    const [event] = sent as unknown as [ErrorEvent];
    expect(event.tags).toEqual({ request_id: 'req-test-1', method: 'POST', route: '/v1/boom/:id' });
    expect(event.environment).toBe('production');
    expect(event.release).toBe('abc1234');
    const values = event.exception?.values ?? [];
    expect(values.map((v) => v.type)).toEqual(['Error', 'DrizzleQueryError']); // the cause chain, innermost first
    for (const v of values) {
      expect(v.value ?? REDACTED_MESSAGE).toBe(REDACTED_MESSAGE);
    }
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(JSON.stringify(transport.sent)).not.toMatch(LEAKS);
    expect(scrub.scrubEvent).toHaveBeenCalled();
  });

  it('never report expected answers: AppError 403/412/422, DomainError, 404, 413, invalid JSON', async () => {
    const reported: ErrorReportContext[] = [];
    const app = failingApp((_err, ctx) => {
      reported.push(ctx);
      return Promise.resolve();
    });
    const answers = await Promise.all([
      app.request('/v1/refuse/consent.required'),
      app.request('/v1/refuse/precondition-failed'),
      app.request('/v1/refuse/activity.invalid-name'),
      app.request('/v1/rule'),
      app.request('/v1/nothing-here'),
      app.request('/v1/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'x'.repeat(4_600_000),
      }),
      app.request('/v1/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' }),
      app.request('/v1/teapot'),
    ]);
    expect(answers.map((r) => r.status)).toEqual([403, 412, 422, 422, 404, 413, 400, 400]);
    expect(reported).toEqual([]);

    const boom = await app.request('/v1/boom/1', { method: 'POST' });
    expect(boom.status).toBe(500);
    expect(reported).toEqual([expect.objectContaining({ method: 'POST', route: '/v1/boom/:id' })]);
  });

  it('answer the 500 even when the report fails', async () => {
    const transport = (options: BaseTransportOptions) =>
      createTransport(options, () => Promise.reject(new Error('network down')));
    const app = failingApp(createErrorReporter(PRODUCTION, { transport })!);
    const res = await app.request('/v1/boom/1', { method: 'POST' });
    expect(res.status).toBe(500);
  });

  it('send nothing without a DSN, outside production, under tests or outside the EU region', () => {
    expect(reporterState({})).toBe('off');
    expect(reporterState({ VERCEL_ENV: 'production' })).toBe('off');
    expect(reporterState({ ...PRODUCTION, VERCEL_ENV: 'preview' })).toBe('not-production');
    expect(reporterState({ SENTRY_DSN: EU_DSN })).toBe('not-production');
    expect(reporterState({ ...PRODUCTION, VITEST: 'true' })).toBe('not-production');
    expect(reporterState({ ...PRODUCTION, NODE_ENV: 'test' })).toBe('not-production');
    expect(reporterState({ ...PRODUCTION, SENTRY_DSN: 'https://k@o1.ingest.us.sentry.io/2' })).toBe('not-eu');
    expect(reporterState({ ...PRODUCTION, SENTRY_DSN: 'https://k@o1.ingest.sentry.io/2' })).toBe('not-eu');
    expect(reporterState({ ...PRODUCTION, SENTRY_DSN: 'not a dsn' })).toBe('invalid-dsn');
    expect(reporterState(PRODUCTION)).toBe('on');
    expect(createErrorReporter({})).toBeNull();
    expect(createErrorReporter({ ...PRODUCTION, VERCEL_ENV: 'preview' })).toBeNull();
    // The test process itself (VITEST is set): productionDeps wires no reporter.
    expect(productionDeps({ SENTRY_DSN: EU_DSN, VITEST: 'true' }).reportError).toBeUndefined();
  });

  it('a 500 without a reporter is still a 500', async () => {
    const app = createApp(defaultDeps({ log: silentLog }));
    app.get('/v1/boom', () => {
      throw new Error('boom');
    });
    expect((await app.request('/v1/boom')).status).toBe(500);
  });
});
