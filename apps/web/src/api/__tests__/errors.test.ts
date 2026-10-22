import { describe, expect, it } from 'vitest';

import { parseRetryAfter, PortalError, toPortalError, unreachableError } from '../errors';

const problem = (status: number, code: string, headers: Record<string, string> = {}) =>
  new Response(
    JSON.stringify({
      type: `https://cityturfer.app/problems/${code}`,
      title: 'Developer English',
      status,
      code,
      detail: 'ania@example.com',
    }),
    { status, headers: { 'Content-Type': 'application/problem+json', ...headers } }
  );

const mapped = async (response: Response) => toPortalError(response, await response.clone().json());

describe('toPortalError', () => {
  it('maps a known code to its message key', async () => {
    const error = await mapped(problem(401, 'auth.invalid-code'));
    expect(error.code).toBe('auth.invalid-code');
    expect(error.messageKey).toBe('errors.auth.invalid-code');
  });

  it('never carries the title, detail or input values', async () => {
    const error = await mapped(problem(422, 'export.no-email'));
    expect(error.message).toBe('export.no-email');
    expect(JSON.stringify(error)).not.toContain('ania@example.com');
    expect(JSON.stringify(error)).not.toContain('Developer English');
  });

  it('turns an unknown code into generic, with the request id', async () => {
    const error = await mapped(problem(500, 'internal', { 'X-Request-Id': 'req_123' }));
    expect(error.code).toBe('generic');
    expect(error.requestId).toBe('req_123');
  });

  it('treats any other 401 as a lost session', async () => {
    expect((await mapped(problem(401, 'auth.invalid'))).code).toBe('signed-out');
    expect((await mapped(problem(401, 'auth.missing'))).code).toBe('signed-out');
  });

  it('reads Retry-After on a 429', async () => {
    const error = await mapped(problem(429, 'auth.rate-limited', { 'Retry-After': '42' }));
    expect(error.code).toBe('auth.rate-limited');
    expect(error.retryAfterSeconds).toBe(42);
  });

  it('calls a gateway answer without a problem unreachable', () => {
    const error = toPortalError(new Response('<html>Bad gateway</html>', { status: 502 }), '<html>Bad gateway</html>');
    expect(error.code).toBe('unreachable');
    expect(error.retryable).toBe(true);
  });

  it('keeps storage.unavailable (a real problem on 503) and makes it retryable', async () => {
    const error = await mapped(problem(503, 'storage.unavailable'));
    expect(error.code).toBe('storage.unavailable');
    expect(error.retryable).toBe(true);
  });

  it('a plain 4xx without a body is generic, not retryable', () => {
    const error = toPortalError(new Response(null, { status: 418 }), undefined);
    expect(error.code).toBe('generic');
    expect(error.retryable).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    expect(parseRetryAfter('30', now)).toBe(30);
    expect(parseRetryAfter('Thu, 22 Oct 2026 10:01:00 GMT', now)).toBe(60);
    expect(parseRetryAfter('Thu, 22 Oct 2026 09:00:00 GMT', now)).toBe(0);
  });

  it('ignores missing or unreadable values', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

it('unreachableError is a PortalError', () => {
  expect(unreachableError()).toBeInstanceOf(PortalError);
  expect(unreachableError().code).toBe('unreachable');
});
