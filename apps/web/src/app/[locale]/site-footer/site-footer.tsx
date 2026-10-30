import { useTranslations } from 'next-intl';

/** The page's footer: contact (when the waitlist is set up, it names the address) and ©. The
 * language switch stays in the header only, so the page has one "Language" landmark. */
export function SiteFooter({ contactEmail }: { contactEmail?: string }) {
  const t = useTranslations('footer');
  return (
    <footer className='site-footer' aria-label={t('label')}>
      <div className='wrap site-footer-row'>
        <p>{t('rights', { year: new Date().getFullYear() })}</p>
        {contactEmail ? (
          <p>
            {t('contact')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        ) : null}
      </div>
    </footer>
  );
}
