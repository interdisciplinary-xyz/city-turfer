import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import type { LanguageSwitcherProps } from './language-switcher.constants';

/**
 * Links to the same page in every language; the current one is marked, not linked. The accessible
 * name starts with the visible code ("PL, Polski"), so voice control users can say what they see.
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
          <Link key={l} href={href} locale={l} lang={l} hrefLang={l} aria-label={`${l.toUpperCase()}, ${t(l)}`}>
            {l.toUpperCase()}
          </Link>
        )
      )}
    </nav>
  );
}
