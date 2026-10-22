import type { AccountProfilesState, AccountProfileStore } from '@cityturfer/core/identity/ports';
import * as SecureStore from 'expo-secure-store';

const KEY = 'cityturfer.identity.account-profiles';
// No secret here (account ids, emails, profile ids), but kept with the sign-in state so the app can
// tell who is signed in while the phone is locked (a headless launch) and when it is offline.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Which local profile holds each account's data on this phone (expo-secure-store, JSON). */
export class SecureStoreAccountProfileStore implements AccountProfileStore {
  async read(): Promise<AccountProfilesState | null> {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) {
      return null;
    }
    try {
      const v = JSON.parse(raw) as AccountProfilesState;
      return Array.isArray(v?.entries) ? v : null;
    } catch {
      return null;
    }
  }
  async write(state: AccountProfilesState): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(state), OPTIONS);
  }
}
