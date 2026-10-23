/**
 * The app in English and Polish (docs/decisions/mobile-i18n-2026-10-23.md, mobile-i18n skill).
 * Components: `useT(namespace)`; code outside React: `translator(namespace)`; numbers and dates go
 * through `@/ui-kit/format`, which reads the same language.
 */
export type { Messages, Namespace } from './catalogue';
export { loadLanguageSetting, setLanguageSetting } from './language';
export { currentDateLocale, currentLocale, getLanguageState, type LanguageState } from './language-state';
export {
  DEFAULT_LOCALE,
  LANGUAGE_SETTINGS,
  type LanguageSetting,
  type Locale,
  LOCALES,
  resolveLocale,
} from './locales';
export { I18nProvider, useLanguageSetting, useLocale, useT } from './provider';
export { type T, translator } from './translator';
