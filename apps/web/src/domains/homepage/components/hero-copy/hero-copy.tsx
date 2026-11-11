import { useTranslations } from 'next-intl';

import { SECTION_ANCHORS } from '@/domains/homepage/components/home-sections/home-sections.constants';

/**
 * The hero's text: the tagline (the dominant line), the lede and the two
 * buttons. The brand sits in the header, so no icon or wordmark here. `data-enter` marks the CSS
 * entrance in globals.css (`line` for the tagline, `copy` for the rest): it starts when fonts are
 * ready, without waiting for JavaScript, because the tagline is the page's largest paint.
 */
export function HeroCopy({ waitlist }: { waitlist: boolean }) {
  const t = useTranslations('hero');
  return (
    <div className='hero-copy'>
      <h1 id='hero-title'>
        <span className='line' data-enter='line'>
          {t('taglineLead')}
        </span>{' '}
        <span className='line' data-enter='line'>
          {t('taglineRamp')}
        </span>
      </h1>
      <p className='lede' data-enter='copy'>
        {t('lede')}
      </p>
      <div className='hero-actions' data-enter='copy'>
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
