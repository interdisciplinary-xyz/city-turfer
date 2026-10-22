import type { AccountFailure, AccountGateway, AccountSession, Email } from '@cityturfer/core/identity/ports';

export interface ApiAuthGatewayOptions {
  baseUrl: string;
  /** `CityTurfer-Client` header, e.g. `ios/0.9.0`. */
  client: string;
  timeoutMs: number;
  /** Injected in tests; the global fetch otherwise. */
  fetchImpl?: typeof fetch;
}

interface Answer {
  status: number;
  json: unknown;
  retryAfter: string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** `Retry-After` in seconds (the API sends seconds), or null. */
function retryAfterS(a: Answer): number | null {
  const n = Number(a.retryAfter);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** HTTP → Identity's failure kinds. The only place that knows status codes. */
function failureOf(a: Answer | null): AccountFailure {
  if (!a) {
    return { kind: 'offline' };
  }
  if (a.status === 401) {
    return { kind: 'auth' };
  }
  if (a.status === 429) {
    return { kind: 'rate-limited', retryAfterS: retryAfterS(a) };
  }
  return { kind: 'unavailable' };
}

function sessionOf(json: unknown): AccountSession | null {
  if (!isObject(json) || typeof json.token !== 'string' || !isObject(json.user)) {
    return null;
  }
  const { id, email } = json.user;
  const expiresAt = typeof json.expiresAt === 'string' ? Date.parse(json.expiresAt) : NaN;
  if (typeof id !== 'string' || typeof email !== 'string' || !json.token) {
    return null;
  }
  return { token: json.token, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0, account: { id, email } };
}

/**
 * CityTurfer accounts over plain fetch (contract 0.4.0: email one-time codes, bearer sessions).
 * Anti-corruption layer: wire formats and status codes stay here. Never logs: bodies carry the
 * email, the code and the token.
 */
export class ApiAuthGateway implements AccountGateway {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ApiAuthGatewayOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
  }

  async requestCode(email: Email) {
    const a = await this.request('POST', '/v1/auth/codes', { body: { email: email.value } });
    if (a?.status === 202 || a?.status === 200) {
      return { kind: 'sent' as const };
    }
    return a?.status === 400 ? { kind: 'invalid-email' as const } : failureOf(a);
  }

  async verifyCode(email: Email, code: string) {
    const a = await this.request('POST', '/v1/auth/sign-in', { body: { email: email.value, code } });
    if (a?.status === 200) {
      const session = sessionOf(a.json);
      return session ? { kind: 'verified' as const, session } : { kind: 'unavailable' as const };
    }
    // 401 auth.invalid-code (wrong, expired or burnt); 400: not a code at all.
    return a?.status === 401 || a?.status === 400 ? { kind: 'invalid-code' as const } : failureOf(a);
  }

  async revoke(token: string) {
    const a = await this.request('DELETE', '/v1/auth/session', { token });
    // 401: the session was not valid any more anyway.
    return a?.status === 204 || a?.status === 200 || a?.status === 401 ? { kind: 'revoked' as const } : failureOf(a);
  }

  async deleteAccount(token: string) {
    const a = await this.request('DELETE', '/v1/me', { token });
    return a?.status === 204 || a?.status === 200 ? { kind: 'deleted' as const } : failureOf(a);
  }

  async requestExport(token: string) {
    // Built at once on the server; the link only goes out by email (24 h, works once).
    const a = await this.request('POST', '/v1/me/exports', { token });
    if (a?.status === 202 || a?.status === 200) {
      return { kind: 'requested' as const };
    }
    return a?.status === 422 ? { kind: 'no-email' as const } : failureOf(a);
  }

  /** Null when there was no answer (offline, DNS, timeout). */
  private async request(
    method: string,
    path: string,
    o: { body?: unknown; token?: string } = {}
  ): Promise<Answer | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          'CityTurfer-Client': this.opts.client,
          ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}),
          ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, retryAfter: res.headers.get('Retry-After') };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
