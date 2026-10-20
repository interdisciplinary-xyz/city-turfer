import * as SecureStore from 'expo-secure-store';

import type { DeviceTokenStore } from '../application/ports';

/** The keychain key of a user's device token (SecureStore keys allow [A-Za-z0-9._-] only). */
export const deviceTokenKey = (userId: string) =>
  `cityturfer.cloud-backup.token.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

/**
 * The secret device token of one user, in the keychain / Keystore. Never in the bundle, the
 * database or a log. Read only in the foreground (backup never runs headless), so the default
 * "when unlocked" accessibility is enough.
 */
export class SecureStoreDeviceTokenStore implements DeviceTokenStore {
  private readonly key: string;

  constructor(userId: string) {
    this.key = deviceTokenKey(userId);
  }

  read(): Promise<string | null> {
    return SecureStore.getItemAsync(this.key);
  }

  save(token: string): Promise<void> {
    return SecureStore.setItemAsync(this.key, token);
  }

  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(this.key);
  }
}
