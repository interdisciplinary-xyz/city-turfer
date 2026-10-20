import type { BackupStore } from './backup/ports';
import type { BackupService } from './backup/use-cases';

/**
 * What the API needs from the outside, injected into `createApp(deps)`: tests pass PGlite and their
 * own tokens, src/wiring.ts passes Neon and API_TOKENS. Routes reach them via `c.var.deps`.
 */

/** Who is calling. `verified: false` comes only from the placeholder: no live route may trust it. */
export interface Principal {
  userId: string | null;
  verified: boolean;
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
}

export interface ApiDeps {
  auth: AuthVerifier;
  clock: { now(): number };
  log: ApiLog;
  /** Null when no database is configured: live data routes answer 503 `storage.unavailable`. */
  store: BackupStore | null;
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
};

export const silentLog: ApiLog = { request: () => undefined };

export function defaultDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return { auth: placeholderAuth, clock: { now: () => Date.now() }, log: jsonLineLog, store: null, ...overrides };
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
