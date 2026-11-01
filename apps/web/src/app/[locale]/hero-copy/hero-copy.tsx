import { useTranslations } from 'next-intl';

import { SECTION_ANCHORS } from '../home-sections/home-sections.constants';

/**
 * The hero's text: the "Early prototype" badge, the tagline (the dominant line), the lede and the two
 * buttons. The brand sits in the header, so no icon or wordmark here. The `data-anim` hooks are
 * driven by HeroMotion: `line` for the tagline, `copy` for the rest.
 */
export function HeroCopy({ waitlist }: { waitlist: boolean }) {
  const t = useTranslations('hero');
  return (
    <div className='hero-copy'>
      <p className='hero-badge' data-anim='copy'>
        {t('badge')}
      </p>
      <h1 id='hero-title'>
        <span className='line' data-anim='line'>
          {t('taglineLead')}
        </span>{' '}
        <span className='line' data-anim='line'>
          {t('taglineRamp')}
        </span>
      </h1>
      <p className='lede' data-anim='copy'>
        {t('lede')}
      </p>
      <div className='hero-actions' data-anim='copy'>
        {waitlist ? (
          <a className='btn btn-primary' href={`#${SECTION_ANCHORS.waitlist}`}>
            {t('join')}
          </a>
        ) : null}
        <a className='btn btn-secondary' href={`#${SECTION_ANCHORS.how}`}>
          {t('seeGlow')}
        </a>
      </div>
    </div>
  );
}
