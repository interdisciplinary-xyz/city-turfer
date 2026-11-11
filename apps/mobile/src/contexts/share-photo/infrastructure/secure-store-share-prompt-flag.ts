import * as SecureStore from 'expo-secure-store';

import type { SharePromptFlag } from '../domain/ports';

const key = (uid: string) => `cityturfer.share-prompt.off.${uid}`;

/** Remembers, per user, Don't ask again on the after-Finish "Share a photo?" card. */
export class SecureStoreSharePromptFlag implements SharePromptFlag {
  async isOff(uid: string): Promise<boolean> {
    return (await SecureStore.getItemAsync(key(uid))) === '1';
  }
  async turnOff(uid: string): Promise<void> {
    await SecureStore.setItemAsync(key(uid), '1');
  }
  /** The profile's data was deleted from this phone. Throws when the keychain refuses. */
  forget(uid: string): Promise<void> {
    return SecureStore.deleteItemAsync(key(uid));
  }
}
