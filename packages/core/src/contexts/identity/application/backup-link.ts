// Cloud backup for the local profiles (mock admin, demo): an e-mailed code links the account of the
// profile's own address to it, same profile id, same database
// (docs/decisions/local-profile-backup-2026-10-24.md, LP1–LP2).
import { DomainError } from '../../../shared-kernel';
import type { AccountProfiles } from '../domain/account-profiles';
import { type Email, type User, userId } from '../domain/user';
import type { AccountFailure } from './ports';
import { type AccountDeps, accountUser, type IdentityDeps, loadProfiles } from './use-cases';

/** A local profile the Turfer may link for backup: its own address; `linked`: its account is signed in. */
export interface BackupLinkTarget {
  readonly email: string;
  readonly linked: boolean;
}

/** The local profile's own e-mail while no other address holds its data; null: nothing to link. */
async function ownEmail(
  d: IdentityDeps,
  a: AccountDeps,
  profileId: string
): Promise<{ email: Email; profiles: AccountProfiles } | null> {
  const email = d.auth.localEmailOf(profileId);
  if (!email) {
    return null;
  }
  const profiles = await loadProfiles(a);
  return profiles.linkableToOwnEmail(userId(profileId), email.value) ? { email, profiles } : null;
}

/**
 * Is this a local profile the Turfer may link for backup, and to which address? Null: not a local
 * profile, its data belongs to another address's account, or this build has no accounts. No
 * network, no keychain: readable while locked. Whether a token is held: `accountBearer`.
 */
export class GetBackupLinkTarget {
  constructor(private readonly d: IdentityDeps) {}
  async execute(profileId: string): Promise<BackupLinkTarget | null> {
    const a = this.d.accounts;
    const own = a ? await ownEmail(this.d, a, profileId) : null;
    if (!own) {
      return null;
    }
    return { email: own.email.value, linked: own.profiles.current?.profileId === profileId };
  }
}

/** Not a local profile, or one whose data belongs to another address (see GetBackupLinkTarget). */
type NotLinkable = { kind: 'not-local-profile' } | { kind: 'accounts-unavailable' };

export type RequestBackupLinkCodeResult =
  { kind: 'sent'; email: string } | { kind: 'invalid-email' } | NotLinkable | AccountFailure;

/** "Email me a code": to the local profile's own address, and only there. */
export class RequestBackupLinkCode {
  constructor(private readonly d: IdentityDeps) {}
  async execute(profileId: string): Promise<RequestBackupLinkCodeResult> {
    const a = this.d.accounts;
    if (!a) {
      return { kind: 'accounts-unavailable' };
    }
    const own = await ownEmail(this.d, a, profileId);
    if (!own) {
      return { kind: 'not-local-profile' };
    }
    const r = await a.gateway.requestCode(own.email);
    return r.kind === 'sent' ? { kind: 'sent', email: own.email.value } : r;
  }
}

export type LinkSignedInProfileResult =
  /** The account is signed in on this profile; `user` carries its `accountId`. */
  | { kind: 'linked'; user: User }
  | { kind: 'invalid-code' }
  /** The profile given is not the one signed in on this phone. */
  | { kind: 'not-signed-in' }
  /** The server answered for another address (not expected: the code went to the profile's own). */
  | { kind: 'email-mismatch' }
  /** Another address's data lives in this profile (it was adopted). */
  | { kind: 'profile-taken' }
  /** This account's data already lives in another profile on this phone. */
  | { kind: 'linked-elsewhere' }
  | NotLinkable
  | AccountFailure;

const REFUSALS: Record<string, LinkSignedInProfileResult> = {
  'account.email-mismatch': { kind: 'email-mismatch' },
  'account.profile-taken': { kind: 'profile-taken' },
  'account.linked-elsewhere': { kind: 'linked-elsewhere' },
};

/**
 * The code from the local profile's own inbox: links that address's account to the signed-in
 * local profile (same profile, same database: the device session stays as it is) and keeps the
 * session in the keychain's single slot. Writes the keychain first, then the profile map: a crash
 * in between leaves "not linked" (AccountBearer trusts the map), and a retry overwrites the slot.
 */
export class LinkSignedInProfile {
  constructor(private readonly d: IdentityDeps) {}
  async execute(profileId: string, rawCode: string): Promise<LinkSignedInProfileResult> {
    const a = this.d.accounts;
    if (!a) {
      return { kind: 'accounts-unavailable' };
    }
    const own = await ownEmail(this.d, a, profileId);
    if (!own) {
      return { kind: 'not-local-profile' };
    }
    if ((await this.d.sessions.read().catch(() => null)) !== profileId) {
      return { kind: 'not-signed-in' };
    }
    const code = rawCode.replace(/\s+/g, '');
    if (!code) {
      return { kind: 'invalid-code' };
    }
    const r = await a.gateway.verifyCode(own.email, code);
    if (r.kind !== 'verified') {
      return r;
    }
    const session = r.session;
    // From here on any failure revokes the new session (best effort): none is left orphaned.
    const revoke = (token: string) => void a.gateway.revoke(token).catch(() => null);
    let profiles: AccountProfiles;
    try {
      // Read again: the map may have changed while the code was checked.
      profiles = await loadProfiles(a);
      profiles.linkOwn(session.account, userId(profileId), own.email.value);
    } catch (e) {
      revoke(session.token);
      const refusal = e instanceof DomainError ? REFUSALS[e.code] : undefined;
      if (refusal) {
        return refusal;
      }
      throw e;
    }
    try {
      const previous = await a.credentials.read().catch(() => null);
      await a.credentials.save(session);
      // The slot's earlier session (an earlier attempt's, or another account's) is replaced now:
      // revoked only once the new one is kept, so a failed save leaves the earlier one usable.
      if (previous && previous.token !== session.token) {
        revoke(previous.token);
      }
      await a.profiles.write(profiles.toState());
    } catch (e) {
      revoke(session.token);
      throw e;
    }
    return { kind: 'linked', user: await accountUser(this.d, profiles.current!) };
  }
}
