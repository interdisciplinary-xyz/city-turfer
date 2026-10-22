import type { BackupStore } from './backup/ports';
import type { BackupService } from './backup/use-cases';
import type { IdentityService } from './identity/use-cases';

/**
 * What the API needs from the outside, injected into `createApp(deps)`: tests pass PGlite and their
 * own tokens, src/wiring.ts passes Neon and API_TOKENS. Routes reach them via `c.var.deps`.
 */

/** Who is calling. `verified: false` comes only from the placeholder: no live route may trust it. */
export interface Principal {
  userId: string | null;
  verified: boolean;
  /** `device`: an API_TOKENS device token (no session to revoke); `session`: a Better Auth session. */
  kind?: 'device' | 'session';
  /** The bearer token of a `session` principal (to sign out). */
  sessionToken?: string;
  /** Optional profile from the token configuration, stored when the user is first seen. */
  profile?: { email: string | null; displayName: string | null };
}

/** Port: turns a bearer token into a principal, or null when it is invalid (→ 401 `auth.invalid`). */
export interface AuthVerifier {
  verify(token: string): Promise<Principal | null>;
}

/** One request, as logged: no bodies, ids, coordinates or tokens (the route pattern, not the path). */
export interface RequestLogEntry {
  requestId: string;
  method: string;
  route: string;
  status: number;
  ms: number;
}

export interface ApiLog {
  request(entry: RequestLogEntry): void;
  /** A notable event without personal data (no e-mails, codes, tokens, ids of activities). */
  event?(entry: { msg: string } & Record<string, string | number | boolean>): void;
}

export interface ApiDeps {
  auth: AuthVerifier;
  clock: { now(): number };
  log: ApiLog;
  /** Null when no database is configured: live data routes answer 503 `storage.unavailable`. */
  store: BackupStore | null;
  /** Sign-in with e-mailed codes (Better Auth); null without a database or BETTER_AUTH_SECRET (503). */
  identity: IdentityService | null;
}

/**
 * Used only to generate the spec and in tests of planned routes: it checks that a bearer token is
 * present and marks the caller unverified, which no live route accepts (401).
 */
export const placeholderAuth: AuthVerifier = {
  verify: (token) => Promise.resolve(token ? { userId: null, verified: false } : null),
};

export const jsonLineLog: ApiLog = {
  request: (entry) => process.stdout.write(`${JSON.stringify({ msg: 'request', ...entry })}\n`),
  event: (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`),
};

export const silentLog: ApiLog = { request: () => undefined, event: () => undefined };

export function defaultDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return {
    auth: placeholderAuth,
    clock: { now: () => Date.now() },
    log: jsonLineLog,
    store: null,
    identity: null,
    ...overrides,
  };
}

/** Hono environment of the app: the deps and, on protected routes, the principal. */
export interface AppEnv {
  Variables: {
    deps: ApiDeps;
    principal: Principal;
    requestId: string;
    /** Live data routes only (after `requireStore`): the verified user and the use cases. */
    userId: string;
    backup: BackupService;
  };
}
