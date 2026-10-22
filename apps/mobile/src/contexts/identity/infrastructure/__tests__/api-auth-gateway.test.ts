import { ApiAuthGateway } from '../api-auth-gateway';

const email = { value: 'ola@example.com' };

interface Call {
  url: string;
  init: RequestInit;
}

function setup(answer: (call: Call) => { status: number; body?: unknown; retryAfter?: string } | Error) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const a = answer(call);
    if (a instanceof Error) {
      throw a;
    }
    return {
      status: a.status,
      text: async () => (a.body === undefined ? '' : JSON.stringify(a.body)),
      headers: { get: (h: string) => (h === 'Retry-After' ? (a.retryAfter ?? null) : null) },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return {
    gw: new ApiAuthGateway({ baseUrl: 'https://api.example.org/', client: 'ios/0.9.0', timeoutMs: 1000, fetchImpl }),
    calls,
  };
}

const headers = (c: Call) => c.init.headers as Record<string, string>;

describe('ApiAuthGateway (contract 0.4.0)', () => {
  it('asks for a code: 202 sent, 400 invalid email, 429 with Retry-After, no answer offline', async () => {
    const answers: ({ status: number; retryAfter?: string } | Error)[] = [
      { status: 202 },
      { status: 400 },
      { status: 429, retryAfter: '120' },
      new TypeError('Network request failed'),
      { status: 503 },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.requestCode(email)).toEqual({ kind: 'sent' });
    expect(calls[0].url).toBe('https://api.example.org/v1/auth/codes');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'ola@example.com' });
    expect(headers(calls[0]).Authorization).toBeUndefined();
    expect(await gw.requestCode(email)).toEqual({ kind: 'invalid-email' });
    expect(await gw.requestCode(email)).toEqual({ kind: 'rate-limited', retryAfterS: 120 });
    expect(await gw.requestCode(email)).toEqual({ kind: 'offline' });
    expect(await gw.requestCode(email)).toEqual({ kind: 'unavailable' });
  });

  it('signs in with the code: the session; 401 is a wrong or used code', async () => {
    const answers = [
      {
        status: 200,
        body: { token: 'tok', expiresAt: '2026-12-20T12:00:00Z', user: { id: 'u_1', email: 'ola@example.com' } },
      },
      { status: 401, body: { code: 'auth.invalid-code' } },
      { status: 200, body: { token: 'tok' } },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.verifyCode(email, '493027')).toEqual({
      kind: 'verified',
      session: {
        token: 'tok',
        expiresAt: Date.parse('2026-12-20T12:00:00Z'),
        account: { id: 'u_1', email: 'ola@example.com' },
      },
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'ola@example.com', code: '493027' });
    expect(await gw.verifyCode(email, '000001')).toEqual({ kind: 'invalid-code' });
    expect(await gw.verifyCode(email, '000002')).toEqual({ kind: 'unavailable' }); // malformed answer
  });

  it('revokes, deletes the account and asks for an export with the bearer token', async () => {
    const answers = [{ status: 204 }, { status: 204 }, { status: 202, body: { id: 'exp_1', status: 'ready' } }];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.revoke('tok')).toEqual({ kind: 'revoked' });
    expect(await gw.deleteAccount('tok')).toEqual({ kind: 'deleted' });
    expect(await gw.requestExport('tok')).toEqual({ kind: 'requested' });
    expect(calls.map((c) => `${c.init.method} ${c.url.replace('https://api.example.org', '')}`)).toEqual([
      'DELETE /v1/auth/session',
      'DELETE /v1/me',
      'POST /v1/me/exports',
    ]);
    expect(calls.every((c) => headers(c).Authorization === 'Bearer tok')).toBe(true);
    expect(calls[2].init.body).toBeUndefined();
  });

  it('maps export refusals: once a day (429), no email to send it to (422), signed out (401)', async () => {
    const answers = [
      { status: 429, retryAfter: '3600' },
      { status: 422, body: { code: 'export.no-email' } },
      { status: 401 },
    ];
    const { gw } = setup(() => answers.shift()!);
    expect(await gw.requestExport('tok')).toEqual({ kind: 'rate-limited', retryAfterS: 3600 });
    expect(await gw.requestExport('tok')).toEqual({ kind: 'no-email' });
    expect(await gw.requestExport('tok')).toEqual({ kind: 'auth' });
  });

  it('a revoke the server no longer knows (401) counts as revoked', async () => {
    const { gw } = setup(() => ({ status: 401 }));
    expect(await gw.revoke('old')).toEqual({ kind: 'revoked' });
  });
});
