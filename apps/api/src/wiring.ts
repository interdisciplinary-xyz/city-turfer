import { deviceTokenAuth, parseApiTokens } from './auth/device-tokens';
import { DrizzleExportStore, PostgresFileStorage } from './db/exports';
import { createNeonDb } from './db/neon';
import { PostgresRateLimiter } from './db/rate-limits';
import { type Db, DrizzleBackupStore } from './db/store';
import { type ApiDeps, defaultDeps, jsonLineLog } from './deps';
import { createAuth } from './identity/better-auth';
import { BrevoMailer, type Mailer, nullMailer, parseMailFrom } from './identity/mailer';
import { compositeVerifier, IdentityService } from './identity/use-cases';
import { ExportService } from './privacy/use-cases';
import { LOCAL_API_PORT } from './spec';

/**
 * Production wiring from environment variables (Vercel → Settings → Environment Variables;
 * runbook: docs/operations/api-deploy.md):
 * - `DATABASE_URL`: Neon pooled connection string (missing → live data routes answer 503).
 * - `API_TOKENS`: JSON object sha256(token) hex → userId (device tokens, one more release).
 * - `BETTER_AUTH_SECRET` (≥ 32 characters): turns on sign-in with e-mailed codes.
 * - `BREVO_API_KEY` + `MAIL_FROM` (`CityTurfer <hello@…>`): sends the codes and export links.
 * - `API_PUBLIC_URL`: the API's public base URL (export links in e-mails).
 * - `AUTH_FIXED_CODE`: every code is this one — never in production (boot fails).
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
  if (problems.length > 0) {
    throw new ConfigError(`Production configuration: ${problems.join('; ')}.`);
  }
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
  // Without Brevo a deployed preview sends nothing (codes only via AUTH_FIXED_CODE): it never logs them.
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
  const base = defaultDeps({ log: jsonLineLog });
  const mailer = mailerOf(env, overrides.mailer);
  const identity =
    db && secret
      ? new IdentityService(
          createAuth({ db, secret, baseURL: publicUrlOf(env), mailer, fixedCode }),
          new PostgresRateLimiter(db),
          secret,
          base.clock,
          base.log
        )
      : null;
  process.stdout.write(
    `${JSON.stringify({
      msg: 'config',
      database: !!db,
      signIn: !!identity,
      mail: mailer !== nullMailer,
      fixedCode: !!fixedCode,
      apiTokens: tokens.entries.length,
      apiTokensSkipped: tokens.skipped,
    })}\n`
  );
  const devices = deviceTokenAuth(tokens.entries);
  const store = db ? new DrizzleBackupStore(db) : null;
  return {
    ...base,
    auth: identity ? compositeVerifier(devices, identity.verifier) : devices,
    store,
    identity,
    exports:
      db && store
        ? new ExportService(
            store,
            new DrizzleExportStore(db),
            new PostgresFileStorage(db),
            mailer,
            base.clock,
            publicUrlOf(env),
            base.log
          )
        : null,
  };
}
