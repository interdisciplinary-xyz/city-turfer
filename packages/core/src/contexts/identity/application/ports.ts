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

/** Port: does a local profile hold any activities (whose history a first sign-in may adopt)? */
export interface ProfileHistory {
  hasActivities(profileId: UserId): Promise<boolean>;
}
