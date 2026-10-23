import * as SecureStore from 'expo-secure-store';

import { DEFAULT_LANGUAGE_SETTING, isLanguageSetting, type LanguageSetting } from './locales';

/** Device-wide (it applies before sign-in), like the gap-estimation setting. */
export const LANGUAGE_SETTING_KEY = 'cityturfer.settings.language';

/** The part of expo-secure-store the setting needs; tests pass a fake. */
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

/** The saved Language setting. Unset, unknown or unreadable means `system`. */
export class SecureStoreLanguageSetting {
  constructor(private readonly store: KeyValueStore = SecureStore) {}

  async get(): Promise<LanguageSetting> {
    try {
      const raw = await this.store.getItemAsync(LANGUAGE_SETTING_KEY);
      return isLanguageSetting(raw) ? raw : DEFAULT_LANGUAGE_SETTING;
    } catch {
      return DEFAULT_LANGUAGE_SETTING; // keychain locked or unreadable: follow the phone
    }
  }

  /** Throws when the keychain refuses, so the screen can say the choice was not saved. */
  set(setting: LanguageSetting): Promise<void> {
    return this.store.setItemAsync(LANGUAGE_SETTING_KEY, setting);
  }
}
