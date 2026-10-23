import { SecureStoreLanguageSetting } from './language-setting';
import { applyLanguageSetting, getLanguageState } from './language-state';
import type { LanguageSetting } from './locales';

/** Reads and saves the Language setting and keeps the language state in step with it. */
export function createLanguageSettings(storage = new SecureStoreLanguageSetting()) {
  let loading: Promise<void> | null = null;
  return {
    /**
     * Reads the saved setting once and applies it; later calls return the same promise. The
     * I18nProvider calls it at launch; code outside React (the recording notification) awaits it
     * before building text in a headless launch.
     */
    load(): Promise<void> {
      loading ??= storage.get().then((setting) => {
        // A choice made while the read was in flight wins over the stored value.
        if (!getLanguageState().ready) {
          applyLanguageSetting(setting);
        }
      });
      return loading;
    },
    /** Applies at once (no restart), then saves; throws if saving failed (the choice still applies). */
    async set(setting: LanguageSetting): Promise<void> {
      applyLanguageSetting(setting);
      await storage.set(setting);
    },
  };
}

const settings = createLanguageSettings();

export const loadLanguageSetting = () => settings.load();
export const setLanguageSetting = (setting: LanguageSetting) => settings.set(setting);
