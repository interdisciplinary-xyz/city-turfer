import * as SecureStore from 'expo-secure-store';

const key = (uid: string) => `cityturfer.record.turf-overlay.${uid}`;

/**
 * Remembers, per user, whether the Record map shows the Turfer's turf. Unset (or unreadable) means
 * shown: seeing which streets are already yours is the point of the overlay.
 */
export const turfOverlayPreference = {
  async isShown(uid: string): Promise<boolean> {
    try {
      return (await SecureStore.getItemAsync(key(uid))) !== '0';
    } catch {
      return true;
    }
  },
  async setShown(uid: string, shown: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(key(uid), shown ? '1' : '0');
    } catch {
      // Best effort: the toggle still applies for this session.
    }
  },
};
