// Plural rules first: Hermes lacks Intl.PluralRules (see plural-rules.ts).
import './plural-rules';

import { createTranslator, type IntlError } from 'use-intl/core';

import { MESSAGES, type Messages, type Namespace, sourceMessage } from './catalogue';
import { currentLocale } from './language-state';
import { deviceTimeZone, type Locale } from './locales';

/** Never throws, so a bad message can never take a screen down; development builds say what went wrong. */
export function onI18nError(error: IntlError): void {
  if (__DEV__) {
    console.warn(`[i18n] ${error.code}: ${error.message}`);
  }
}

/** A message that cannot be shown in the app language: the English text, else its key. */
export function messageFallback({ namespace, key }: { namespace?: string; key: string }): string {
  const path = namespace ? `${namespace}.${key}` : key;
  return sourceMessage(path) ?? path;
}

const make = <NS extends Namespace>(locale: Locale, namespace: NS, timeZone: string | undefined) =>
  createTranslator<Messages, NS>({
    locale,
    messages: MESSAGES[locale],
    namespace,
    timeZone,
    onError: onI18nError,
    getMessageFallback: messageFallback,
  });

export type T<NS extends Namespace> = ReturnType<typeof make<NS>>;

const cache = new Map<string, unknown>();

/**
 * Messages of one namespace outside React (Alert text built in a handler, the recording
 * notification). It reads the language at call time: call it when the text is built, never at
 * module top level. `locale` overrides the app language (tests).
 */
export function translator<NS extends Namespace>(namespace: NS, locale: Locale = currentLocale()): T<NS> {
  const timeZone = deviceTimeZone();
  const id = `${locale}|${timeZone}|${namespace}`;
  let t = cache.get(id) as T<NS> | undefined;
  if (!t) {
    t = make(locale, namespace, timeZone);
    cache.set(id, t);
  }
  return t;
}
