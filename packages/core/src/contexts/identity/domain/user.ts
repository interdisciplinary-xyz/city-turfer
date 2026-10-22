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
export function email(raw: string): Email {
  const value = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new DomainError('email.invalid');
  }
  return { value };
}

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
}

/**
 * Local profiles that never have an account and never talk to the API (the demo profile with its
 * generated Gdańsk history). Every other profile reaches the server only once it has credentials.
 */
const LOCAL_ONLY_PROFILES: readonly string[] = ['demo'];
export const isLocalOnlyProfile = (profileId: string): boolean => LOCAL_ONLY_PROFILES.includes(profileId);
