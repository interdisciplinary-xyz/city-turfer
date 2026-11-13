import { NAME } from '@cityturfer/brand';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { FOOTER_LINKS } from './site-footer.constants';

/**
 * The page's footer. Left: the wordmark and the tagline. Middle: the section links (the header's
 * four). Right: contact (when the waitlist is set up, it names the address), what the site does not
 * do and the OpenStreetMap credit for the hero's street map. Bottom: ©. No portal link. The language
 * switch stays in the header only, so the page has one "Language" landmark.
 */
export function SiteFooter({ contactEmail }: { contactEmail?: string }) {
  const t = useTranslations('footer');
  const th = useTranslations('header.nav');
  const tagline = useTranslations('hero');
  const ta = useTranslations('a11y');
  return (
    <footer className='site-footer' aria-label={t('label')}>
      <div className='wrap'>
        <div className='site-footer-grid'>
          <div className='site-footer-brand'>
            <Image className='site-footer-wordmark' src={wordmark} alt={NAME} width={90} height={20} />
            <p>
              {tagline('taglineLead')} {tagline('taglineRamp')}
            </p>
          </div>
          <nav aria-label={t('navLabel')}>
            <ul className='site-footer-links'>
              {FOOTER_LINKS.map(({ key, href }) => (
                <li key={key}>
                  <a href={href}>{th(key)}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className='site-footer-contact'>
            {contactEmail ? (
              <p>
                {t('contact')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </p>
            ) : null}
            <p>{t('noCookies')}</p>
            <p>
              <a href='https://www.openstreetmap.org/copyright' rel='noopener noreferrer' target='_blank'>
                {t('mapCredit')}
                <span className='visually-hidden'> {ta('newTab')}</span>
              </a>
            </p>
          </div>
        </div>
        <p className='site-footer-legal'>{t('rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
