import { shouldPolyfill } from '@formatjs/intl-pluralrules/should-polyfill.js';

import { LOCALES } from './locales';

/*
 * ICU plurals need Intl.PluralRules, and Hermes (0.86's build, 250829098.0.17) ships only Collator,
 * DateTimeFormat and NumberFormat. The pure-JS polyfill and the plural data of our locales load only
 * where the engine lacks them (L3): never in Node (Jest), always on Hermes today. Adding a locale
 * means adding its locale-data require below.
 */

type Probe = (locale: string) => string | undefined;

/** True when any app locale needs the polyfill (no Intl.PluralRules, a broken one, or no data). */
export const needsPluralRules = (probe: Probe = shouldPolyfill): boolean => LOCALES.some((l) => probe(l) != null);

function loadPolyfill(): void {
  /* eslint-disable @typescript-eslint/no-require-imports -- conditional on purpose: Metro bundles
     these, but they run only where the engine lacks plural rules; order matters (rules, then data). */
  require('@formatjs/intl-pluralrules/polyfill-force.js');
  require('@formatjs/intl-pluralrules/locale-data/en.js');
  require('@formatjs/intl-pluralrules/locale-data/pl.js');
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/** Installs the polyfill if needed; returns whether it did. Idempotent once the rules exist. */
export function installPluralRules(probe: Probe = shouldPolyfill, load: () => void = loadPolyfill): boolean {
  if (!needsPluralRules(probe)) {
    return false;
  }
  load();
  return true;
}

// Runs on first import: the i18n module imports this before any message is formatted.
installPluralRules();
