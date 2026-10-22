/**
 * The phone's Account tab in the sync chain: the account settings requests its gateway sends
 * (contract 0.5.0, account settings #142), made with the phone's session token. Against an API
 * without them, `missing()` says so and the scenario reports pending.
 */
import type { Pending } from './pending';

export interface AccountActions {
  /** Null when this API has account settings; otherwise why the scenario can't run. */
  missing(): Promise<Pending | null>;
  me(): Promise<{ email: string | null; name: string | null; hasPassword: boolean } | null>;
  /** A blank name clears it. */
  rename(name: string): Promise<number>;
  /** Mails a step-up code to the current address (the fixed code for test addresses). */
  requestStepUpCode(): Promise<number>;
  requestEmailChange(newEmail: string, stepUpCode: string): Promise<number>;
  confirmEmailChange(newEmail: string, code: string): Promise<number>;
  setPassword(newPassword: string, stepUpCode: string): Promise<number>;
}

const CLIENT = 'ios/chain-test';

export function accountActions(base: string, token: string, ip: string): AccountActions {
  const call = async (method: string, path: string, body?: unknown, retry = true): Promise<Response> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'CityTurfer-Client': CLIENT,
        'x-real-ip': ip,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const wait = Number(res.headers.get('Retry-After') ?? NaN);
    // One code per address per minute: wait it out like a user would, never longer.
    if (res.status === 429 && retry && wait <= 61) {
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      return call(method, path, body, false);
    }
    return res;
  };
  return {
    async missing() {
      const res = await call('GET', '/v1/me');
      const me = res.ok ? ((await res.json()) as Record<string, unknown>) : null;
      return me && 'hasPassword' in me
        ? null
        : { pending: `account settings are not on this API (GET /v1/me has no hasPassword; #142)` };
    },
    async me() {
      const res = await call('GET', '/v1/me');
      if (res.status === 401) {
        return null;
      }
      const me = (await res.json()) as { email: string | null; name: string | null; hasPassword: boolean };
      return { email: me.email, name: me.name, hasPassword: me.hasPassword };
    },
    rename: async (name) => (await call('PATCH', '/v1/me', { name })).status,
    requestStepUpCode: async () => (await call('POST', '/v1/me/step-up/codes', {})).status,
    requestEmailChange: async (newEmail, stepUpCode) =>
      (await call('POST', '/v1/me/email/codes', { newEmail, stepUpCode })).status,
    confirmEmailChange: async (newEmail, code) => (await call('POST', '/v1/me/email', { newEmail, code })).status,
    setPassword: async (newPassword, stepUpCode) =>
      (await call('PUT', '/v1/me/password', { newPassword, stepUpCode })).status,
  };
}
