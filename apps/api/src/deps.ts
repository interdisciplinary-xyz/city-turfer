import type { CellGrid } from '@cityturfer/core/territory/ports';

import type { BackupStore } from './backup/ports';
import type { BackupService } from './backup/use-cases';
import type { AccountService } from './identity/account';
import type { IdentityService } from './identity/use-cases';
import type { RetentionService } from './privacy/retention';
import type { ExportService } from './privacy/use-cases';
import type { TurfService } from './territory/turf-service';

/**
 * What the API needs from the outside, injected into `createApp(deps)`: tests pass PGlite and their
 * own tokens, src/wiring.ts passes Neon and API_TOKENS. Routes reach them via `c.var.deps`.
 */

/**
 * Who a principal acts for. Only `user` exists today: every /v1 route serves the user themself and
 * refuses any other realm (401). The admin portal gets its own realm, host and cookie later (the
 * admin portal plan), so a staff session can never call a user route.
 */
export type Realm = 'user';

/** How the caller presented its credential: `Authorization: Bearer …` or the web session cookie. */
export type Credential = 'bearer' | 'cookie';

/** What kind of client a session belongs to: the app (bearer token) or a browser (cookie). */
export type SessionClient = 'phone' | 'browser';

/** Who is calling. `verified: false` comes only from the placeholder: no live route may trust it. */
export interface Principal {
  realm: Realm;
  userId: string | null;
  verified: boolean;
  /** `device`: an API_TOKENS device token (no session to revoke); `session`: a Better Auth session. */
  kind?: 'device' | 'session';
  /** Where the credential came from (set by `requireCaller`). */
  credential?: Credential;
  /** The raw, stored token of a `session` principal (to sign out). Never logged or answered. */
  sessionToken?: string;
  /** The opaque id of a `session` principal's session (`GET /v1/auth/sessions` marks it `current`). */
  sessionId?: string;
  /** The client of a `session` principal: phones use bearer tokens, browsers the cookie. */
  client?: SessionClient;
  /** Optional profile from the token configuration, stored when the user is first seen. */
  profile?: { email: string | null; displayName: string | null };
}

/**
 * Port: turns a credential into a principal, or null when it is invalid (→ 401 `auth.invalid`).
 * `credential` says how it arrived: device tokens and phone sessions work only as `bearer`,
 * browser sessions only as `cookie`.
 */
export interface AuthVerifier {
  verify(token: string, credential?: Credential): Promise<Principal | null>;
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
  /** Territory's CellGrid (H3, src/wiring.ts): the backup claims turf with it. Null without a store. */
  grid: CellGrid | null;
  /** Sign-in with e-mailed codes (Better Auth); null without a database or BETTER_AUTH_SECRET (503). */
  identity: IdentityService | null;
  /** Account settings (name, e-mail, password); null when sign-in is off (503). */
  accounts: AccountService | null;
  /** Data exports (zip + e-mailed link); null without a database (503). */
  exports: ExportService | null;
  /** Purges expired export files, codes, sessions and rate-limit rows; null without a database (503). */
  retention: RetentionService | null;
  /** The bearer Vercel Cron sends (`CRON_SECRET`); null → the cron route answers 404. */
  cronSecret: string | null;
  /**
   * The website's origin (`WEB_ORIGIN`, e.g. `https://cityturfer.app`): cookie requests that change
   * something must come from it (CSRF guard). Null → browser sign-in and cookie writes answer 403.
   */
  webOrigin: string | null;
  /**
   * `WEB_EDGE_SECRET`: the website's `/api/v1/*` route sends it in the `cityturfer-edge` header, so
   * only those requests may name the visitor's IP in `x-vercel-forwarded-for` (src/client-ip.ts).
   * Null → that header is never trusted (direct callers, local runs).
   */
  webEdgeSecret: string | null;
}

/** The local website (`pnpm run web:dev`): WEB_ORIGIN off Vercel when it is not set. */
export const DEV_WEB_ORIGIN = 'https://cityturfer.local';

/**
 * Used only to generate the spec and in tests of planned routes: it checks that a bearer token is
 * present and marks the caller unverified, which no live route accepts (401).
 */
export const placeholderAuth: AuthVerifier = {
  verify: (token) => Promise.resolve(token ? { realm: 'user', userId: null, verified: false } : null),
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
    grid: null,
    identity: null,
    accounts: null,
    exports: null,
    retention: null,
    cronSecret: null,
    webOrigin: DEV_WEB_ORIGIN,
    webEdgeSecret: null,
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
    /** Live data routes only: the turf reads. */
    turf: TurfService;
  };
}
