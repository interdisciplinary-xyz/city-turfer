import { useTranslations } from 'next-intl';

import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import type { LanguageSwitcherProps } from './language-switcher.constants';

/**
 * Links to the same page in every language; the current one is marked, not linked. The accessible
 * name starts with the visible code ("PL, Polski"), so voice control users can say what they see.
 *
 * Plain links, not next-intl's client-side Link: each language is its own root layout (it owns
 * <html>), so a client-side switch rebuilds <html> in the browser. That drops the classes the boot
 * scripts in <head> set (`loaded`), leaving the hero hidden, and React warns about the scripts. A
 * full page load runs the boot scripts again.
 */
export function LanguageSwitcher({ locale, className, href = '/' }: LanguageSwitcherProps) {
  const t = useTranslations('language');
  return (
    <nav aria-label={t('label')} className={['lang', className].filter(Boolean).join(' ')}>
      {routing.locales.map((l) =>
        l === locale ? (
          <span key={l} aria-current='true' lang={l}>
            {l.toUpperCase()}
          </span>
        ) : (
          <a
            key={l}
            href={getPathname({ href, locale: l })}
            lang={l}
            hrefLang={l}
            aria-label={`${l.toUpperCase()}, ${t(l)}`}
          >
            {l.toUpperCase()}
          </a>
        )
      )}
    </nav>
  );
}
