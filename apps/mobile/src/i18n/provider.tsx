import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { IntlProvider, useTranslations } from 'use-intl';

import { MESSAGES, type Namespace } from './catalogue';
import { loadLanguageSetting, setLanguageSetting } from './language';
import { applyLanguageSetting, getLanguageState, type LanguageState, subscribeLanguage } from './language-state';
import { deviceTimeZone, type LanguageSetting, type Locale } from './locales';
import { messageFallback, onI18nError, type T } from './translator';

const useLanguageState = (): LanguageState => useSyncExternalStore(subscribeLanguage, getLanguageState);

/**
 * The app's messages in the language of the Language setting (else the phone's). Renders at once
 * with the phone's language; the saved setting arrives a moment later from the secure store (the
 * root layout keeps its launch spinner up until `ready`, so a chosen language never flashes).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale, setting, ready } = useLanguageState();
  const timeZone = useMemo(() => deviceTimeZone(), []);

  useEffect(() => {
    void loadLanguageSetting();
  }, []);

  // Android can change the phone's language while the app is in the background: follow it.
  useEffect(() => {
    if (!ready || setting !== 'system') {
      return;
    }
    const sub = AppState.addEventListener('change', (s) => s === 'active' && applyLanguageSetting('system'));
    return () => sub.remove();
  }, [ready, setting]);

  return (
    <IntlProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone={timeZone}
      onError={onI18nError}
      getMessageFallback={messageFallback}
    >
      {children}
    </IntlProvider>
  );
}

/** Messages of one namespace (`useT('common')('cancel')`); re-renders when the language changes. */
export function useT<NS extends Namespace>(namespace: NS): T<NS> {
  return useTranslations(namespace) as T<NS>;
}

/** The app locale (`en` | `pl`). Components that format numbers or dates read it so they re-render on a change. */
export const useLocale = (): Locale => useLanguageState().locale;

/**
 * The Language setting and its setter. The state carries `ready` (the saved value was read) and
 * `system` (what System resolves to on this phone). The setter applies at once and rejects only if
 * saving failed.
 */
export function useLanguageSetting(): [LanguageState, (setting: LanguageSetting) => Promise<void>] {
  return [useLanguageState(), setLanguageSetting];
}
