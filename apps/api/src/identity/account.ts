import { displayName, newEmail, newPassword } from '@cityturfer/core/identity';

import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { Principal } from '../deps';
import { isTestEmail } from './better-auth';
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
  /** The stored token of the caller's session: kept when other sessions are revoked (AC5). */
  sessionToken: string;
}

/** The caller as an account, else 403 `identity.account-required` (device tokens have no account). */
export function accountCaller(principal: Principal): AccountCaller {
  const email = principal.profile?.email;
  if (principal.kind !== 'session' || !principal.userId || !principal.sessionToken || !email) {
    throw new AppError('identity.account-required');
  }
  return { userId: principal.userId, email, sessionToken: principal.sessionToken };
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
    keepSessionToken: string;
    at: number;
  }): Promise<'changed' | 'taken'>;
  /** Sets or replaces the password hash and revokes every other session, in one transaction. */
  setPassword(input: {
    userId: string;
    hash: string;
    keepSessionToken: string;
    at: number;
  }): Promise<'set' | 'changed'>;
  /** Removes the password credential; false when there was none. */
  removePassword(userId: string): Promise<boolean>;
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

  /** RequestStepUpCode: mails a code to the current address (A5 code limits). */
  async requestStepUpCode(caller: AccountCaller, ip: string): Promise<void> {
    await this.deps.limits.codeMail(caller.email, ipBucket(ip));
    const code = await this.deps.codes.issue(this.deps.codes.stepUpId(caller.email), this.fixedFor(caller.email));
    await this.send(stepUpCodeMail(caller.email, code), 'code');
  }

  /**
   * RequestEmailChange: spends the step-up code, then mails a code to the new address. When another
   * account already has that address, it gets an "address in use" mail instead and the answer is
   * the same (no enumeration); the confirm step then finds no code (401).
   */
  async requestEmailChange(caller: AccountCaller, rawNewEmail: string, stepUpCode: string, ip: string): Promise<void> {
    const to = newEmail(rawNewEmail, caller.email);
    // The new address's code limits refuse before the step-up code is spent, and count only once a
    // mail goes out (wrong step-up codes do not use up a stranger's quota).
    await this.deps.limits.checkCodeMail(to, ipBucket(ip));
    await this.spendStepUp(caller, stepUpCode, ip);
    await this.deps.limits.codeMail(to, ipBucket(ip));
    if (await this.deps.repo.emailTaken(to, caller.userId)) {
      await this.send(addressInUseMail(to), 'notice');
      return;
    }
    const code = await this.deps.codes.issue(this.deps.codes.emailChangeId(caller.userId, to), this.fixedFor(to));
    await this.send(newAddressCodeMail(to, code), 'code');
  }

  /**
   * ChangeEmail: the code from the new inbox moves the account there (both e-mail columns, one
   * transaction), revokes the other sessions and tells the old address. `409 email.taken` only
   * after the code proved the new inbox (the address was taken after the code was sent).
   */
  async changeEmail(caller: AccountCaller, rawNewEmail: string, code: string, ip: string): Promise<void> {
    const to = newEmail(rawNewEmail, caller.email);
    const attempt = await this.deps.limits.beforeAttempt(caller.email, ipBucket(ip));
    if (!(await this.deps.codes.consume(this.deps.codes.emailChangeId(caller.userId, to), code))) {
      await attempt.failed();
      throw new AppError('auth.invalid-code');
    }
    const at = this.deps.clock.now();
    const result = await this.deps.repo.changeEmail({
      userId: caller.userId,
      from: caller.email,
      to,
      keepSessionToken: caller.sessionToken,
      at,
    });
    if (result === 'taken') {
      throw new AppError('email.taken');
    }
    await this.send(emailChangedMail(caller.email, at), 'notice');
  }

  /**
   * SetPassword: sets or replaces the password (core length rule, then the breach check, then the
   * step-up code: a refused password does not spend the code), revokes the other sessions, mails
   * the account.
   */
  async setPassword(caller: AccountCaller, rawPassword: string, stepUpCode: string, ip: string): Promise<void> {
    const password = newPassword(rawPassword);
    if (await this.deps.breached.isBreached(password)) {
      throw new AppError('password.breached');
    }
    await this.spendStepUp(caller, stepUpCode, ip);
    const hash = await this.deps.hashPassword(password);
    const at = this.deps.clock.now();
    const result = await this.deps.repo.setPassword({
      userId: caller.userId,
      hash,
      keepSessionToken: caller.sessionToken,
      at,
    });
    await this.send(passwordSetMail(caller.email, at, result === 'changed'), 'notice');
  }

  /** RemovePassword: back to codes only; mails the account when there was a password. */
  async removePassword(caller: AccountCaller, stepUpCode: string, ip: string): Promise<void> {
    await this.spendStepUp(caller, stepUpCode, ip);
    if (await this.deps.repo.removePassword(caller.userId)) {
      await this.send(passwordRemovedMail(caller.email, this.deps.clock.now()), 'notice');
    }
  }

  /** The step-up check (AC4): a wrong code counts as a failed sign-in for the account's address. */
  private async spendStepUp(caller: AccountCaller, code: string, ip: string): Promise<void> {
    const attempt = await this.deps.limits.beforeAttempt(caller.email, ipBucket(ip));
    if (!(await this.deps.codes.consume(this.deps.codes.stepUpId(caller.email), code))) {
      await attempt.failed();
      throw new AppError('auth.invalid-code');
    }
  }

  private fixedFor(email: string): string | null {
    return this.deps.fixedCode && isTestEmail(email) ? this.deps.fixedCode : null;
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
