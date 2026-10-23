/**
 * The app's languages and how the one in use is chosen (docs/decisions/mobile-i18n-2026-10-23.md,
 * L1 and L4). Pure: no React, no native module.
 */

/** Languages the catalogue has (`apps/mobile/messages/<locale>/`). English is the source and fallback. */
export const LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** The Language setting in Info: follow the phone, or one language. */
export const LANGUAGE_SETTINGS = ['system', ...LOCALES] as const;
export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number];
export const DEFAULT_LANGUAGE_SETTING: LanguageSetting = 'system';

export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v);
export const isLanguageSetting = (v: unknown): v is LanguageSetting =>
  (LANGUAGE_SETTINGS as readonly unknown[]).includes(v);

/** The language part of a BCP 47 tag, lower case: `pl-PL` → `pl`, `en_GB` → `en`. */
const languageOf = (tag: string | null | undefined) => (tag ?? '').trim().split(/[-_]/)[0].toLowerCase();

/** The app locale for a setting: `system` maps the phone's `pl*` to Polish and anything else to English. */
export function resolveLocale(setting: LanguageSetting, deviceLocale: string | null | undefined): Locale {
  if (setting !== 'system') {
    return setting;
  }
  const lang = languageOf(deviceLocale);
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** The phone's locale as JS sees it (Hermes reads the OS setting); no expo-localization (L10). */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** The phone's time zone, for dates in messages. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The locale to format dates with: the phone's own regional variant when it speaks the app's
 * language (an `en-GB` phone keeps "22 Oct", an `en-US` one "Oct 22"), else the app locale. Any
 * Unicode extension (`-u-…`) is dropped so a phone's numbering system or calendar never leaks in.
 */
export function regionalLocale(locale: Locale, device: string | null | undefined): string {
  if (languageOf(device) !== locale) {
    return locale;
  }
  const tag = (device ?? '').replace(/_/g, '-').split('-u-')[0];
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag])[0] ?? locale;
  } catch {
    return locale;
  }
}
