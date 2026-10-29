import { NAME } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

/** Mark and wordmark in one row, the prototype badge, then tagline, lede and who it's for; the `data-anim` hooks are driven by HeroMotion. */
export function HeroCopy() {
  const t = useTranslations('hero');
  return (
    <div className='hero-copy'>
      <div className='hero-brand'>
        <Image className='mark' data-anim='mark' src={mark} alt='' priority width={132} height={132} />
        <Image className='wordmark' data-anim='wordmark' src={wordmark} alt={NAME} priority width={320} height={71} />
      </div>
      <p className='hero-badge' data-anim='copy'>
        {t('badge')}
      </p>
      <h1>
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
      <p className='hero-audience' data-anim='copy'>
        {t('audience')}
      </p>
    </div>
  );
}
