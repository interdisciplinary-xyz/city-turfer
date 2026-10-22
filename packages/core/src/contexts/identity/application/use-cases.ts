import { DomainError } from '../../../shared-kernel';
import { type AccountProfileEntry, AccountProfiles, ADOPTABLE_PROFILE } from '../domain/account-profiles';
import { type Email, email as parseEmail, type User, type UserId, userId } from '../domain/user';
import type {
  AccountFailure,
  AccountGateway,
  AccountProfileStore,
  AccountSession,
  AuthGateway,
  CredentialStore,
  ProfileHistory,
  ProfileNameStore,
  SessionStore,
  SignInOutcome,
} from './ports';

/** Real accounts (email one-time codes). Omitted: only the local profiles can sign in. */
export interface AccountDeps {
  gateway: AccountGateway;
  credentials: CredentialStore;
  profiles: AccountProfileStore;
  history: ProfileHistory;
}

export interface IdentityDeps {
  auth: AuthGateway;
  sessions: SessionStore;
  accounts?: AccountDeps;
  /** Names shown on this phone (local profiles' own, accounts' cached). Omitted: no names kept here. */
  names?: ProfileNameStore;
}

export function emailOf(raw: string): Email | null {
  try {
    return parseEmail(raw);
  } catch (e) {
    if (e instanceof DomainError) {
      return null;
    }
    throw e;
  }
}

export const userOf = (e: AccountProfileEntry): User => ({
  id: e.profileId,
  email: e.email,
  displayName: e.email.split('@')[0],
  accountId: e.accountId,
});

/** The user with the name kept on this phone, when there is one (a failed read keeps the user as is). */
export async function withName(d: IdentityDeps, user: User): Promise<User> {
  const name = d.names ? await d.names.read(user.id).catch(() => undefined) : undefined;
  return name === undefined ? user : { ...user, name };
}

export async function loadProfiles(a: AccountDeps): Promise<AccountProfiles> {
  const state = await a.profiles.read();
  return state ? AccountProfiles.rehydrate(state) : AccountProfiles.empty();
}

/**
 * A verified session waiting for the "use this phone's history?" answer. In memory only: the token
 * reaches the keychain once a profile is chosen (killed meanwhile: sign in again).
 */
export class PendingSignIn {
  session: AccountSession | null = null;
}

/** Keeps the session, links the account to the profile, remembers it, and signs that profile in. */
async function enterProfile(
  d: IdentityDeps,
  a: AccountDeps,
  profiles: AccountProfiles,
  session: AccountSession,
  profileId: UserId
): Promise<User> {
  const account = session.account;
  profiles.link(account, profileId);
  await a.credentials.save(session);
  await a.profiles.write(profiles.toState());
  await d.sessions.write(profileId);
  return withName(d, userOf(profiles.current!));
}

/**
 * A verified session (code or password): into the account's profile, or — on the first real
 * sign-in on a phone whose local history is unclaimed — held in `pending` until the Turfer answers.
 */
async function placeSession(
  d: IdentityDeps,
  a: AccountDeps,
  pending: PendingSignIn,
  session: AccountSession
): Promise<{ kind: 'signed-in'; user: User } | { kind: 'choose-history'; email: string }> {
  const { account } = session;
  pending.session = null;
  const profiles = await loadProfiles(a);
  const placement = profiles.knownProfile(account)
    ? profiles.placementFor(account, false)
    : profiles.placementFor(account, await a.history.hasActivities(userId(ADOPTABLE_PROFILE)));
  if (placement.kind === 'ask') {
    pending.session = session;
    return { kind: 'choose-history', email: account.email };
  }
  return { kind: 'signed-in', user: await enterProfile(d, a, profiles, session, placement.profileId) };
}

export type SignInResult =
  | SignInOutcome
  | { kind: 'invalid-email' }
  /** The local profile now holds a CityTurfer account's data: sign in with that account's email. */
  | { kind: 'linked-to-account' };

/**
 * Signs a local profile in with its password (the mock admin and demo accounts), unless an account
 * has adopted that profile: then only the account's own sign-in opens it.
 */
export class SignIn {
  constructor(private readonly d: IdentityDeps) {}
  async execute(rawEmail: string, password: string): Promise<SignInResult> {
    const parsed = emailOf(rawEmail);
    if (!parsed) {
      return { kind: 'invalid-email' };
    }
    const outcome = await this.d.auth.signIn(parsed, password);
    if (outcome.kind !== 'signed-in') {
      return outcome;
    }
    if (this.d.accounts && !(await loadProfiles(this.d.accounts)).opensWithPassword(outcome.user.id)) {
      return { kind: 'linked-to-account' };
    }
    await this.d.sessions.write(outcome.user.id);
    return { kind: 'signed-in', user: await withName(this.d, outcome.user) };
  }
}

export type StartSignInResult =
  | { kind: 'password' }
  | { kind: 'code-sent' }
  | { kind: 'invalid-email' }
  | { kind: 'accounts-unavailable' }
  | AccountFailure;

/**
 * First step of signing in: a local profile's email asks for its password; any other email gets a
 * one-time code by email (the server answers the same for unknown emails).
 */
export class StartSignIn {
  constructor(private readonly d: IdentityDeps) {}
  async execute(rawEmail: string): Promise<StartSignInResult> {
    const parsed = emailOf(rawEmail);
    if (!parsed) {
      return { kind: 'invalid-email' };
    }
    if (this.d.auth.hasLocalAccount?.(parsed)) {
      return { kind: 'password' };
    }
    if (!this.d.accounts) {
      return { kind: 'accounts-unavailable' };
    }
    const r = await this.d.accounts.gateway.requestCode(parsed);
    return r.kind === 'sent' ? { kind: 'code-sent' } : r;
  }
}

export type VerifySignInResult =
  | { kind: 'signed-in'; user: User }
  /** This phone has a local history nobody claimed: ask before linking it (ChooseHistory). */
  | { kind: 'choose-history'; email: string }
  | { kind: 'invalid-email' }
  | { kind: 'invalid-code' }
  | { kind: 'accounts-unavailable' }
  | AccountFailure;

/**
 * Second step: the code from the email. Keeps the session (token + account) in the keychain, then
 * signs the account into its profile — or, on the first real sign-in on a phone whose local
 * history is unclaimed, asks first.
 */
export class VerifySignInCode {
  constructor(
    private readonly d: IdentityDeps,
    private readonly pending: PendingSignIn
  ) {}
  async execute(rawEmail: string, rawCode: string): Promise<VerifySignInResult> {
    const a = this.d.accounts;
    if (!a) {
      return { kind: 'accounts-unavailable' };
    }
    const parsed = emailOf(rawEmail);
    if (!parsed) {
      return { kind: 'invalid-email' };
    }
    const code = rawCode.replace(/\s+/g, '');
    if (!code) {
      return { kind: 'invalid-code' };
    }
    const r = await a.gateway.verifyCode(parsed, code);
    return r.kind === 'verified' ? placeSession(this.d, a, this.pending, r.session) : r;
  }
}

export type PasswordSignInResult =
  | Exclude<VerifySignInResult, { kind: 'invalid-code' }>
  | { kind: 'invalid-credentials' }
  /** A local profile's email whose history an account has adopted (see SignIn). */
  | { kind: 'linked-to-account' };

/**
 * Signing in with an account password instead of the e-mailed code. Goes on exactly like a
 * verified code (same profile placement, same "use this phone's history?"). A local profile's
 * email (mock admin, demo) signs in with its own password, as SignIn does.
 */
export class SignInWithPassword {
  constructor(
    private readonly d: IdentityDeps,
    private readonly pending: PendingSignIn
  ) {}
  async execute(rawEmail: string, password: string): Promise<PasswordSignInResult> {
    const parsed = emailOf(rawEmail);
    if (!parsed) {
      return { kind: 'invalid-email' };
    }
    if (this.d.auth.hasLocalAccount?.(parsed)) {
      return new SignIn(this.d).execute(rawEmail, password);
    }
    const a = this.d.accounts;
    if (!a) {
      return { kind: 'accounts-unavailable' };
    }
    if (!password) {
      return { kind: 'invalid-credentials' };
    }
    const r = await a.gateway.signInWithPassword(parsed, password);
    return r.kind === 'verified' ? placeSession(this.d, a, this.pending, r.session) : r;
  }
}

/**
 * The answer to "use this phone's history with your account?": yes links the account to the local
 * history (no copy: the same database), no gives the account a profile of its own.
 */
export class ChooseHistory {
  constructor(
    private readonly d: IdentityDeps,
    private readonly pending: PendingSignIn
  ) {}
  async execute(useThisPhonesHistory: boolean): Promise<{ kind: 'signed-in'; user: User } | { kind: 'no-pending' }> {
    const a = this.d.accounts;
    const session = this.pending.session;
    if (!a || !session) {
      return { kind: 'no-pending' };
    }
    this.pending.session = null;
    const profiles = await loadProfiles(a);
    const profileId = profiles.chosenProfile(session.account, useThisPhonesHistory);
    return { kind: 'signed-in', user: await enterProfile(this.d, a, profiles, session, profileId) };
  }
}

/**
 * Who is signed in, without the network and without reading the keychain's token (the app may be
 * started while the phone is locked): the account profile from the profile map, or a local profile.
 */
export class GetCurrentUser {
  constructor(private readonly d: IdentityDeps) {}
  async execute(): Promise<User | null> {
    const id = await this.d.sessions.read();
    if (!id) {
      return null;
    }
    const current = this.d.accounts ? (await loadProfiles(this.d.accounts)).current : null;
    if (current?.profileId === id) {
      return withName(this.d, userOf(current));
    }
    const user = await this.d.auth.userById(id);
    return user ? withName(this.d, user) : null;
  }
}

/**
 * The signed-in account's bearer token for a profile (Cloud Backup), or null when that profile has
 * no account signed in. Foreground only: the token is only readable while the phone is unlocked.
 */
export class AccountBearer {
  constructor(private readonly d: IdentityDeps) {}
  async execute(profileId: string): Promise<{ token: string; accountId: string } | null> {
    const a = this.d.accounts;
    if (!a) {
      return null;
    }
    const current = (await loadProfiles(a)).current;
    if (current?.profileId !== profileId) {
      return null;
    }
    const session = await a.credentials.read();
    return session && session.account.id === current.accountId
      ? { token: session.token, accountId: session.account.id }
      : null;
  }
}

export type SignOutResult = { kind: 'signed-out' } | { kind: 'recording-in-progress' };

/**
 * Signs out (never during a recording). A signed-in account's session is revoked on the server
 * (best effort: offline, it simply expires) and its token forgotten; the data stays on the phone.
 */
export class SignOut {
  constructor(
    private readonly d: IdentityDeps,
    private readonly isRecording: () => Promise<boolean>
  ) {}
  async execute(): Promise<SignOutResult> {
    if (await this.isRecording()) {
      return { kind: 'recording-in-progress' };
    }
    const a = this.d.accounts;
    if (a) {
      const session = await a.credentials.read().catch(() => null);
      if (session) {
        await a.gateway.revoke(session.token).catch(() => null);
      }
      await a.credentials.clear();
      const profiles = await loadProfiles(a);
      profiles.signedOut();
      await a.profiles.write(profiles.toState());
    }
    await this.d.sessions.clear();
    return { kind: 'signed-out' };
  }
}

export type DeleteAccountResult =
  /** Signed out. `profileId`: the profile that held the account's data here (null: none). */
  | { kind: 'deleted'; profileId: UserId | null }
  | { kind: 'recording-in-progress' }
  | { kind: 'not-signed-in' }
  | AccountFailure;

/**
 * Deletes the signed-in account and all its data on the server, then signs out. `keepData`: the
 * profile stays on this phone (found again when signing in with the same email); otherwise the
 * caller deletes its database.
 */
export class DeleteAccount {
  constructor(
    private readonly d: IdentityDeps,
    private readonly isRecording: () => Promise<boolean>
  ) {}
  async execute(keepData: boolean): Promise<DeleteAccountResult> {
    const a = this.d.accounts;
    const session = a ? await a.credentials.read() : null;
    if (!a || !session) {
      return { kind: 'not-signed-in' };
    }
    if (await this.isRecording()) {
      return { kind: 'recording-in-progress' };
    }
    // Resolved before the server call: once the account is gone, this phone signs out regardless.
    const profiles = await loadProfiles(a);
    const signedIn = await this.d.sessions.read().catch(() => null);
    const profileId = profiles.profileForDeletion(session.account.id, signedIn);
    const r = await a.gateway.deleteAccount(session.token);
    if (r.kind !== 'deleted') {
      // Offline, failed, or 401 (the session expired: sign in again first). Nothing changes here,
      // and this phone's data is never deleted on an answer that doesn't say the account is gone.
      return r;
    }
    profiles.accountDeleted(session.account.id, keepData);
    await a.profiles.write(profiles.toState());
    await a.credentials.clear();
    await this.d.sessions.clear();
    return { kind: 'deleted', profileId };
  }
}

/** "Export my data": the server builds a zip and emails a download link. */
export class RequestDataExport {
  constructor(private readonly d: IdentityDeps) {}
  async execute(): Promise<{ kind: 'requested' } | { kind: 'no-email' } | { kind: 'not-signed-in' } | AccountFailure> {
    const a = this.d.accounts;
    const session = a ? await a.credentials.read() : null;
    if (!a || !session) {
      return { kind: 'not-signed-in' };
    }
    return a.gateway.requestExport(session.token);
  }
}
