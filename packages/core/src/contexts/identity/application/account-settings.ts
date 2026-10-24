import {
  type AccountFieldError,
  accountFieldError,
  displayName,
  newEmail as parseNewEmail,
  newPassword as parseNewPassword,
} from '../domain/account-fields';
import type { AccountProfileEntry, AccountProfiles } from '../domain/account-profiles';
import type { User } from '../domain/user';
import type { AccountFailure, AccountSession, FieldRefused } from './ports';
import { type AccountDeps, GetCurrentUser, type IdentityDeps, loadProfiles } from './use-cases';

/**
 * Account settings (docs/decisions/account-settings-2026-10-22.md): name, e-mail and an optional
 * password. Online only: nothing is queued. Field rules are checked here first (the same rules as
 * the server's), so a wrong value never reaches the network.
 */

/** No account is signed in on this profile (a local profile, or the keychain lost the session). */
export type NotSignedIn = { kind: 'not-signed-in' };

export type AccountSettings =
  /** A local profile (mock admin, demo): only the name, kept on this phone. */
  | { kind: 'local'; name: string | null }
  | {
      kind: 'account';
      email: string;
      name: string | null;
      hasPassword: boolean;
      /** Epoch ms, or null. */
      passwordChangedAt: number | null;
    };

interface SignedInAccount {
  a: AccountDeps;
  session: AccountSession;
  profiles: AccountProfiles;
  entry: AccountProfileEntry;
}

type Place = { kind: 'account'; at: SignedInAccount } | { kind: 'local'; profileId: User['id'] } | NotSignedIn;

/** Where the signed-in profile stands: an account with its session, a local profile, or neither. */
async function place(d: IdentityDeps): Promise<Place> {
  const signedIn = await d.sessions.read();
  if (!signedIn) {
    return { kind: 'not-signed-in' };
  }
  const a = d.accounts;
  const profiles = a ? await loadProfiles(a) : null;
  const entry = profiles?.current ?? null;
  if (!a || !profiles || !entry || entry.profileId !== signedIn) {
    return { kind: 'local', profileId: signedIn };
  }
  const session = await a.credentials.read();
  return session && session.account.id === entry.accountId
    ? { kind: 'account', at: { a, session, profiles, entry } }
    : { kind: 'not-signed-in' };
}

async function signedInAccount(d: IdentityDeps): Promise<SignedInAccount | null> {
  const p = await place(d);
  return p.kind === 'account' ? p.at : null;
}

/** Runs a field rule; its error as the server would answer it. */
function field<T>(rule: () => T): { ok: T } | FieldRefused {
  try {
    return { ok: rule() };
  } catch (e) {
    const code: AccountFieldError | null = accountFieldError(e);
    if (code) {
      return { kind: 'field-error', code };
    }
    throw e;
  }
}

const codeOf = (raw: string) => raw.replace(/\s+/g, '');

/**
 * Keeps the account's e-mail in step on this phone: the profile map and the stored session. The
 * stores are read again right before writing (a request may have run in between): when nobody is
 * signed in any more, or another account is, nothing is written, so a sign-out during the request
 * never puts the old session back into the keychain.
 */
async function followEmail(d: IdentityDeps, before: SignedInAccount, email: string): Promise<void> {
  const at = await signedInAccount(d);
  if (
    !at ||
    at.entry.accountId !== before.entry.accountId ||
    at.entry.profileId !== before.entry.profileId ||
    at.session.account.id !== before.session.account.id
  ) {
    return;
  }
  if (email === at.entry.email && email === at.session.account.email) {
    return;
  }
  at.profiles.emailChanged(at.entry.accountId, email);
  await at.a.profiles.write(at.profiles.toState());
  await at.a.credentials.save({ ...at.session, account: { ...at.session.account, email } });
}

/**
 * Caches the account's name for offline display (best effort: the server holds the real one). A
 * server without a name over a phone that keeps none writes nothing: both show the same, and a
 * linked local profile keeps its default name (accountUser).
 */
async function cacheName(d: IdentityDeps, at: SignedInAccount, name: string | null): Promise<void> {
  const names = d.names;
  if (!names) {
    return;
  }
  if (name === null && (await names.read(at.entry.profileId).catch(() => undefined)) === undefined) {
    return;
  }
  await names.write(at.entry.profileId, name).catch(() => undefined);
}

/**
 * What Me › Account shows. For an account: asks the server (and refreshes the cached name and, if
 * it changed elsewhere, the e-mail); offline it answers `offline` and the screen shows what it has.
 */
export class GetAccountSettings {
  constructor(private readonly d: IdentityDeps) {}
  async execute(): Promise<AccountSettings | NotSignedIn | AccountFailure> {
    const p = await place(this.d);
    if (p.kind === 'not-signed-in') {
      return p;
    }
    if (p.kind === 'local') {
      const user = await new GetCurrentUser(this.d).execute();
      return { kind: 'local', name: user?.name ?? null };
    }
    const r = await p.at.a.gateway.fetchMe(p.at.session.token);
    if (r.kind !== 'me') {
      return r;
    }
    await cacheName(this.d, p.at, r.me.name);
    // Best effort, like ConfirmEmailChange: the server answered, so a failed keychain write must not
    // turn the whole screen into "Couldn't load". The next refresh follows the e-mail again.
    await followEmail(this.d, p.at, r.me.email).catch(() => undefined);
    return {
      kind: 'account',
      email: r.me.email,
      name: r.me.name,
      hasPassword: r.me.hasPassword,
      passwordChangedAt: r.me.passwordChangedAt,
    };
  }
}

export type UpdateNameResult =
  | { kind: 'saved'; user: User }
  | FieldRefused
  /** A local profile on a build that keeps no names. */
  | { kind: 'unavailable' }
  | NotSignedIn
  | AccountFailure;

/** Changes the name: on the server for an account, on this phone only for a local profile. Blank clears it. */
export class UpdateName {
  constructor(private readonly d: IdentityDeps) {}
  async execute(raw: string): Promise<UpdateNameResult> {
    const parsed = field(() => displayName(raw));
    if ('kind' in parsed) {
      return parsed;
    }
    const p = await place(this.d);
    if (p.kind === 'not-signed-in') {
      return p;
    }
    if (p.kind === 'local') {
      if (!this.d.names) {
        return { kind: 'unavailable' };
      }
      await this.d.names.write(p.profileId, parsed.ok);
    } else {
      const r = await p.at.a.gateway.updateName(p.at.session.token, parsed.ok);
      if (r.kind !== 'saved') {
        return r;
      }
      await cacheName(this.d, p.at, r.name);
    }
    const user = await new GetCurrentUser(this.d).execute();
    return user ? { kind: 'saved', user } : { kind: 'not-signed-in' };
  }
}

/** Mails a fresh code to the current address: the step before changing the e-mail or password. */
export class RequestStepUpCode {
  constructor(private readonly d: IdentityDeps) {}
  async execute(): Promise<{ kind: 'sent'; email: string } | NotSignedIn | AccountFailure> {
    const at = await signedInAccount(this.d);
    if (!at) {
      return { kind: 'not-signed-in' };
    }
    const r = await at.a.gateway.requestStepUpCode(at.session.token);
    return r.kind === 'sent' ? { kind: 'sent', email: at.entry.email } : r;
  }
}

export type RequestEmailChangeResult =
  | { kind: 'sent'; newEmail: string }
  /** The step-up code was wrong, expired or used: ask for a new one. */
  | { kind: 'invalid-code' }
  | FieldRefused
  | NotSignedIn
  | AccountFailure;

/** E-mail change, step 2: the step-up code plus the new address; the server mails a code there. */
export class RequestEmailChange {
  constructor(private readonly d: IdentityDeps) {}
  async execute(rawNewEmail: string, stepUpCode: string): Promise<RequestEmailChangeResult> {
    const at = await signedInAccount(this.d);
    if (!at) {
      return { kind: 'not-signed-in' };
    }
    const parsed = field(() => parseNewEmail(rawNewEmail, at.entry.email));
    if ('kind' in parsed) {
      return parsed;
    }
    const code = codeOf(stepUpCode);
    if (!code) {
      return { kind: 'invalid-code' };
    }
    const r = await at.a.gateway.requestEmailChange(at.session.token, parsed.ok, code);
    return r.kind === 'sent' ? { kind: 'sent', newEmail: parsed.ok } : r;
  }
}

export type ConfirmEmailChangeResult =
  | { kind: 'changed'; user: User }
  | { kind: 'invalid-code' }
  /** Another account has this address (only said once the new inbox's code proved ownership). */
  | { kind: 'email-taken' }
  | FieldRefused
  | NotSignedIn
  | AccountFailure;

/**
 * E-mail change, step 3: the code from the new inbox. The phone then follows: the profile map and
 * the stored session carry the new address.
 */
export class ConfirmEmailChange {
  constructor(private readonly d: IdentityDeps) {}
  async execute(rawNewEmail: string, rawCode: string): Promise<ConfirmEmailChangeResult> {
    const at = await signedInAccount(this.d);
    if (!at) {
      return { kind: 'not-signed-in' };
    }
    const parsed = field(() => parseNewEmail(rawNewEmail, null));
    if ('kind' in parsed) {
      return parsed;
    }
    const code = codeOf(rawCode);
    if (!code) {
      return { kind: 'invalid-code' };
    }
    const r = await at.a.gateway.confirmEmailChange(at.session.token, parsed.ok, code);
    if (r.kind !== 'changed') {
      return r;
    }
    // Best effort: the server has made the change, so a failed write here (e.g. the keychain) must
    // not read as a failure (a retry would then get "code didn't work"). The next
    // GetAccountSettings follows the e-mail again.
    await followEmail(this.d, at, r.email).catch(() => undefined);
    const user = await new GetCurrentUser(this.d).execute();
    return user ? { kind: 'changed', user } : { kind: 'not-signed-in' };
  }
}

export type SetPasswordResult =
  | { kind: 'saved' }
  | { kind: 'invalid-code' }
  /** Found in known data breaches: choose another. */
  | { kind: 'breached' }
  | FieldRefused
  | NotSignedIn
  | AccountFailure;

/** Sets or changes the account password, with a fresh step-up code. */
export class SetPassword {
  constructor(private readonly d: IdentityDeps) {}
  async execute(raw: string, stepUpCode: string): Promise<SetPasswordResult> {
    const at = await signedInAccount(this.d);
    if (!at) {
      return { kind: 'not-signed-in' };
    }
    const parsed = field(() => parseNewPassword(raw));
    if ('kind' in parsed) {
      return parsed;
    }
    const code = codeOf(stepUpCode);
    if (!code) {
      return { kind: 'invalid-code' };
    }
    return at.a.gateway.setPassword(at.session.token, parsed.ok, code);
  }
}

/** Removes the account password (codes keep working), with a fresh step-up code. */
export class RemovePassword {
  constructor(private readonly d: IdentityDeps) {}
  async execute(
    stepUpCode: string
  ): Promise<{ kind: 'removed' } | { kind: 'invalid-code' } | NotSignedIn | AccountFailure> {
    const at = await signedInAccount(this.d);
    if (!at) {
      return { kind: 'not-signed-in' };
    }
    const code = codeOf(stepUpCode);
    if (!code) {
      return { kind: 'invalid-code' };
    }
    return at.a.gateway.removePassword(at.session.token, code);
  }
}
