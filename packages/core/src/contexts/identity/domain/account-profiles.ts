import { DomainError } from '../../../shared-kernel';
import { isLocalOnlyProfile, type UserId, userId } from './user';

/** A CityTurfer account (server user) as the phone knows it. */
export interface Account {
  readonly id: string;
  readonly email: string;
}

/** Which local profile (database) holds an account's data on this phone. */
export interface AccountProfileEntry {
  readonly accountId: string;
  readonly email: string;
  readonly profileId: UserId;
  /** The account was deleted; the profile was kept on the phone (found again by email). */
  readonly deleted: boolean;
}

export interface AccountProfilesState {
  readonly entries: readonly AccountProfileEntry[];
  /** The account signed in on this phone now; null: none (a local profile, or signed out). */
  readonly current: string | null;
}

/** The profile whose history a first real sign-in may adopt (the founder's local history). */
export const ADOPTABLE_PROFILE = 'admin';

const MAX_ID = 64;

/** A new local profile id for an account: `a-` + its id, limited to what a profile id allows. */
export function profileIdForAccount(accountId: string): UserId {
  return userId(`a-${accountId.replace(/[^a-z0-9_-]/gi, '_')}`.slice(0, MAX_ID));
}

export type ProfilePlacement = { kind: 'known'; profileId: UserId } | { kind: 'ask'; adoptable: UserId };

/**
 * Accounts ↔ local profiles on this phone. Invariants: one profile per account and one account per
 * profile; a local-only profile (demo) never gets an account; the adoptable `admin` history is only
 * linked after the Turfer said yes, and from then on never opens with the mock password; a deleted
 * account's kept profile is found again by its email.
 */
export class AccountProfiles {
  private constructor(private state: AccountProfilesState) {}

  static empty(): AccountProfiles {
    return new AccountProfiles({ entries: [], current: null });
  }

  static rehydrate(state: AccountProfilesState): AccountProfiles {
    return new AccountProfiles(state);
  }

  toState(): AccountProfilesState {
    return this.state;
  }

  /** The signed-in account's entry, if any. */
  get current(): AccountProfileEntry | null {
    return this.active(this.state.current);
  }

  /** The profile an account's data lives in, or null when it has none yet. */
  profileOf(accountId: string): UserId | null {
    return this.active(accountId)?.profileId ?? null;
  }

  /** The account's profile, or the one kept when it was deleted (same email); null: none yet. */
  knownProfile(account: Account): UserId | null {
    return this.profileOf(account.id) ?? this.keptFor(account.email);
  }

  /**
   * Where a signing-in account goes: its known profile; otherwise, if this phone has a local
   * history nobody has claimed, the Turfer is asked first; otherwise a new profile of its own.
   */
  placementFor(account: Account, adoptableHasHistory: boolean): ProfilePlacement {
    const known = this.knownProfile(account);
    if (known) {
      return { kind: 'known', profileId: known };
    }
    const adoptable = userId(ADOPTABLE_PROFILE);
    if (adoptableHasHistory && !this.isHeld(adoptable)) {
      return { kind: 'ask', adoptable };
    }
    return { kind: 'known', profileId: profileIdForAccount(account.id) };
  }

  /** The Turfer's answer to "use this phone's history?": the adoptable profile, or one of its own. */
  chosenProfile(account: Account, useLocalHistory: boolean): UserId {
    const known = this.knownProfile(account);
    if (known) {
      return known;
    }
    const adoptable = userId(ADOPTABLE_PROFILE);
    return useLocalHistory && !this.isHeld(adoptable) ? adoptable : profileIdForAccount(account.id);
  }

  /**
   * A local profile opens with its password (mock admin) only while no account's data lives in it.
   * Once an account adopted it (or the account was deleted and its data kept here) only that
   * account's email sign-in opens it: the mock password is public.
   */
  opensWithPassword(profileId: UserId): boolean {
    return !this.state.entries.some((e) => e.profileId === profileId);
  }

  /**
   * The profile an account's deletion concerns: the one linked to it, else the signed-in profile
   * (if it is no local-only one and no other account holds it); null: none on this phone.
   */
  profileForDeletion(accountId: string, signedIn: UserId | null): UserId | null {
    const linked = this.profileOf(accountId);
    if (linked) {
      return linked;
    }
    if (!signedIn || isLocalOnlyProfile(signedIn)) {
      return null;
    }
    const owner = this.state.entries.find((e) => e.profileId === signedIn && !e.deleted);
    return owner && owner.accountId !== accountId ? null : signedIn;
  }

  /** Links the account to a profile (replacing a deleted account's entry for it) and signs it in. */
  link(account: Account, profileId: UserId): void {
    if (isLocalOnlyProfile(profileId)) {
      throw new DomainError('account.local-only-profile', profileId);
    }
    const owner = this.state.entries.find((e) => e.profileId === profileId && !e.deleted);
    if (owner && owner.accountId !== account.id) {
      throw new DomainError('account.profile-taken', profileId);
    }
    // A deleted account's kept profile goes only to an account with that email.
    const kept = this.state.entries.find((e) => e.profileId === profileId && e.deleted);
    if (kept && kept.email !== account.email) {
      throw new DomainError('account.profile-taken', profileId);
    }
    const others = this.state.entries.filter((e) => e.accountId !== account.id && e.profileId !== profileId);
    this.state = {
      entries: [...others, { accountId: account.id, email: account.email, profileId, deleted: false }],
      current: account.id,
    };
  }

  /**
   * The account's e-mail changed on the server: its entry follows, so a later sign-in or a deleted
   * account's kept profile still matches by e-mail.
   */
  emailChanged(accountId: string, email: string): void {
    this.state = {
      ...this.state,
      entries: this.state.entries.map((e) => (e.accountId === accountId && !e.deleted ? { ...e, email } : e)),
    };
  }

  signedOut(): void {
    this.state = { ...this.state, current: null };
  }

  /** The account is gone on the server; its profile stays (or is forgotten with `keepData: false`). */
  accountDeleted(accountId: string, keepData: boolean): void {
    this.state = {
      entries: this.state.entries.flatMap((e) =>
        e.accountId !== accountId ? [e] : keepData ? [{ ...e, deleted: true }] : []
      ),
      current: this.state.current === accountId ? null : this.state.current,
    };
  }

  private active(accountId: string | null): AccountProfileEntry | null {
    return (accountId && this.state.entries.find((e) => e.accountId === accountId && !e.deleted)) || null;
  }

  private keptFor(email: string): UserId | null {
    const e = this.state.entries.find((x) => x.deleted && x.email === email);
    return e && !this.isTaken(e.profileId) ? e.profileId : null;
  }

  private isTaken(profileId: UserId): boolean {
    return this.state.entries.some((e) => e.profileId === profileId && !e.deleted);
  }

  /** Any account's data lives in the profile, a deleted account's kept data included. */
  private isHeld(profileId: UserId): boolean {
    return this.state.entries.some((e) => e.profileId === profileId);
  }
}
