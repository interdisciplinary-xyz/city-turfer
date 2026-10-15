import * as SecureStore from 'expo-secure-store';

import type { SessionStore } from '../application/ports';
import { type UserId, userId } from '../domain/User';

const KEY = 'turftrack.session.uid';
// AFTER_FIRST_UNLOCK: the background task must read this while the phone is locked.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export class SecureStoreSessionStore implements SessionStore {
  async read(): Promise<UserId | null> {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    return raw ? userId(raw) : null;
  }
  async write(id: UserId) {
    await SecureStore.setItemAsync(KEY, id, OPTIONS);
  }
  async clear() {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  }
}
