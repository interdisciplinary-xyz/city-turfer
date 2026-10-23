import { H3CellGrid } from '@cityturfer/core/h3';

import { deviceTokenAuth, parseApiTokens } from './auth/device-tokens';
import { MIN_WEB_EDGE_SECRET_LENGTH } from './client-ip';
import { DrizzleAccountRepository } from './db/accounts';
import { DrizzleExportStore, PostgresFileStorage } from './db/exports';
import { createNeonDb } from './db/neon';
import { PostgresRateLimiter } from './db/rate-limits';
import { DrizzleRetentionStore } from './db/retention';
import { DrizzleSessionStore } from './db/sessions';
import { type Db, DrizzleBackupStore } from './db/store';
import { type ApiDeps, type ApiLog, defaultDeps, DEV_WEB_ORIGIN, jsonLineLog } from './deps';
import { AccountService } from './identity/account';
import { type Auth, createAuth } from './identity/better-auth';
import { type BreachedPasswords, HibpBreachedPasswords } from './identity/breached-passwords';
import { OneTimeCodes } from './identity/codes';
import { BrevoMailer, type Mailer, nullMailer, parseMailFrom } from './identity/mailer';
import { compositeVerifier, IdentityService } from './identity/use-cases';
import { RetentionService } from './privacy/retention';
import { ExportService } from './privacy/use-cases';
import { LOCAL_API_PORT } from './spec';

/**
 * Production wiring from environment variables (Vercel → Settings → Environment Variables;
 * runbook: docs/operations/api-deploy.md):
 * - `DATABASE_URL`: Neon pooled connection string (required in production; elsewhere missing →
 *   live data routes answer 503).
 * - `API_TOKENS`: JSON object sha256(token) hex → userId (device tokens, one more release).
 * - `BETTER_AUTH_SECRET` (≥ 32 characters): turns on sign-in with e-mailed codes.
 * - `BREVO_API_KEY` + `MAIL_FROM` (`CityTurfer <hello@…>`): sends the codes and export links.
 * - `API_PUBLIC_URL`: the API's public base URL (export links in e-mails).
 * - `CRON_SECRET` (≥ 16 characters): Vercel Cron's bearer for `GET /internal/cron/retention`
 *   (without it the route answers 404).
 * - `AUTH_FIXED_CODE`: the code for `@e2e.cityturfer.test` addresses only (sign-in, step-up and
 *   new-address codes) — never in production (boot fails); real addresses always get random codes.
 * - `WEB_ORIGIN` (`https://…`, no path): the website whose `/api/v1/*` rewrite reaches this API.
 *   Browser sign-in and cookie writes must come from it (CSRF guard). Off Vercel it defaults to
 *   https://cityturfer.local; on Vercel, unset → browser sessions are off (phones unaffected).
 * - `WEB_EDGE_SECRET` (≥ 32 characters): the same value as on the website's Vercel project, whose
 *   `/api/v1/*` route sends it in the `cityturfer-edge` header; only then is the visitor's
 *   `x-vercel-forwarded-for` trusted for the per-IP sign-in limits (src/client-ip.ts). Required in
 *   production when WEB_ORIGIN is set.
 * The breached-password check calls the keyless HIBP range API on every deployment (no variable).
 * Production = `VERCEL_ENV=production`: missing secrets fail the boot instead of degrading.
 * Nothing secret is logged: only whether each is configured.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface WiringOverrides {
  /** A database other than DATABASE_URL (the local server's PGlite). */
  db?: Db;
  /** The local server's console mailer. */
  mailer?: Mailer;
  /** The local server's fake breach check (no network); production calls HIBP. */
  breached?: BreachedPasswords;
  /** The local server's mock accounts, which also get AUTH_FIXED_CODE (none in production). */
  fixedCodeEmails?: readonly string[];
}

/**
 * The account-settings use cases over Postgres and Better Auth (also used by the tests' wiring).
 * Mail failures log the mail's kind only.
 */
export function accountService(input: {
  db: Db;
  auth: Auth;
  identity: IdentityService;
  secret: string;
  mailer: Mailer;
  breached: BreachedPasswords;
  clock: { now(): number };
  fixedCode?: string | null;
  fixedCodeEmails?: readonly string[];
  log?: ApiLog;
}): AccountService {
  return new AccountService({
    repo: new DrizzleAccountRepository(input.db),
    codes: new OneTimeCodes(input.auth, input.secret),
    limits: input.identity.limits,
    mailer: input.mailer,
    breached: input.breached,
    hashPassword: async (password) => (await input.auth.$context).password.hash(password),
    clock: input.clock,
    fixedCode: input.fixedCode ?? null,
    fixedCodeEmails: input.fixedCodeEmails,
    onMailError: (kind) =>
      input.log?.event?.({ msg: kind === 'code' ? 'auth.code-not-sent' : 'account.notice-not-sent' }),
  });
}

export function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL_ENV === 'production';
}

/** Refuses to boot production with missing or unsafe settings (names only, never values). */
export function checkProductionEnv(env: NodeJS.ProcessEnv): void {
  if (!isProduction(env)) {
    return;
  }
  const problems: string[] = [];
  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is required');
  }
  if (!cronSecretOf(env)) {
    problems.push(`CRON_SECRET (at least ${MIN_CRON_SECRET_LENGTH} characters) is required`);
  }
  if (env.AUTH_FIXED_CODE) {
    problems.push('AUTH_FIXED_CODE must not be set in production');
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    problems.push('BETTER_AUTH_SECRET (at least 32 characters) is required');
  }
  if (!env.BREVO_API_KEY) {
    problems.push('BREVO_API_KEY is required');
  }
  if (!env.MAIL_FROM || !parseMailFrom(env.MAIL_FROM)) {
    problems.push('MAIL_FROM ("Name <address>") is required');
  }
  if (!env.API_PUBLIC_URL?.startsWith('https://')) {
    problems.push('API_PUBLIC_URL (https://…) is required');
  }
  if (env.WEB_ORIGIN?.trim() && !webEdgeSecretOf(env)) {
    problems.push(`WEB_EDGE_SECRET (at least ${MIN_WEB_EDGE_SECRET_LENGTH} characters) is required with WEB_ORIGIN`);
  }
  if (problems.length > 0) {
    throw new ConfigError(`Production configuration: ${problems.join('; ')}.`);
  }
}

/** The shortest CRON_SECRET accepted (Vercel suggests a random string of 16+ characters). */
export const MIN_CRON_SECRET_LENGTH = 16;

/** CRON_SECRET when it is long enough, else null (the cron route then answers 404). */
export function cronSecretOf(env: NodeJS.ProcessEnv): string | null {
  const secret = env.CRON_SECRET?.trim();
  return secret && secret.length >= MIN_CRON_SECRET_LENGTH ? secret : null;
}

/**
 * WEB_ORIGIN as an origin (`https://host[:port]`), or the local site off Vercel, or null (browser
 * sessions off). A value that is not a bare https origin fails the boot: a typo would otherwise
 * refuse every browser silently.
 */
export function webOriginOf(env: NodeJS.ProcessEnv): string | null {
  const raw = env.WEB_ORIGIN?.trim();
  if (!raw) {
    return env.VERCEL_ENV ? null : DEV_WEB_ORIGIN;
  }
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  if (!url || url.protocol !== 'https:' || url.origin !== raw.replace(/\/+$/, '')) {
    throw new ConfigError('WEB_ORIGIN must be an https origin without a path, e.g. https://example.com.');
  }
  return url.origin;
}

/**
 * WEB_EDGE_SECRET when it is long enough, else null: then `x-vercel-forwarded-for` is never trusted
 * and website visitors are bucketed by whatever address reaches the API (src/client-ip.ts).
 */
export function webEdgeSecretOf(env: NodeJS.ProcessEnv): string | null {
  const secret = env.WEB_EDGE_SECRET?.trim();
  return secret && secret.length >= MIN_WEB_EDGE_SECRET_LENGTH ? secret : null;
}

/** The API's public base URL, without a trailing slash. */
export function publicUrlOf(env: NodeJS.ProcessEnv): string {
  return (env.API_PUBLIC_URL || `http://localhost:${LOCAL_API_PORT}`).replace(/\/+$/, '');
}

function mailerOf(env: NodeJS.ProcessEnv, override?: Mailer): Mailer {
  if (override) {
    return override;
  }
  const from = env.MAIL_FROM ? parseMailFrom(env.MAIL_FROM) : null;
  // Without Brevo a deployed preview sends nothing (only test-domain sign-ins work): it never logs them.
  return env.BREVO_API_KEY && from ? new BrevoMailer(env.BREVO_API_KEY, from) : nullMailer;
}

export function productionDeps(env: NodeJS.ProcessEnv, overrides: WiringOverrides = {}): ApiDeps {
  checkProductionEnv(env);
  const tokens = parseApiTokens(env.API_TOKENS);
  const db = overrides.db ?? (env.DATABASE_URL ? createNeonDb(env.DATABASE_URL).db : null);
  const secret = env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32 ? env.BETTER_AUTH_SECRET : null;
  const fixedCode = isProduction(env) ? null : env.AUTH_FIXED_CODE?.trim() || null;
  if (fixedCode && !/^\d{6}$/.test(fixedCode)) {
    throw new ConfigError('AUTH_FIXED_CODE must be six digits.');
  }
  const webOrigin = webOriginOf(env);
  const base = defaultDeps({ log: jsonLineLog });
  const mailer = mailerOf(env, overrides.mailer);
  const auth =
    db && secret
      ? createAuth({
          db,
          secret,
          baseURL: publicUrlOf(env),
          mailer,
          fixedCode,
          fixedCodeEmails: overrides.fixedCodeEmails,
          onMailError: () => base.log.event?.({ msg: 'auth.code-not-sent' }),
        })
      : null;
  const identity =
    db && secret && auth
      ? new IdentityService(
          auth,
          new PostgresRateLimiter(db),
          secret,
          base.clock,
          new DrizzleAccountRepository(db),
          new DrizzleSessionStore(db)
        )
      : null;
  const accounts =
    db && secret && auth && identity
      ? accountService({
          db,
          auth,
          identity,
          secret,
          mailer,
          clock: base.clock,
          fixedCode,
          fixedCodeEmails: overrides.fixedCodeEmails,
          log: base.log,
          breached:
            overrides.breached ??
            new HibpBreachedPasswords(fetch, () => base.log.event?.({ msg: 'password.breach-check-skipped' })),
        })
      : null;
  process.stdout.write(
    `${JSON.stringify({
      msg: 'config',
      database: !!db,
      signIn: !!identity,
      mail: mailer !== nullMailer,
      fixedCode: !!fixedCode,
      breachCheck: overrides.breached ? 'fake' : 'hibp',
      cron: !!cronSecretOf(env),
      webOrigin: !!webOrigin,
      webEdge: !!webEdgeSecretOf(env),
      apiTokens: tokens.entries.length,
      apiTokensSkipped: tokens.skipped,
    })}\n`
  );
  const devices = deviceTokenAuth(tokens.entries);
  const grid = new H3CellGrid();
  const store = db ? new DrizzleBackupStore(db, grid) : null;
  return {
    ...base,
    grid,
    auth: identity ? compositeVerifier(devices, identity.verifier) : devices,
    store,
    identity,
    accounts,
    exports:
      db && store
        ? new ExportService(
            store,
            new DrizzleExportStore(db),
            new PostgresFileStorage(db),
            mailer,
            base.clock,
            publicUrlOf(env),
            base.log,
            new DrizzleAccountRepository(db)
          )
        : null,
    retention: db ? new RetentionService(new DrizzleRetentionStore(db), base.clock, base.log) : null,
    cronSecret: cronSecretOf(env),
    webOrigin,
    webEdgeSecret: webEdgeSecretOf(env),
  };
}
