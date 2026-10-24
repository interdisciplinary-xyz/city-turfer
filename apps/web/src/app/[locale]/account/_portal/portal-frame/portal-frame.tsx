import { useTranslations } from 'next-intl';

import { PortalHeader } from '../portal-header';
import type { PortalFrameProps } from './portal-frame.constants';

/** Every portal page: skip link, header, the page, and the footer promise about the phone. */
export function PortalFrame({ locale, path, headerActions, nav, children }: PortalFrameProps) {
  const t = useTranslations('portal.common');
  return (
    <div className='portal'>
      <a className='skip' href='#portal-main'>
        {t('skip')}
      </a>
      <PortalHeader locale={locale} path={path} actions={headerActions} nav={nav} />
      <main id='portal-main' className='portal-main' tabIndex={-1}>
        {children}
      </main>
      <footer className='portal-footer'>
        <p>{t('backedUpCopy')}</p>
        <p>{t('phoneUntouched')}</p>
      </footer>
    </div>
  );
}
