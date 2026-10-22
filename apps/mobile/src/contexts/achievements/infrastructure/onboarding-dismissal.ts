import * as SecureStore from 'expo-secure-store';

const key = (uid: string) => `cityturfer.onboarding.dismissed.${uid}`;

/** Remembers, per user, that the Getting started card was hidden. */
export const onboardingDismissal = {
  async isDismissed(uid: string): Promise<boolean> {
    try {
      return (await SecureStore.getItemAsync(key(uid))) === '1';
    } catch {
      return false;
    }
  },
  async dismiss(uid: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key(uid), '1');
    } catch {
      // Best effort: the card stays hidden for this session either way.
    }
  },
  /** The profile's data was deleted from this phone. Throws when the keychain refuses. */
  forget(uid: string): Promise<void> {
    return SecureStore.deleteItemAsync(key(uid));
  },
};
