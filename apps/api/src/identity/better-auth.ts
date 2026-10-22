import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { bearer } from 'better-auth/plugins/bearer';
import { emailOTP } from 'better-auth/plugins/email-otp';

import { authAccounts, authSessions, authUsers, authVerifications } from '../db/schema';
import type { Db } from '../db/store';
import { type Mailer, signInCodeMail } from './mailer';

/**
 * Better Auth for sign-in with an e-mailed one-time code (docs/decisions/api-accounts-2026-10-22.md).
 * Used only through `auth.api.*` from our own zod-openapi routes (src/routes/identity.ts), never
 * `auth.handler`: the spec stays generated, errors stay problem+json, and Better Auth's own routes
 * (password, OAuth, …) are not reachable. Its rate limiter only runs inside `auth.handler`, so the
 * limits live in IdentityService. No telemetry, no logger (its messages can hold e-mail addresses),
 * no IP or user agent on sessions.
 */

/** Sessions last 60 days and slide: a session used after a day gets 60 more. */
export const SESSION_TTL_S = 60 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_S = 24 * 60 * 60;
export const CODE_TTL_S = 10 * 60;

export interface AuthConfig {
  db: Db;
  /**
   * BETTER_AUTH_SECRET: signs the bearer tokens and keys the rate-limit HMACs (≥ 32 characters).
   * Rotating it signs everyone out and resets the rate-limit counters.
   */
  secret: string;
  /** Public base URL of the API (Better Auth wants one; no callbacks are used). */
  baseURL: string;
  mailer: Mailer;
  /**
   * AUTH_FIXED_CODE: the code for addresses at TEST_EMAIL_DOMAIN only (outside production; the
   * wiring refuses it there). Real addresses always get random codes, so a preview or a local server
   * that points at a real database cannot be used to sign in as anyone.
   */
  fixedCode?: string | null;
  /** Called when the mailer throws (Better Auth swallows it): no address or code is passed. */
  onMailError?: () => void;
}

/** Reserved for Maestro and local tests: `.test` is never a real TLD (RFC 2606). */
export const TEST_EMAIL_DOMAIN = 'e2e.cityturfer.test';

export const isTestEmail = (email: string) => email.toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`);

export function createAuth(config: AuthConfig) {
  return betterAuth({
    appName: 'CityTurfer',
    secret: config.secret,
    baseURL: config.baseURL,
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema: {
        auth_users: authUsers,
        auth_sessions: authSessions,
        auth_accounts: authAccounts,
        auth_verifications: authVerifications,
      },
    }),
    user: { modelName: 'auth_users' },
    session: { modelName: 'auth_sessions', expiresIn: SESSION_TTL_S, updateAge: SESSION_UPDATE_AGE_S },
    account: { modelName: 'auth_accounts' },
    verification: { modelName: 'auth_verifications' },
    emailAndPassword: { enabled: false },
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    logger: { disabled: true },
    advanced: { ipAddress: { disableIpTracking: true } },
    plugins: [
      // Only signed tokens (`<session token>.<HMAC>`, see IdentityService.signIn): the raw token in
      // `auth_sessions` is not enough to sign in, and rotating BETTER_AUTH_SECRET revokes them all.
      bearer({ requireSignature: true }),
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_TTL_S,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        generateOTP: ({ email }) => (config.fixedCode && isTestEmail(email) ? config.fixedCode : undefined),
        sendVerificationOTP: async ({ email, otp }) => {
          if (isTestEmail(email)) {
            return; // Nobody reads mail at the reserved test domain.
          }
          try {
            await config.mailer.send(signInCodeMail(email, otp));
          } catch {
            config.onMailError?.();
          }
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
