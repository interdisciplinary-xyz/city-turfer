import {
  DEFAULT_LANGUAGE_SETTING,
  deviceLocale,
  type LanguageSetting,
  type Locale,
  regionalLocale,
  resolveLocale,
} from './locales';

/** What the app speaks now. `ready` turns true once the saved setting has been read. */
export interface LanguageState {
  readonly setting: LanguageSetting;
  readonly locale: Locale;
  /** What `system` resolves to on this phone (Info shows it next to the System option). */
  readonly system: Locale;
  /** The phone's locale the state was resolved with (dates use its regional variant). */
  readonly device: string;
  readonly ready: boolean;
}

const resolve = (setting: LanguageSetting, ready: boolean, device = deviceLocale()): LanguageState => ({
  setting,
  locale: resolveLocale(setting, device),
  system: resolveLocale('system', device),
  device,
  ready,
});

/*
 * One module-level store, like the LiveSessionStore: React reads it with useSyncExternalStore (the
 * I18nProvider), everything else (format.ts, translator()) reads it at call time. No React, no
 * native module, so pure code and Jest can import it.
 */
let state: LanguageState = resolve(DEFAULT_LANGUAGE_SETTING, false);
const listeners = new Set<() => void>();

export const getLanguageState = (): LanguageState => state;

/** The app locale now (`en` until the saved setting is read, if the phone is not Polish). */
export const currentLocale = (): Locale => state.locale;

/** The locale for dates now: the app language in the phone's regional variant when they agree. */
export const currentDateLocale = (): string => regionalLocale(state.locale, state.device);

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Applies a setting (read from storage or chosen in Info) and tells subscribers when it changed anything. */
export function applyLanguageSetting(setting: LanguageSetting, device = deviceLocale()): void {
  const next = resolve(setting, true, device);
  if (next.setting === state.setting && next.locale === state.locale && next.device === state.device && state.ready) {
    return;
  }
  state = next;
  for (const l of [...listeners]) {
    l();
  }
}

/** Tests only: back to the launch state (system, not ready). */
export function resetLanguageStateForTests(device?: string): void {
  state = resolve(DEFAULT_LANGUAGE_SETTING, false, device);
  listeners.clear();
}
