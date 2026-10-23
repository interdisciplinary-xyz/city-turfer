import { type AccountFieldError, isAccountFieldError } from '@cityturfer/core/identity';
import type {
  AccountDetails,
  AccountFailure,
  AccountGateway,
  AccountSession,
  Email,
} from '@cityturfer/core/identity/ports';

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

/** The problem `code` of an answer (RFC 9457 body), or null. */
const problemCode = (a: Answer): string | null =>
  isObject(a.json) && typeof a.json.code === 'string' ? a.json.code : null;

/** HTTP → Identity's failure kinds. The only place that knows status codes. */
function failureOf(a: Answer | null): AccountFailure {
  if (!a) {
    return { kind: 'offline' };
  }
  // 403 identity.account-required: a device-token session, not an account's: sign in with the account.
  if (a.status === 401 || (a.status === 403 && problemCode(a) === 'identity.account-required')) {
    return { kind: 'auth' };
  }
  if (a.status === 429) {
    return { kind: 'rate-limited', retryAfterS: retryAfterS(a) };
  }
  return { kind: 'unavailable' };
}

/** A refused field: the problem's own code, or the first of its `errors[]` that is one of the shared rules. */
function fieldErrorOf(a: Answer | null): { kind: 'field-error'; code: AccountFieldError } | null {
  if (!a || a.status < 400 || a.status >= 500) {
    return null;
  }
  const own = problemCode(a);
  const listed = isObject(a.json) && Array.isArray(a.json.errors) ? a.json.errors : [];
  const codes = [own, ...listed.map((e) => (isObject(e) && typeof e.code === 'string' ? e.code : null))];
  const code = codes.find((c): c is AccountFieldError => c !== null && isAccountFieldError(c));
  return code ? { kind: 'field-error', code } : null;
}

/** 401 `auth.invalid-code`: the code was wrong, expired or used; any other 401: the session. */
const isInvalidCode = (a: Answer | null) => a?.status === 401 && problemCode(a) === 'auth.invalid-code';

const isoMs = (v: unknown): number | null => {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

function meOf(json: unknown): AccountDetails | null {
  if (!isObject(json) || typeof json.id !== 'string' || typeof json.email !== 'string') {
    return null;
  }
  const hasPassword = json.hasPassword === true;
  return {
    id: json.id,
    email: json.email,
    name: typeof json.name === 'string' && json.name ? json.name : null,
    hasPassword,
    passwordChangedAt: hasPassword ? isoMs(json.passwordChangedAt) : null,
  };
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
 * CityTurfer accounts over plain fetch (contract 0.4.0: email one-time codes, bearer sessions;
 * 0.5.0: account settings and the optional password). Anti-corruption layer: wire formats and
 * status codes stay here. Never logs: bodies carry the email, codes, passwords and the token.
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

  async fetchMe(token: string) {
    const a = await this.request('GET', '/v1/me', { token });
    if (a?.status === 200) {
      const me = meOf(a.json);
      return me ? { kind: 'me' as const, me } : { kind: 'unavailable' as const };
    }
    return failureOf(a);
  }

  async updateName(token: string, name: string | null) {
    // Blank clears the name (contract: `{ name: "" }`).
    const a = await this.request('PATCH', '/v1/me', { token, body: { name: name ?? '' } });
    if (a?.status === 200) {
      const kept = isObject(a.json) && 'name' in a.json ? a.json.name : name;
      return { kind: 'saved' as const, name: typeof kept === 'string' && kept ? kept : null };
    }
    return fieldErrorOf(a) ?? failureOf(a);
  }

  async requestStepUpCode(token: string) {
    const a = await this.request('POST', '/v1/me/step-up/codes', { token, body: {} });
    return a?.status === 202 || a?.status === 200 ? { kind: 'sent' as const } : failureOf(a);
  }

  async requestEmailChange(token: string, newEmail: string, stepUpCode: string) {
    const a = await this.request('POST', '/v1/me/email/codes', { token, body: { newEmail, stepUpCode } });
    if (a?.status === 202 || a?.status === 200) {
      return { kind: 'sent' as const };
    }
    return isInvalidCode(a) ? { kind: 'invalid-code' as const } : (fieldErrorOf(a) ?? failureOf(a));
  }

  async confirmEmailChange(token: string, newEmail: string, code: string) {
    const a = await this.request('POST', '/v1/me/email', { token, body: { newEmail, code } });
    if (a?.status === 200) {
      const email = isObject(a.json) && typeof a.json.email === 'string' ? a.json.email : newEmail;
      return { kind: 'changed' as const, email };
    }
    if (isInvalidCode(a)) {
      return { kind: 'invalid-code' as const };
    }
    if (a?.status === 409) {
      return { kind: 'email-taken' as const };
    }
    return fieldErrorOf(a) ?? failureOf(a);
  }

  async setPassword(token: string, newPassword: string, stepUpCode: string) {
    const a = await this.request('PUT', '/v1/me/password', { token, body: { newPassword, stepUpCode } });
    if (a?.status === 204 || a?.status === 200) {
      return { kind: 'saved' as const };
    }
    if (isInvalidCode(a)) {
      return { kind: 'invalid-code' as const };
    }
    if (a && problemCode(a) === 'password.breached') {
      return { kind: 'breached' as const };
    }
    return fieldErrorOf(a) ?? failureOf(a);
  }

  async removePassword(token: string, stepUpCode: string) {
    const a = await this.request('DELETE', '/v1/me/password', { token, body: { stepUpCode } });
    if (a?.status === 204 || a?.status === 200) {
      return { kind: 'removed' as const };
    }
    return isInvalidCode(a) ? { kind: 'invalid-code' as const } : failureOf(a);
  }

  async signInWithPassword(email: Email, password: string) {
    const a = await this.request('POST', '/v1/auth/sign-in', { body: { email: email.value, password } });
    if (a?.status === 200) {
      const session = sessionOf(a.json);
      return session ? { kind: 'verified' as const, session } : { kind: 'unavailable' as const };
    }
    // 401 auth.invalid-credentials: a wrong password, no password, or no account (the same answer).
    return a?.status === 401 ? { kind: 'invalid-credentials' as const } : failureOf(a);
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
