import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { PORTAL_NAV_LINKS, type PortalNavProps } from './portal-nav.constants';

/**
 * The signed-in portal's sections: Activities and Privacy & data. The current one is marked
 * (`aria-current="page"` on its own page, `"true"` below it, e.g. on one activity).
 */
export function PortalNav({ locale, section, exact }: PortalNavProps) {
  const t = useTranslations('portal.nav');
  return (
    <nav className='portal-nav' aria-label={t('label')}>
      <ul className='portal-nav-list'>
        {PORTAL_NAV_LINKS.map((link) => (
          <li key={link.section}>
            <Link
              className='portal-nav-link'
              href={link.href}
              locale={locale}
              aria-current={link.section === section ? (exact ? 'page' : 'true') : undefined}
            >
              {t(link.section)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
