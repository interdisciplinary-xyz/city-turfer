import { DomainError } from '../../../shared-kernel';

export type UserId = string & { readonly __brand: 'UserId' };
export const userId = (raw: string): UserId => {
  if (!/^[a-z0-9_-]{1,64}$/i.test(raw)) {
    throw new DomainError('user-id.invalid', raw);
  }
  return raw as UserId;
};

export interface Email {
  readonly value: string;
}

/** The longest address accepted (the API's `Email` schema: `.max(254)`, RFC 5321's path limit). */
export const EMAIL_MAX = 254;

/**
 * The address rule of the sign-in routes, copied: zod 4's `z.email()` default pattern
 * (`regexes.email` in zod 4.6.7, "practical email validation"), which the API's sign-in schema and
 * Better Auth both apply. Core cannot import zod, so the pattern lives here too, and
 * `apps/api/src/__tests__/account.test.ts` runs shared vectors through both so they cannot drift.
 * ASCII only: `jürgen@example.de` or `jan&co@firma.pl` would be accepted by a looser rule and then
 * never sign in again. Update it together with zod.
 */
const ZOD_EMAIL =
  // eslint-disable-next-line no-useless-escape -- verbatim copy of zod's pattern, kept diffable.
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

/**
 * An account e-mail: trimmed, then exactly the set the sign-in routes accept (ZOD_EMAIL, at most
 * EMAIL_MAX characters), then lower-cased (ASCII only, so lower-casing keeps it valid).
 */
export function email(raw: string): Email {
  const trimmed = raw.trim();
  if (trimmed.length > EMAIL_MAX || !ZOD_EMAIL.test(trimmed)) {
    throw new DomainError('email.invalid');
  }
  return { value: trimmed.toLowerCase() };
}

export interface User {
  /** The local profile (one database per profile). */
  readonly id: UserId;
  readonly email: string;
  /** Legacy label (mock name or the email's local part). UIs show `name` instead. */
  readonly displayName: string;
  /**
   * The Turfer's chosen name: on the server for an account, on this phone for a local profile.
   * Null: none chosen; undefined: not known yet. Either way the UIs show "You", never an id.
   */
  readonly name?: string | null;
  /** The CityTurfer account signed in on this profile; absent: a local profile (mock admin, demo). */
  readonly accountId?: string;
}

/**
 * Local profiles never placed for another account's sign-in (the demo profile with its generated
 * Gdańsk history): no adoption, no "use this phone's history?". The profile may still be linked to
 * an account for its own address (`AccountProfiles.linkOwn`, docs/decisions/local-profile-backup-2026-10-24.md).
 */
export const DEMO_PROFILE_ID: UserId = userId('demo');
export const NEVER_ADOPTED: readonly string[] = [DEMO_PROFILE_ID];
export const isNeverAdopted = (profileId: string): boolean => NEVER_ADOPTED.includes(profileId);
