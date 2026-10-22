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

describe('ApiAuthGateway: account settings (contract 0.5.0)', () => {
  type A = { status: number; body?: unknown; retryAfter?: string } | Error;
  const route = (c: Call) => `${c.init.method} ${c.url.replace('https://api.example.org', '')}`;
  const body = (c: Call) => (c.init.body === undefined ? undefined : JSON.parse(String(c.init.body)));

  it('reads me: name, password state; an older server without them reads as no name, no password', async () => {
    const answers: A[] = [
      {
        status: 200,
        body: {
          id: 'u_1',
          email: 'ola@example.com',
          displayName: 'Ola',
          name: 'Ola',
          hasPassword: true,
          passwordChangedAt: '2026-10-20T10:00:00Z',
          createdAt: '2026-10-01T00:00:00Z',
        },
      },
      { status: 200, body: { id: 'u_1', email: 'ola@example.com', displayName: 'u_1' } },
      { status: 200, body: { id: 'u_1', email: null, displayName: 'u_1' } },
      { status: 401, body: { code: 'auth.invalid' } },
      { status: 403, body: { code: 'identity.account-required' } },
      new TypeError('Network request failed'),
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.fetchMe('tok')).toEqual({
      kind: 'me',
      me: {
        id: 'u_1',
        email: 'ola@example.com',
        name: 'Ola',
        hasPassword: true,
        passwordChangedAt: Date.parse('2026-10-20T10:00:00Z'),
      },
    });
    expect(route(calls[0])).toBe('GET /v1/me');
    expect(headers(calls[0]).Authorization).toBe('Bearer tok');
    expect(await gw.fetchMe('tok')).toMatchObject({ me: { name: null, hasPassword: false, passwordChangedAt: null } });
    expect(await gw.fetchMe('tok')).toEqual({ kind: 'unavailable' }); // a device-token user: no email
    expect(await gw.fetchMe('tok')).toEqual({ kind: 'auth' });
    expect(await gw.fetchMe('tok')).toEqual({ kind: 'auth' }); // a device token, not an account
    expect(await gw.fetchMe('tok')).toEqual({ kind: 'offline' });
  });

  it('updates the name (blank clears it) and maps the field rules from problem codes', async () => {
    const answers: A[] = [
      { status: 200, body: { id: 'u_1', email: 'ola@example.com', displayName: 'Ola', name: 'Ola' } },
      { status: 200, body: { id: 'u_1', email: 'ola@example.com', displayName: 'u_1', name: null } },
      { status: 422, body: { code: 'display-name.too-long' } },
      { status: 400, body: { code: 'invalid-request', errors: [{ pointer: '/name', code: 'display-name.invalid' }] } },
      { status: 400, body: { code: 'invalid-request' } },
      { status: 429, retryAfter: '30' },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.updateName('tok', 'Ola')).toEqual({ kind: 'saved', name: 'Ola' });
    expect(route(calls[0])).toBe('PATCH /v1/me');
    expect(body(calls[0])).toEqual({ name: 'Ola' });
    expect(await gw.updateName('tok', null)).toEqual({ kind: 'saved', name: null });
    expect(body(calls[1])).toEqual({ name: '' });
    expect(await gw.updateName('tok', 'x')).toEqual({ kind: 'field-error', code: 'display-name.too-long' });
    expect(await gw.updateName('tok', 'x')).toEqual({ kind: 'field-error', code: 'display-name.invalid' });
    expect(await gw.updateName('tok', 'x')).toEqual({ kind: 'unavailable' });
    expect(await gw.updateName('tok', 'x')).toEqual({ kind: 'rate-limited', retryAfterS: 30 });
  });

  it('step-up code and the two email-change steps', async () => {
    const answers: A[] = [
      { status: 202, body: {} },
      { status: 429, retryAfter: '60' },
      { status: 202, body: {} },
      { status: 401, body: { code: 'auth.invalid-code' } },
      { status: 422, body: { code: 'email.unchanged' } },
      { status: 401, body: { code: 'auth.invalid' } },
      { status: 200, body: { id: 'u_1', email: 'new@example.com', displayName: 'Ola' } },
      { status: 401, body: { code: 'auth.invalid-code' } },
      { status: 409, body: { code: 'email.taken' } },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.requestStepUpCode('tok')).toEqual({ kind: 'sent' });
    expect(route(calls[0])).toBe('POST /v1/me/step-up/codes');
    expect(body(calls[0])).toEqual({});
    expect(await gw.requestStepUpCode('tok')).toEqual({ kind: 'rate-limited', retryAfterS: 60 });

    expect(await gw.requestEmailChange('tok', 'new@example.com', '111111')).toEqual({ kind: 'sent' });
    expect(route(calls[2])).toBe('POST /v1/me/email/codes');
    expect(body(calls[2])).toEqual({ newEmail: 'new@example.com', stepUpCode: '111111' });
    expect(await gw.requestEmailChange('tok', 'new@example.com', '1')).toEqual({ kind: 'invalid-code' });
    expect(await gw.requestEmailChange('tok', 'new@example.com', '1')).toEqual({
      kind: 'field-error',
      code: 'email.unchanged',
    });
    // Any other 401 is the session, not the code.
    expect(await gw.requestEmailChange('tok', 'new@example.com', '1')).toEqual({ kind: 'auth' });

    expect(await gw.confirmEmailChange('tok', 'new@example.com', '222222')).toEqual({
      kind: 'changed',
      email: 'new@example.com',
    });
    expect(route(calls[6])).toBe('POST /v1/me/email');
    expect(body(calls[6])).toEqual({ newEmail: 'new@example.com', code: '222222' });
    expect(await gw.confirmEmailChange('tok', 'new@example.com', '1')).toEqual({ kind: 'invalid-code' });
    expect(await gw.confirmEmailChange('tok', 'new@example.com', '1')).toEqual({ kind: 'email-taken' });
  });

  it('sets and removes the password', async () => {
    const answers: A[] = [
      { status: 204 },
      { status: 422, body: { code: 'password.breached' } },
      { status: 422, body: { code: 'password.too-short' } },
      { status: 401, body: { code: 'auth.invalid-code' } },
      { status: 204 },
      { status: 401, body: { code: 'auth.invalid-code' } },
      { status: 503 },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.setPassword('tok', 'correct horse battery', '111111')).toEqual({ kind: 'saved' });
    expect(route(calls[0])).toBe('PUT /v1/me/password');
    expect(body(calls[0])).toEqual({ newPassword: 'correct horse battery', stepUpCode: '111111' });
    expect(await gw.setPassword('tok', 'x', '1')).toEqual({ kind: 'breached' });
    expect(await gw.setPassword('tok', 'x', '1')).toEqual({ kind: 'field-error', code: 'password.too-short' });
    expect(await gw.setPassword('tok', 'x', '1')).toEqual({ kind: 'invalid-code' });
    expect(await gw.removePassword('tok', '111111')).toEqual({ kind: 'removed' });
    expect(route(calls[4])).toBe('DELETE /v1/me/password');
    expect(body(calls[4])).toEqual({ stepUpCode: '111111' });
    expect(await gw.removePassword('tok', '1')).toEqual({ kind: 'invalid-code' });
    expect(await gw.removePassword('tok', '1')).toEqual({ kind: 'unavailable' });
  });

  it('signs in with a password: the session; every 401 is invalid credentials; no bearer sent', async () => {
    const answers: A[] = [
      {
        status: 200,
        body: { token: 'tok', expiresAt: '2026-12-20T12:00:00Z', user: { id: 'u_1', email: 'ola@example.com' } },
      },
      { status: 401, body: { code: 'auth.invalid-credentials' } },
      { status: 429, retryAfter: '600' },
    ];
    const { gw, calls } = setup(() => answers.shift()!);
    expect(await gw.signInWithPassword(email, 'correct horse battery')).toMatchObject({
      kind: 'verified',
      session: { token: 'tok', account: { id: 'u_1', email: 'ola@example.com' } },
    });
    expect(route(calls[0])).toBe('POST /v1/auth/sign-in');
    expect(body(calls[0])).toEqual({ email: 'ola@example.com', password: 'correct horse battery' });
    expect(headers(calls[0]).Authorization).toBeUndefined();
    expect(await gw.signInWithPassword(email, 'nope')).toEqual({ kind: 'invalid-credentials' });
    expect(await gw.signInWithPassword(email, 'nope')).toEqual({ kind: 'rate-limited', retryAfterS: 600 });
  });
});
