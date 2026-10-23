import { SecureStoreLanguageSetting } from './language-setting';
import { applyLanguageSetting, getLanguageState } from './language-state';
import type { LanguageSetting } from './locales';

/** How long the launch spinner waits for the saved setting before showing the phone's language. */
export const LANGUAGE_READ_TIMEOUT_MS = 1500;

/** Reads and saves the Language setting and keeps the language state in step with it. */
export function createLanguageSettings(storage = new SecureStoreLanguageSetting()) {
  let loading: Promise<void> | null = null;
  // The saved value was read, or the user chose: nothing left to read.
  let settled = false;
  return {
    /**
     * Reads the saved setting and applies it; after a successful read later calls do nothing. An
     * unreadable keychain applies the phone's language and leaves the next call to read again (the
     * provider calls it on launch and each time the app comes to the front). Code outside React
     * (the recording notification) awaits it before building text in a headless launch.
     */
    load(): Promise<void> {
      if (settled) {
        return Promise.resolve();
      }
      loading ??= storage.get().then((saved) => {
        loading = null;
        if (settled) {
          return; // a choice made while the read was in flight wins over the stored value
        }
        if (saved === null) {
          if (!getLanguageState().ready) {
            applyLanguageSetting('system');
          }
          return;
        }
        settled = true;
        applyLanguageSetting(saved);
      });
      return loading;
    },
    /** Applies at once (no restart), then saves; throws if saving failed (the choice still applies). */
    async set(setting: LanguageSetting): Promise<void> {
      settled = true;
      applyLanguageSetting(setting);
      await storage.set(setting);
    },
  };
}

const settings = createLanguageSettings();

export const loadLanguageSetting = () => settings.load();
export const setLanguageSetting = (setting: LanguageSetting) => settings.set(setting);
