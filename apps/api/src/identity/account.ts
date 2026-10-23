import { displayName, newEmail, newPassword } from '@cityturfer/core/identity';

import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { Principal } from '../deps';
import { isTestEmail, usesFixedCode } from './better-auth';
import type { BreachedPasswords } from './breached-passwords';
import type { OneTimeCodes } from './codes';
import { ipBucket } from './ip-bucket';
import {
  addressInUseMail,
  emailChangedMail,
  type Mailer,
  type MailMessage,
  newAddressCodeMail,
  passwordRemovedMail,
  passwordSetMail,
  stepUpCodeMail,
} from './mailer';
import type { AuthRateLimits } from './rate-limit';

/**
 * Account settings (docs/decisions/account-settings-2026-10-22.md, contract 0.5.0): RenameAccount,
 * RequestStepUpCode, RequestEmailChange, ChangeEmail, SetPassword, RemovePassword, and the
 * credential half of GetCurrentUser. Field rules come from `@cityturfer/core/identity` (their
 * DomainError codes are the problem codes); the step-up check (AC4) is part of each use case, not a
 * middleware. Only signed-in accounts may call them (`accountCaller`).
 *
 * Never logged: names, addresses, codes, passwords, hashes. Mail failures report only their kind.
 */

/** A signed-in account, as the use cases need it. */
export interface AccountCaller {
  userId: string;
  /** The current sign-in address (`auth_users.email`). */
  email: string;
  /**
   * The opaque id of the caller's session (bearer phone or browser cookie): kept when the other
   * sessions are revoked (AC5), the same id `GET /v1/auth/sessions` marks `current`.
   */
  sessionId: string;
}

/** The caller as an account, else 403 `identity.account-required` (device tokens have no account). */
export function accountCaller(principal: Principal): AccountCaller {
  const email = principal.profile?.email;
  if (principal.kind !== 'session' || !principal.userId || !principal.sessionId || !email) {
    throw new AppError('identity.account-required');
  }
  return { userId: principal.userId, email, sessionId: principal.sessionId };
}

/** Port: the account rows (`users`, `auth_users`, `auth_accounts`, `auth_sessions`). */
export interface AccountRepository {
  /** The password credential, or null when the account has none (or is a device-token user). */
  credential(userId: string): Promise<{ changedAt: number } | null>;
  /** `users.display_name` and its mirror `auth_users.name`, in one transaction. */
  rename(userId: string, name: string | null, at: number): Promise<void>;
  /** Does another account sign in with this address? */
  emailTaken(email: string, exceptUserId: string): Promise<boolean>;
  /**
   * One transaction: `auth_users.email` (verified), `users.email`, the pending codes of both
   * addresses and of the user's e-mail changes cleared, every other session revoked.
   */
  changeEmail(input: {
    userId: string;
    from: string;
    to: string;
    keepSessionId: string;
    at: number;
  }): Promise<'changed' | 'taken'>;
  /** Sets or replaces the password hash and revokes every other session, in one transaction. */
  setPassword(input: { userId: string; hash: string; keepSessionId: string; at: number }): Promise<'set' | 'changed'>;
  /**
   * Removes the password credential and revokes every other session, in one transaction (also
   * when there was no password); false when there was none.
   */
  removePassword(input: { userId: string; keepSessionId: string }): Promise<boolean>;
}

export interface AccountServiceDeps {
  repo: AccountRepository;
  codes: OneTimeCodes;
  limits: AuthRateLimits;
  mailer: Mailer;
  breached: BreachedPasswords;
  /** Better Auth's password hasher (scrypt). */
  hashPassword: (password: string) => Promise<string>;
  clock: Clock;
  /** AUTH_FIXED_CODE: the code for TEST_EMAIL_DOMAIN addresses only (never in production). */
  fixedCode?: string | null;
  /** More addresses that get `fixedCode` (the local server's mock accounts). */
  fixedCodeEmails?: readonly string[];
  /** A mail could not be sent; `kind` names the mail, nothing else is passed. */
  onMailError?: (kind: 'code' | 'notice') => void;
}

export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  /** The password half of `GET /v1/me` (works for device-token users too: no credential). */
  async credential(userId: string): Promise<{ hasPassword: boolean; passwordChangedAt: number | null }> {
    const found = await this.deps.repo.credential(userId);
    return { hasPassword: found !== null, passwordChangedAt: found?.changedAt ?? null };
  }

  /** RenameAccount: the core rule; a blank name clears it (the UIs show "You"). */
  async rename(caller: AccountCaller, raw: string): Promise<void> {
    await this.deps.repo.rename(caller.userId, displayName(raw), this.deps.clock.now());
  }

  /**
   * RequestStepUpCode: mails a code to the current address. Its limits are the account's (user id,
   * `stepUpMail`), not the address's sign-in buckets, so a stranger who fills those cannot stop the
   * owner from evicting a stolen session; a step-up code may follow the sign-in code at once.
   */
  async requestStepUpCode(caller: AccountCaller, ip: string): Promise<void> {
    await this.deps.limits.stepUpMail(caller.userId, ipBucket(ip));
    const code = await this.deps.codes.issue(this.deps.codes.stepUpId(caller.email), this.fixedFor(caller.email));
    await this.send(stepUpCodeMail(caller.email, code), 'code');
  }

  /**
   * RequestEmailChange: spends the step-up code, then mails a code to the new address. When another
   * account already has that address, it gets an "address in use" mail instead and the answer is
   * the same (no enumeration); the confirm step then finds no code (401). Both paths do the same
   * database work (a code is issued and, for a taken address, discarded at once), so the answer
   * time does not tell either.
   */
  async requestEmailChange(caller: AccountCaller, rawNewEmail: string, stepUpCode: string, ip: string): Promise<void> {
    const to = newEmail(rawNewEmail, caller.email);
    // The new address's code limits refuse before the step-up code is spent, and count only once a
    // mail goes out (wrong step-up codes do not use up a stranger's quota). Known race, accepted: a
    // concurrent request for the same address can fill its bucket between the peek and the count,
    // so this request spends its step-up code and still answers 429 (the user asks for a new code).
    await this.deps.limits.checkCodeMail(to, ipBucket(ip));
    await this.spendStepUp(caller, stepUpCode, ip);
    await this.deps.limits.codeMail(to, ipBucket(ip));
    const taken = await this.deps.repo.emailTaken(to, caller.userId);
    const identifier = this.deps.codes.emailChangeId(caller.userId, to);
    const code = await this.deps.codes.issue(identifier, this.fixedFor(to));
    if (taken) {
      // Never mailed: discarded, so the confirm step answers 401 as for any wrong code.
      await this.deps.codes.discard(identifier);
      await this.send(addressInUseMail(to), 'notice');
      return;
    }
    await this.send(newAddressCodeMail(to, code), 'code');
  }

  /**
   * ChangeEmail: the code from the new inbox moves the account there (both e-mail columns, one
   * transaction), revokes the other sessions and tells the old address. `409 email.taken` only
   * after the code proved the new inbox (the address was taken after the code was sent).
   */
  async changeEmail(caller: AccountCaller, rawNewEmail: string, code: string, ip: string): Promise<void> {
    const to = newEmail(rawNewEmail, caller.email);
    const attempt = await this.deps.limits.beforeAccountCode(caller.userId, ipBucket(ip));
    if (!(await this.deps.codes.consume(this.deps.codes.emailChangeId(caller.userId, to), code))) {
      await attempt.failed();
      throw new AppError('auth.invalid-code');
    }
    const at = this.deps.clock.now();
    const result = await this.deps.repo.changeEmail({
      userId: caller.userId,
      from: caller.email,
      to,
      keepSessionId: caller.sessionId,
      at,
    });
    if (result === 'taken') {
      throw new AppError('email.taken');
    }
    await this.send(emailChangedMail(caller.email, at), 'notice');
  }

  /**
   * SetPassword: sets or replaces the password (core length rule, then the account's failed-code
   * caps, then the breach check, then the step-up code: a refused password does not spend the
   * code), revokes the other sessions, mails the account. A locked-out caller gets 429 before any
   * outbound call, and breach checks are capped per account (A5 `breachChecksPerUser`).
   */
  async setPassword(caller: AccountCaller, rawPassword: string, stepUpCode: string, ip: string): Promise<void> {
    const password = newPassword(rawPassword);
    const attempt = await this.deps.limits.beforeAccountCode(caller.userId, ipBucket(ip));
    await this.deps.limits.breachCheck(caller.userId);
    if (await this.deps.breached.isBreached(password)) {
      throw new AppError('password.breached');
    }
    await this.spendStepUp(caller, stepUpCode, ip, attempt);
    const hash = await this.deps.hashPassword(password);
    const at = this.deps.clock.now();
    const result = await this.deps.repo.setPassword({
      userId: caller.userId,
      hash,
      keepSessionId: caller.sessionId,
      at,
    });
    await this.send(passwordSetMail(caller.email, at, result === 'changed'), 'notice');
  }

  /**
   * RemovePassword: back to codes only, and every other session is signed out (as after setting
   * or changing it: the password-set notice tells a victim to remove it, which must evict the
   * intruder); mails the account when there was a password.
   */
  async removePassword(caller: AccountCaller, stepUpCode: string, ip: string): Promise<void> {
    await this.spendStepUp(caller, stepUpCode, ip);
    if (await this.deps.repo.removePassword({ userId: caller.userId, keepSessionId: caller.sessionId })) {
      await this.send(passwordRemovedMail(caller.email, this.deps.clock.now()), 'notice');
    }
  }

  /**
   * The step-up check (AC4): a wrong code counts in the account's failed-code buckets (user id and
   * IP), not the address's sign-in buckets.
   */
  private async spendStepUp(
    caller: AccountCaller,
    code: string,
    ip: string,
    checked?: { failed: () => Promise<void> }
  ): Promise<void> {
    const attempt = checked ?? (await this.deps.limits.beforeAccountCode(caller.userId, ipBucket(ip)));
    if (!(await this.deps.codes.consume(this.deps.codes.stepUpId(caller.email), code))) {
      await attempt.failed();
      throw new AppError('auth.invalid-code');
    }
  }

  private fixedFor(email: string): string | null {
    return this.deps.fixedCode && usesFixedCode(email, this.deps.fixedCodeEmails) ? this.deps.fixedCode : null;
  }

  /** Mails after the change is committed; a failure is reported by kind and never fails the request. */
  private async send(message: MailMessage, kind: 'code' | 'notice'): Promise<void> {
    if (isTestEmail(message.to)) {
      return; // Nobody reads mail at the reserved test domain.
    }
    try {
      await this.deps.mailer.send(message);
    } catch {
      this.deps.onMailError?.(kind);
    }
  }
}
