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
 * Local profiles that never have an account and never talk to the API (the demo profile with its
 * generated Gdańsk history). Every other profile reaches the server only once it has credentials.
 */
const LOCAL_ONLY_PROFILES: readonly string[] = ['demo'];
export const isLocalOnlyProfile = (profileId: string): boolean => LOCAL_ONLY_PROFILES.includes(profileId);
