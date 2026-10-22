import type { AccountSession, CredentialStore } from '@cityturfer/core/identity/ports';
import * as SecureStore from 'expo-secure-store';

const KEY = 'cityturfer.identity.account-session';
// The bearer token: this device only (not in backups or on a new phone), readable only while the
// phone is unlocked. The background location task never reads it (it never talks to the server).
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function parse(raw: string | null): AccountSession | null {
  if (!raw) {
    return null;
  }
  try {
    const v = JSON.parse(raw) as AccountSession;
    return typeof v?.token === 'string' && typeof v.account?.id === 'string' && typeof v.account.email === 'string'
      ? v
      : null;
  } catch {
    return null;
  }
}

/** The signed-in account's session (bearer token + account) in the keychain / Keystore. Never logged. */
export class SecureStoreCredentialStore implements CredentialStore {
  async read(): Promise<AccountSession | null> {
    return parse(await SecureStore.getItemAsync(KEY, OPTIONS));
  }
  async save(session: AccountSession): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
  }
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  }
}
