import type { Messages } from './catalogue';
import type { Locale } from './locales';

// Types use-intl's keys and locales from the English catalogue (key autocompletion in useT).
declare module 'use-intl' {
  interface AppConfig {
    Messages: Messages;
    Locale: Locale;
  }
}
