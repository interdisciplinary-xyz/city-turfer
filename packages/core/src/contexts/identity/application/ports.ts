import type { AccountFieldError } from '../domain/account-fields';
import type { Account, AccountProfilesState } from '../domain/account-profiles';
import type { Email, User, UserId } from '../domain/user';

export type SignInOutcome = { kind: 'signed-in'; user: User } | { kind: 'invalid-credentials' };

/** Port: the local profiles signed in with a password (the PoC's mock accounts). */
export interface AuthGateway {
  signIn(email: Email, password: string): Promise<SignInOutcome>;
  userById(id: UserId): Promise<User | null>;
  /** This email is a local profile (password), not a CityTurfer account (one-time code). */
  hasLocalAccount?(email: Email): boolean;
}

/** Persists which local profile is signed in, readable by the headless background task. */
export interface SessionStore {
  read(): Promise<UserId | null>;
  write(id: UserId): Promise<void>;
  clear(): Promise<void>;
}

/** A signed-in account's session: the bearer token (secret) and whose it is. */
export interface AccountSession {
  token: string;
  /** Epoch ms. */
  expiresAt: number;
  account: Account;
}

/** Why a request to the account server failed, in Identity's terms. */
export type AccountFailure =
  | { kind: 'offline' }
  | { kind: 'unavailable' }
  | { kind: 'auth' }
  | { kind: 'rate-limited'; retryAfterS: number | null };

/** The server refused a field with one of the shared rules (`@cityturfer/core/identity` account fields). */
export type FieldRefused = { kind: 'field-error'; code: AccountFieldError };

/** The signed-in account as the server has it (`GET /v1/me`). */
export interface AccountDetails {
  readonly id: string;
  readonly email: string;
  /** Null: no name chosen (the UIs show "You"). */
  readonly name: string | null;
  readonly hasPassword: boolean;
  /** Epoch ms; null when no password is set (or the server doesn't say). */
  readonly passwordChangedAt: number | null;
}

/** Port: CityTurfer accounts on the server (email one-time codes, sessions, account data). */
export interface AccountGateway {
  /** Always "sent" for a valid email, also for unknown ones (the account is created on first sign-in). */
  requestCode(email: Email): Promise<{ kind: 'sent' } | { kind: 'invalid-email' } | AccountFailure>;
  verifyCode(
    email: Email,
    code: string
  ): Promise<{ kind: 'verified'; session: AccountSession } | { kind: 'invalid-code' } | AccountFailure>;
  /** Revokes the session on the server. */
  revoke(token: string): Promise<{ kind: 'revoked' } | AccountFailure>;
  /** Deletes the account and all its data on the server. */
  deleteAccount(token: string): Promise<{ kind: 'deleted' } | AccountFailure>;
  /**
   * Asks the server to email a download link to the account's data (one per 24 h: rate-limited).
   * `no-email`: the account has no email to send it to (a device-token user).
   */
  requestExport(token: string): Promise<{ kind: 'requested' } | { kind: 'no-email' } | AccountFailure>;

  // --- Account settings (contract 0.5.0, docs/decisions/account-settings-2026-10-22.md) ---------

  /** The account's name, e-mail and password state. */
  fetchMe(token: string): Promise<{ kind: 'me'; me: AccountDetails } | AccountFailure>;
  /** A null name clears it. Answers the name the server kept. */
  updateName(
    token: string,
    name: string | null
  ): Promise<{ kind: 'saved'; name: string | null } | FieldRefused | AccountFailure>;
  /** Mails a fresh code to the account's current address (step-up before a sensitive change). */
  requestStepUpCode(token: string): Promise<{ kind: 'sent' } | AccountFailure>;
  /** Spends the step-up code and mails a code to the new address. */
  requestEmailChange(
    token: string,
    newEmail: string,
    stepUpCode: string
  ): Promise<{ kind: 'sent' } | { kind: 'invalid-code' } | FieldRefused | AccountFailure>;
  /** The code from the new inbox. `email-taken`: another account has that address. */
  confirmEmailChange(
    token: string,
    newEmail: string,
    code: string
  ): Promise<
    | { kind: 'changed'; email: string }
    | { kind: 'invalid-code' }
    | { kind: 'email-taken' }
    | FieldRefused
    | AccountFailure
  >;
  /** Sets or replaces the account password. `breached`: found in known data breaches. */
  setPassword(
    token: string,
    newPassword: string,
    stepUpCode: string
  ): Promise<{ kind: 'saved' } | { kind: 'invalid-code' } | { kind: 'breached' } | FieldRefused | AccountFailure>;
  removePassword(
    token: string,
    stepUpCode: string
  ): Promise<{ kind: 'removed' } | { kind: 'invalid-code' } | AccountFailure>;
  /** The password sign-in (an alternative to the code). Wrong password, none set, no account: all `invalid-credentials`. */
  signInWithPassword(
    email: Email,
    password: string
  ): Promise<{ kind: 'verified'; session: AccountSession } | { kind: 'invalid-credentials' } | AccountFailure>;
}

/** Port: the signed-in account's session in the keychain (only readable while the phone is unlocked). */
export interface CredentialStore {
  read(): Promise<AccountSession | null>;
  save(session: AccountSession): Promise<void>;
  clear(): Promise<void>;
}

/** Port: accounts ↔ local profiles (no secrets; readable while locked, so the app starts offline). */
export interface AccountProfileStore {
  read(): Promise<AccountProfilesState | null>;
  write(state: AccountProfilesState): Promise<void>;
}

/**
 * Port: the name shown for a profile on this phone. For a local profile (mock admin, demo) it is
 * the only copy; for an account's profile, a cache of the server's name so it shows offline.
 * `undefined`: never set here.
 */
export interface ProfileNameStore {
  read(profileId: UserId): Promise<string | null | undefined>;
  write(profileId: UserId, name: string | null): Promise<void>;
}

/** Port: does a local profile hold any activities (whose history a first sign-in may adopt)? */
export interface ProfileHistory {
  hasActivities(profileId: UserId): Promise<boolean>;
}
