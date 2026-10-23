import type { ProfileNameStore, UserId } from '@cityturfer/core/identity/ports';
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'cityturfer.identity.profile-name.';
// Not a secret, but kept beside the sign-in state: readable while the phone is locked (a headless
// launch) and offline, like the account-profile map.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/**
 * The name shown for each profile on this phone (expo-secure-store, JSON `{ name }` per profile):
 * a local profile's own name, an account's cached one. Profile ids are `[a-z0-9_-]`, valid in keys.
 */
export class SecureStoreProfileNameStore implements ProfileNameStore {
  async read(profileId: UserId): Promise<string | null | undefined> {
    const raw = await SecureStore.getItemAsync(PREFIX + profileId, OPTIONS);
    if (!raw) {
      return undefined;
    }
    try {
      const v = JSON.parse(raw) as { name?: unknown };
      return typeof v?.name === 'string' ? v.name : v?.name === null ? null : undefined;
    } catch {
      return undefined;
    }
  }
  async write(profileId: UserId, name: string | null): Promise<void> {
    await SecureStore.setItemAsync(PREFIX + profileId, JSON.stringify({ name }), OPTIONS);
  }
  /** The profile's data is deleted from this phone: its name goes with it. */
  async forget(profileId: string): Promise<void> {
    await SecureStore.deleteItemAsync(PREFIX + profileId, OPTIONS);
  }
}
