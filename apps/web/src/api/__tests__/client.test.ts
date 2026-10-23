import { describe, expect, it, vi } from 'vitest';

import { CLIENT_HEADER, createPortalClient, unwrap } from '../client';
import { isPortalError } from '../errors';
import { portalApi } from '../portal-api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

function setup(answer: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const onUnauthorized = vi.fn();
  const client = createPortalClient({
    onUnauthorized,
    baseUrl: 'https://cityturfer.test/api',
    version: '9.9.9',
    fetch: async (request) => {
      requests.push(request);
      return answer(request);
    },
  });
  return { api: portalApi(client), requests, onUnauthorized };
}

const ME = { id: 'u_1', email: 'walker@e2e.cityturfer.test', displayName: 'u_1', createdAt: '2026-10-01T08:00:00Z' };

describe('createPortalClient', () => {
  it('calls /api/v1 same-origin with the client header and no Authorization', async () => {
    const { api, requests } = setup(() => json(200, ME));
    await expect(api.me()).resolves.toEqual(ME);
    const [request] = requests;
    expect(new URL(request.url).pathname).toBe('/api/v1/me');
    expect(request.credentials).toBe('same-origin');
    expect(request.cache).toBe('no-store');
    expect(request.headers.get(CLIENT_HEADER)).toBe('web/9.9.9');
    expect(request.headers.get('Authorization')).toBeNull();
  });

  it('sends the client header on unsafe requests, sign-in included', async () => {
    const { api, requests } = setup(() =>
      json(200, {
        client: 'browser',
        expiresAt: '2026-11-05T08:00:00Z',
        absoluteExpiresAt: null,
        user: { id: 'u_1', email: 'a@e2e.cityturfer.test' },
      })
    );
    await api.signIn('a@e2e.cityturfer.test', '000000', true);
    const [request] = requests;
    expect(request.method).toBe('POST');
    expect(request.headers.get(CLIENT_HEADER)).toBe('web/9.9.9');
    expect(await request.json()).toEqual({
      email: 'a@e2e.cityturfer.test',
      code: '000000',
      client: 'browser',
      sharedComputer: true,
    });
  });

  it('a 401 on a data route signs out once and throws signed-out', async () => {
    const { api, onUnauthorized } = setup(() =>
      json(401, { code: 'auth.invalid', status: 401, title: 'x', type: 'x' })
    );
    const error = await api.me().catch((caught: unknown) => caught);
    expect(isPortalError(error) && error.code).toBe('signed-out');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith('auth.invalid');
  });

  it('a wrong code on sign-in is an answer, not a lost session', async () => {
    const { api, onUnauthorized } = setup(() =>
      json(401, { code: 'auth.invalid-code', status: 401, title: 'x', type: 'x' })
    );
    const error = await api.signIn('a@e2e.cityturfer.test', '123456', false).catch((caught: unknown) => caught);
    expect(isPortalError(error) && error.code).toBe('auth.invalid-code');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a 401 on sign-out does not loop back to sign-in', async () => {
    const { api, onUnauthorized } = setup(() =>
      json(401, { code: 'auth.missing', status: 401, title: 'x', type: 'x' })
    );
    await api.signOut().catch(() => undefined);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a failed fetch is unreachable', async () => {
    const { api } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await api.consents().catch((caught: unknown) => caught);
    expect(isPortalError(error) && error.code).toBe('unreachable');
  });

  it('204 answers resolve to undefined', async () => {
    const { api, requests } = setup(() => new Response(null, { status: 204 }));
    await expect(api.revokeSessions('others')).resolves.toBeUndefined();
    expect(new URL(requests[0].url).search).toBe('?scope=others');
  });
});

it('unwrap passes data through', async () => {
  await expect(unwrap(Promise.resolve({ data: 1, response: new Response('1') }))).resolves.toBe(1);
});
