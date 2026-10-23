import * as SecureStore from 'expo-secure-store';

import { DEFAULT_LANGUAGE_SETTING, isLanguageSetting, type LanguageSetting } from './locales';

/** Device-wide (it applies before sign-in), like the gap-estimation setting. */
export const LANGUAGE_SETTING_KEY = 'cityturfer.settings.language';

// AFTER_FIRST_UNLOCK: a headless launch (recording while the phone is locked) reads it for the notification.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** The part of expo-secure-store the setting needs; tests pass a fake. */
export interface KeyValueStore {
  getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
}

/** The saved Language setting. */
export class SecureStoreLanguageSetting {
  constructor(private readonly store: KeyValueStore = SecureStore) {}

  /**
   * The saved setting; unset or unknown means `system`. `null` means the keychain could not be read
   * (locked, or busy), so the caller follows the phone for now and reads again later.
   */
  async get(): Promise<LanguageSetting | null> {
    try {
      const raw = await this.store.getItemAsync(LANGUAGE_SETTING_KEY, OPTIONS);
      return isLanguageSetting(raw) ? raw : DEFAULT_LANGUAGE_SETTING;
    } catch {
      return null;
    }
  }

  /** Throws when the keychain refuses, so the screen can say the choice was not saved. */
  set(setting: LanguageSetting): Promise<void> {
    return this.store.setItemAsync(LANGUAGE_SETTING_KEY, setting, OPTIONS);
  }
}
