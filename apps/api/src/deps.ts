/**
 * What the API needs from the outside, injected into `createApp(deps)`: tests pass fakes, the
 * Postgres + Better Auth wiring (phase 4) passes real adapters. Routes reach them via `c.var.deps`.
 */

/** Who is calling. `verified: false` comes only from the placeholder: no live route may trust it. */
export interface Principal {
  userId: string | null;
  verified: boolean;
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
}

/**
 * Until Better Auth lands (D7) every route but health is planned, so the placeholder only checks
 * that a bearer token is present and marks the caller unverified.
 */
export const placeholderAuth: AuthVerifier = {
  verify: (token) => Promise.resolve(token ? { userId: null, verified: false } : null),
};

export const jsonLineLog: ApiLog = {
  request: (entry) => process.stdout.write(`${JSON.stringify({ msg: 'request', ...entry })}\n`),
};

export const silentLog: ApiLog = { request: () => undefined };

export function defaultDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return { auth: placeholderAuth, clock: { now: () => Date.now() }, log: jsonLineLog, ...overrides };
}

/** Hono environment of the app: the deps and, on protected routes, the principal. */
export interface AppEnv {
  Variables: { deps: ApiDeps; principal: Principal; requestId: string };
}
